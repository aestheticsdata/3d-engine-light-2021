// The scene's absolute orientation, and the camera that orientation implies.
//
// The engine has no camera matrix — Point3D.convert3D2D is a bare perspective
// divide about a focal length — so this rig turns the world instead, which
// produces the same picture. Rotating the world by R is exactly rotating the
// camera by its transpose, and because R is orthonormal that transpose is the
// inverse, so the eye position falls out of the same matrix the frame is drawn
// with. No readout here can describe a camera the renderer is not using.
//
// Spin is an accumulator added to the angles rather than a mutation of them, so
// the two compose the way a turntable does: a preset or a drag moves the
// viewpoint and the spin keeps running from wherever it was left.
//
// It runs on all three axes, not just yaw, and it accumulates as a MATRIX
// rather than as three angles. That distinction is the whole motion. The
// per-frame rate sliders this rig replaced multiplied a fixed small delta into
// the already-rotated points every frame — a constant angular velocity about a
// fixed axis, which reads as one smooth tumble. Growing three Euler angles
// linearly and recomposing them each frame is a different motion entirely: the
// effective axis wanders as the angles grow, so the solid appears to turn one
// way, then another, then another. Compose the delta; do not accumulate the
// angles.
//
// None of the three angles is clamped. Pitch used to stop at ±89 on the
// argument that a turntable has a roll axis and nothing to gain from the pole
// flip, but that argument was about the sliders: it made a vertical drag hit a
// wall after 178° and stop dead, while yaw span freely. The rows keep their own
// ±89 / ±180 ranges — a range input has to be bounded — and saturate against an
// angle that carries on, exactly as the YAW row already does past 180°.
//
// Angles are degrees everywhere, in and out. Matrix3D converts internally and
// the gizmo hands CSS the radians atan2 already returns, so a `180 / Math.PI`
// anywhere in this file or its readers is a bug.

import { easeInOutCubic, lerp } from "@animations/shapeTransition/easing";
import viewPresets from "@camera/viewPresets";
import Matrix3D from "@primitives/Matrix3D";

import type { ViewPresetKey } from "@camera/viewPresets";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface EulerDegrees {
  pitch: number;
  yaw: number;
  roll: number;
}

// One axis of the gizmo: where it points on screen, and how much of its length
// survives the projection. Radians because that is what atan2 returns and what
// CSS accepts as `rad`.
export interface AxisScreenDirection {
  angleRadians: number;
  foreshortening: number;
}

// Every value a control can write. Partial at the call site so one slider moves
// one number without the caller having to restate the other three.
export interface RigAngles {
  pitch: number;
  yaw: number;
  roll: number;
  spinRate: number;
}

interface PresetTween {
  from: EulerDegrees;
  to: EulerDegrees;
  elapsedSeconds: number;
}

const PRESET_DURATION_SECONDS = 0.35;
const HALF_TURN_DEGREES = 180;
const FULL_TURN_DEGREES = 360;
// The three object axes, as column indices into R. Named rather than written as
// a literal at both call sites, because the gizmo's X/Y/Z order is the same
// order and the two must not drift.
const AXIS_COLUMNS = [0, 1, 2];

// The turntable's angular velocity, as a direction. SPIN names the yaw
// component — the fastest of the three and the one the row is scaled in — and
// these are the other two against it, taken from the rates this rig replaced
// (87.3 and 48.0 against yaw's 122.2 °/s). Together they are the fixed axis the
// solid tumbles about; SPIN only scales how fast it goes round it.
const SPIN_AXIS_PITCH = 87.3 / 122.2;
const SPIN_AXIS_YAW = 1;
const SPIN_AXIS_ROLL = 48 / 122.2;
// |(pitch, yaw, roll)|, so a SPIN of 122 °/s means 122 °/s of *yaw* rather than
// 122 °/s about the tilted axis — which is what makes the row's number mean the
// same thing it did before the other two axes came back.
const SPIN_AXIS_LENGTH = Math.sqrt(SPIN_AXIS_PITCH ** 2 + SPIN_AXIS_YAW ** 2 + SPIN_AXIS_ROLL ** 2);

