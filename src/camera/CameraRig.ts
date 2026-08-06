// The camera's absolute orientation, and the eye position that orientation
// implies.
//
// The engine has no camera matrix — Point3D.convert3D2D is a bare perspective
// divide about a focal length — so this rig turns the world instead, which
// produces the same picture. Rotating the world by R is exactly rotating the
// camera by its transpose, and because R is orthonormal that transpose is the
// inverse, so the eye position falls out of the same matrix the frame is drawn
// with. No readout here can describe a camera the renderer is not using.
//
// The shape's own attitude is not here. It is ShapeRig, which owns the rest pose
// and the turntable spin; this class composes with whatever that hands it and
// knows nothing else about the object. The spin lived here until COS-434, from
// back when E1a built the rig before the shape had any orientation of its own.
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
// one number without the caller having to restate the other two.
export interface CameraAngles {
  pitch: number;
  yaw: number;
  roll: number;
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
  private preset: PresetTween | null;

  constructor() {
    this.matrix3D = new Matrix3D();
    this.targetPosition = { x: 0, y: 0, z: 0 };
    this.pitchDegrees = 0;
    this.yawDegrees = 0;
    this.rollDegrees = 0;
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

  // The camera alone, with no shape in it — what the background pass needs to
  // draw a ground and a horizon the viewpoint agrees with.
  public viewMatrix(): number[][] {
    const target = this.targetPosition;

    return this.matrix3D.multiply(this.cameraRotation(), this.matrix3D.translation(-target.x, -target.y, -target.z));
  }

  // What a mesh is drawn with: the shape's own attitude, then the camera.
  // Composed as (C·T)·O rather than (C·O)·T so the translation stays on the
  // camera's side — the day the orbit target moves, a pose folded inside it
  // would swing the object around the target instead of turning it in place.
  //
  // The object matrix is handed in rather than held, because where the shape is
  // pointing is ShapeRig's business. This class knows only that something is
  // being viewed.
  public meshMatrix(objectMatrix: number[][]): number[][] {
    return this.matrix3D.multiply(this.viewMatrix(), objectMatrix);
  }

  // Seconds, not frames: the ease has to land in the same wall-clock time at any
  // rate the RENDER tab's cap can select. The turntable used to be stepped here
  // too, and a preset no longer has to freeze it — the ease writes the camera and
  // the spin writes the object, so the two cannot fight over an angle.
  public advance(elapsedSeconds: number) {
    const preset = this.preset;

    if (preset) {
      this.stepPreset(preset, elapsedSeconds);
    }
  }

  // `animated` is the loop's run state, because an ease is a sequence of frames
  // and a stopped loop has none: advance() is what steps this, and it is never
  // called while the console is paused. A paused preset therefore lands in the
  // single repaint the chip triggers, which is the only thing it can do that is
  // not "nothing".
  public applyPreset(key: ViewPresetKey, animated: boolean) {
    const angles = viewPresets[key];
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

  // Every write here is an angle write, so a preset in flight ends
  // unconditionally: the ease would otherwise keep writing the angle the user is
  // dragging, leaving the thumb and the camera disagreeing for the rest of the
  // 350ms. The guard this used to need was for SPIN, which is ShapeRig's now.
  public setAngles(angles: Partial<CameraAngles>) {
    this.preset = null;

    this.pitchDegrees = angles.pitch ?? this.pitchDegrees;
    this.yawDegrees = angles.yaw ?? this.yawDegrees;
    this.rollDegrees = angles.roll ?? this.rollDegrees;
  }

  // The one value RESET cannot reach through the store: an ease in flight is
  // engine state with no row of its own. The three angles are slices, so they
  // come back through setAngles when the CAMERA rows read their defaults.
  public reset() {
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

  // What the CAMERA rows and the `cam.rot` readout both show. Normalised because
  // a range input cannot wrap — a preset or a drag past 180° makes the thumb jump
  // end to end, which is the least surprising of the things a slider can do about
  // it.
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

  // Rebuilt per call rather than cached. A handful of calls a frame — the mesh
  // matrix, the background's view matrix, the eye position and the gizmo — at
  // roughly 200 flops each, next to the 48k the vertex pass costs on the largest
  // mesh. A cache would have to be invalidated by presets, sliders, RESET and
  // every pointer move.
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
}

export default CameraRig;
