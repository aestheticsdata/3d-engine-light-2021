// The scene's absolute orientation, and the camera that orientation implies.
//
// The engine has no camera matrix — Point3D.convert3D2D is a bare perspective
// divide about a focal length — so this rig turns the world instead, which
// produces the same picture. Rotating the world by R is exactly rotating the
// camera by its transpose, and because R is orthonormal that transpose is the
// inverse, so the eye position falls out of the same matrix the frame is drawn
// with. No readout here can describe a camera the renderer is not using.
//
// Spin is an accumulator added to yaw rather than a mutation of it, so the two
// compose the way a turntable does: a preset or a drag moves the viewpoint and
// the spin keeps running from wherever it was left.
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

const PITCH_LIMIT_DEGREES = 89;
const PRESET_DURATION_SECONDS = 0.35;
const HALF_TURN_DEGREES = 180;
const FULL_TURN_DEGREES = 360;
// The three object axes, as column indices into R. Named rather than written as
// a literal at both call sites, because the gizmo's X/Y/Z order is the same
// order and the two must not drift.
const AXIS_COLUMNS = [0, 1, 2];

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
  private spinDegrees: number;
  private preset: PresetTween | null;

  constructor() {
    this.matrix3D = new Matrix3D();
    this.targetPosition = { x: 0, y: 0, z: 0 };
    this.pitchDegrees = 0;
    this.yawDegrees = 0;
    this.rollDegrees = 0;
    this.spinDegreesPerSecond = 0;
    this.spinDegrees = 0;
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
  public matrix(): number[][] {
    const target = this.targetPosition;

    return this.matrix3D.multiply(this.rotation(), this.matrix3D.translation(-target.x, -target.y, -target.z));
  }

  // Seconds, not frames. The old path applied a fixed angle per rendered frame,
  // which made the turntable run at whatever rate the display happened to offer
  // and at half speed under the RENDER tab's 30fps cap. The caller clamps a long
  // gap so a backgrounded tab does not snap the shape on return.
  public advance(elapsedSeconds: number) {
    const preset = this.preset;

    // The turntable is held still for the length of an ease. Letting spin
    // accumulate through it would land the shape a few degrees past the angle
    // the chip names, and being exact is the one thing a preset is for.
    if (preset) {
      this.stepPreset(preset, elapsedSeconds);

      return;
    }

    this.spinDegrees += this.spinDegreesPerSecond * elapsedSeconds;
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
    const fromYaw = this.yawDegrees + this.spinDegrees;
    const preset: PresetTween = {
      from: { pitch: this.pitchDegrees, yaw: fromYaw, roll: this.rollDegrees },
      // Yaw is the only unbounded angle here, so it is the only one that can be
      // 350° from a destination that is 10° away. Normalising the delta rather
      // than the destination is what sends the ease the short way round.
      to: { pitch: angles.pitch, yaw: fromYaw + normaliseDegrees(angles.yaw - fromYaw), roll: angles.roll },
      elapsedSeconds: 0,
    };

    this.preset = preset;
    this.spinDegrees = 0;

    if (!animated) {
      this.stepPreset(preset, PRESET_DURATION_SECONDS);
    }
  }

  public setAngles(angles: Partial<RigAngles>) {
    // Any TRANSFORM input ends a preset in flight, SPIN included. The ease would
    // otherwise keep writing the angle the user is dragging, leaving the thumb
    // and the shape disagreeing for the rest of the 350ms.
    this.preset = null;

    this.pitchDegrees = this.clampPitch(angles.pitch ?? this.pitchDegrees);
    this.yawDegrees = angles.yaw ?? this.yawDegrees;
    this.rollDegrees = angles.roll ?? this.rollDegrees;
    this.spinDegreesPerSecond = angles.spinRate ?? this.spinDegreesPerSecond;
  }

  // The two values RESET cannot reach through the store. The three angles and
  // the spin rate are slices, so they come back through setAngles when the
  // TRANSFORM rows read their defaults; the accumulator and an in-flight ease
  // are engine state with no row of their own.
  public reset() {
    this.spinDegrees = 0;
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
    const rotation = this.rotation();
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
      pitch: this.pitchDegrees,
      yaw: normaliseDegrees(this.yawDegrees),
      roll: normaliseDegrees(this.rollDegrees),
    };
  }

  public eulerDegrees(): EulerDegrees {
    return {
      pitch: normaliseDegrees(this.pitchDegrees),
      yaw: normaliseDegrees(this.yawDegrees + this.spinDegrees),
      roll: normaliseDegrees(this.rollDegrees),
    };
  }

  // R · e_j is column j of R, and the gizmo draws an orthographic view of that
  // basis — so the screen direction of an axis is the column's first two rows
  // and its foreshortening is their length: 1 when the axis lies in the screen
  // plane, 0 when it points straight at the eye.
  public axisScreenDirections(): AxisScreenDirection[] {
    const rotation = this.rotation();

    return AXIS_COLUMNS.map((column) => ({
      angleRadians: Math.atan2(rotation[1][column], rotation[0][column]),
      foreshortening: Math.hypot(rotation[0][column], rotation[1][column]),
    }));
  }

  // Rebuilt per call rather than cached. Two calls a frame at worst — the
  // matrix and the gizmo — against roughly 200 flops each, next to the 48k the
  // vertex pass costs on the largest mesh. A cache would have to be invalidated
  // by spin, presets, sliders, RESET and, once E1b lands, every pointer move.
  private rotation(): number[][] {
    const pitch = this.matrix3D.pitchMatrix(this.pitchDegrees);
    const yaw = this.matrix3D.yawMatrix(this.yawDegrees + this.spinDegrees);
    const roll = this.matrix3D.rollMatrix(this.rollDegrees);

    return this.matrix3D.multiply(roll, this.matrix3D.multiply(yaw, pitch));
  }

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

  private clampPitch(degrees: number): number {
    return Math.min(PITCH_LIMIT_DEGREES, Math.max(-PITCH_LIMIT_DEGREES, degrees));
  }
}

export default CameraRig;