// Into (-180, 180], not the [-180, 180) the usual
// `((d + 180) % 360 + 360) % 360 - 180` gives: BACK is a yaw of exactly 180 and
// the readout has to print 180°, not -180°.
const normaliseDegrees = (degrees: number): number =>
  HALF_TURN_DEGREES - ((((HALF_TURN_DEGREES - degrees) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES);

class CameraRig {
  private readonly matrix3D: Matrix3D;
  // Zero today and structural rather than decorative: it rides in the matrix's
  // translation column, so the `target` readout is a real quantity the moment
  // panning input exists rather than a constant printed beside live numbers.
  private readonly targetPosition: Vector3;
  private pitchDegrees: number;
  private yawDegrees: number;
  private rollDegrees: number;
  private spinDegreesPerSecond: number;
  private spinMatrix: number[][];
  private preset: PresetTween | null;

  constructor() {
    this.matrix3D = new Matrix3D();
    this.targetPosition = { x: 0, y: 0, z: 0 };
    this.pitchDegrees = 0;
    this.yawDegrees = 0;
    this.rollDegrees = 0;
    this.spinDegreesPerSecond = 0;
    this.spinMatrix = this.matrix3D.identity();
    this.preset = null;
  }

  // The live object, not a copy. It is one of this rig's own fields and nothing
  // outside writes it; copying it per frame for a caller that does not exist is
  // the defensive allocation Mesh already refuses to make.
  public get target(): Readonly<Vector3> {
    return this.targetPosition;
  }

  // Read before advance() so the caller can push the last frame of an ease back
  // into the rows: advance() is what clears the tween, so a check made after it
  // misses exactly the frame that carries the final angles.
  public get isEasingPreset(): boolean {
    return this.preset !== null;
  }

  // The matrix the frame is drawn with.
  //
  // The order reproduces what the incremental path was really computing: it
  // applied pitch, then yaw, then roll to already-transformed points, so the
  // product was R_roll · R_yaw · R_pitch. Preserving it is what makes equal
  // angles give the attitude they used to.
  // The camera alone, with no turntable in it — what the background pass needs
  // to draw a ground and a horizon the viewpoint agrees with.
  public viewMatrix(): number[][] {
    const target = this.targetPosition;

    return this.matrix3D.multiply(this.cameraRotation(), this.matrix3D.translation(-target.x, -target.y, -target.z));
  }

  // What a mesh is drawn with: the object's own spin, then the camera. Composed
  // as (C·T)·S rather than (C·S)·T so the translation stays on the camera's side
  // — the day the orbit target moves, a spin folded inside it would swing the
  // object around the target instead of turning it in place.
  public meshMatrix(): number[][] {
    return this.matrix3D.multiply(this.viewMatrix(), this.spinMatrix);
  }

  // Seconds, not frames. The old path applied a fixed angle per rendered frame,
  // which made the turntable run at whatever rate the display happened to offer
  // and at half speed under the RENDER tab's 30fps cap. The caller clamps a long
  // gap so a backgrounded tab does not snap the shape on return.
  public advance(elapsedSeconds: number) {
    const preset = this.preset;

    // Both step, every frame. The ease writes the camera and the turntable
    // writes the object, so a preset now lands exactly on the angle its chip
    // names no matter how long the shape has been spinning — which is what the
    // old early return was buying by freezing the tumble for 350ms.
    if (preset) {
      this.stepPreset(preset, elapsedSeconds);
    }

    const spun = this.spinDegreesPerSecond * elapsedSeconds;

    this.spinMatrix = this.matrix3D.multiply(this.deltaSpin(spun), this.spinMatrix);
  }

  // `animated` is the loop's run state, because an ease is a sequence of frames
  // and a stopped loop has none: advance() is what steps this, and it is never
  // called while the console is paused. A paused preset therefore lands in the
  // single repaint the chip triggers, which is the only thing it can do that is
  // not "nothing".
  public applyPreset(key: ViewPresetKey, animated: boolean) {
    const angles = viewPresets[key];
    // Where the shape actually is, spin included. Folding the accumulator into
    // the starting yaw and zeroing it below is what makes the destination
    // absolute — otherwise the ease would land on the preset plus whatever the
    // turntable had wound up.
    const fromYaw = this.yawDegrees;
    const preset: PresetTween = {
      from: { pitch: this.pitchDegrees, yaw: fromYaw, roll: this.rollDegrees },
      // Yaw is the only unbounded angle here, so it is the only one that can be
      // 350° from a destination that is 10° away. Normalising the delta rather
      // than the destination is what sends the ease the short way round.
      to: { pitch: angles.pitch, yaw: fromYaw + normaliseDegrees(angles.yaw - fromYaw), roll: angles.roll },
      elapsedSeconds: 0,
    };

    this.preset = preset;

    if (!animated) {
      this.stepPreset(preset, PRESET_DURATION_SECONDS);
    }
  }

  public setAngles(angles: Partial<RigAngles>) {
    // An angle write ends a preset in flight — the ease would otherwise keep
    // writing the angle the user is dragging, leaving the thumb and the shape
    // disagreeing for the rest of the 350ms. SPIN is not an angle write: it
    // moves the turntable, which the ease no longer touches.
    if (angles.pitch !== undefined || angles.yaw !== undefined || angles.roll !== undefined) {
      this.preset = null;
    }

    this.pitchDegrees = angles.pitch ?? this.pitchDegrees;
    this.yawDegrees = angles.yaw ?? this.yawDegrees;
    this.rollDegrees = angles.roll ?? this.rollDegrees;
    this.spinDegreesPerSecond = angles.spinRate ?? this.spinDegreesPerSecond;
  }

  // The two values RESET cannot reach through the store. The three angles and
  // the spin rate are slices, so they come back through setAngles when the
  // TRANSFORM rows read their defaults; the accumulator and an in-flight ease
  // are engine state with no row of their own.
  public reset() {
    this.zeroSpin();
    this.preset = null;
  }

  // The projection is `scale = fl / (fl + z + zOffset)`, so the eye sits where
  // that denominator vanishes: `d` in front of the projection plane, looking
  // down +z. The caller owns `d` because the camera owns the focal length and
  // the zoom curve, and E2 redefines it as `fl / k` — a second derivation here
  // is how the HUD ends up describing a projection the renderer is not using.
  //
  // eye = target + Rᵀ·[0, 0, -d], and Rᵀ's third column is R's third row, so
  // this is three multiplies rather than a transpose.
  public eyePosition(distance: number): Vector3 {
    const rotation = this.cameraRotation();
    const target = this.targetPosition;

    return {
      x: target.x - distance * rotation[2][0],
      y: target.y - distance * rotation[2][1],
      z: target.z - distance * rotation[2][2],
    };
  }

  // What the TRANSFORM rows show, which is not what the readouts show: the spin
  // accumulator is deliberately absent, because SPIN is its own row and a YAW
  // thumb sweeping the track on its own would be describing a control the user
  // is not touching. Normalised because a range input cannot wrap — a preset or,
  // once E1b lands, a drag past 180° makes the thumb jump end to end, which is
  // the least surprising of the things a slider can do about it.
  public angles(): EulerDegrees {
    return {
      pitch: normaliseDegrees(this.pitchDegrees),
      yaw: normaliseDegrees(this.yawDegrees),
      roll: normaliseDegrees(this.rollDegrees),
    };
  }

  // R · e_j is column j of R, and the gizmo draws an orthographic view of that
  // basis — so the screen direction of an axis is the column's first two rows
  // and its foreshortening is their length: 1 when the axis lies in the screen
  // plane, 0 when it points straight at the eye.
  public axisScreenDirections(): AxisScreenDirection[] {
    const rotation = this.cameraRotation();

    return AXIS_COLUMNS.map((column) => ({
      angleRadians: Math.atan2(rotation[1][column], rotation[0][column]),
      foreshortening: Math.hypot(rotation[0][column], rotation[1][column]),
    }));
  }

  // Rebuilt per call rather than cached. Two calls a frame at worst — the
  // matrix and the gizmo — against roughly 200 flops each, next to the 48k the
  // vertex pass costs on the largest mesh. A cache would have to be invalidated
  // by spin, presets, sliders, RESET and, once E1b lands, every pointer move.
  private stepPreset(preset: PresetTween, elapsedSeconds: number) {
    preset.elapsedSeconds += elapsedSeconds;

    const progress = Math.min(1, preset.elapsedSeconds / PRESET_DURATION_SECONDS);
    const eased = easeInOutCubic(progress);

    this.pitchDegrees = lerp(preset.from.pitch, preset.to.pitch, eased);
    this.yawDegrees = lerp(preset.from.yaw, preset.to.yaw, eased);
    this.rollDegrees = lerp(preset.from.roll, preset.to.roll, eased);

    if (progress === 1) {
      this.preset = null;
    }
  }

  // The viewpoint alone, with no turntable in it. Kept separate from rotation()
  // because the background pass needs the camera's own attitude, not the
  // camera's attitude times whatever the spin has wound up to.
  private cameraRotation(): number[][] {
    const pitch = this.matrix3D.pitchMatrix(this.pitchDegrees);
    const yaw = this.matrix3D.yawMatrix(this.yawDegrees);
    const roll = this.matrix3D.rollMatrix(this.rollDegrees);

    // roll · pitch · yaw, not roll · yaw · pitch. Under the old order the
    // horizon's normal C·e_y depended on yaw, so at the resting 30/45 pose the
    // horizon sat 22° off level while the ROLL row read 0° and a horizontal
    // drag rolled it. This order gives offset = f·tan(pitch) and tilt = roll,
    // both untouched by yaw. FRNT, BACK, SIDE and TOP are bit-identical either
    // way, since R_pitch(0) = I and TOP's yaw is 0; only the ISO-like resting
    // pose moves, and it moves toward a true isometric.
    return this.matrix3D.multiply(roll, this.matrix3D.multiply(pitch, yaw));
  }

  // One frame's worth of turntable: a single rotation about the fixed spin axis,
  // multiplied into the accumulator rather than rebuilt from a running angle.
  // Both halves matter — rebuilding from angles makes the axis wander, and
  // composing three per-axis deltas makes it depend on the frame rate.
  private deltaSpin(degrees: number): number[][] {
    return this.matrix3D.axisAngleMatrix(SPIN_AXIS_PITCH, SPIN_AXIS_YAW, SPIN_AXIS_ROLL, degrees * SPIN_AXIS_LENGTH);
  }

  private zeroSpin() {
    this.spinMatrix = this.matrix3D.identity();
  }
}

export default CameraRig;
