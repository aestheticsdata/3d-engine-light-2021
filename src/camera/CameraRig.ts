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
// compose the way a turntable does: whatever moves the viewpoint moves it, and
// the spin keeps running from wherever it was left.
//
// Angles are degrees everywhere, in and out. Matrix3D converts internally and
// the gizmo hands CSS the radians atan2 already returns, so a `180 / Math.PI`
// anywhere in this file or its readers is a bug.

import Matrix3D from "@primitives/Matrix3D";

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

// Every value a control can write. Partial at the call site so one slider moves
// one number without the caller having to restate the other three.
// One axis of the gizmo: where it points on screen, and how much of its length
// survives the projection. Radians because that is what atan2 returns and what
// CSS accepts as `rad`.
export interface AxisScreenDirection {
  angleRadians: number;
  foreshortening: number;
}

export interface RigAngles {
  pitch: number;
  yaw: number;
  roll: number;
  spinRate: number;
}

const PITCH_LIMIT_DEGREES = 89;
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

  constructor() {
    this.matrix3D = new Matrix3D();
    this.targetPosition = { x: 0, y: 0, z: 0 };
    this.pitchDegrees = 0;
    this.yawDegrees = 0;
    this.rollDegrees = 0;
    this.spinDegreesPerSecond = 0;
    this.spinDegrees = 0;
  }

  // The live object, not a copy. It is one of this rig's own fields and nothing
  // outside writes it; copying it per frame for a caller that does not exist is
  // the defensive allocation Mesh already refuses to make.
  public get target(): Readonly<Vector3> {
    return this.targetPosition;
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
    this.spinDegrees += this.spinDegreesPerSecond * elapsedSeconds;
  }

  public setAngles(angles: Partial<RigAngles>) {
    this.pitchDegrees = this.clampPitch(angles.pitch ?? this.pitchDegrees);
    this.yawDegrees = angles.yaw ?? this.yawDegrees;
    this.rollDegrees = angles.roll ?? this.rollDegrees;
    this.spinDegreesPerSecond = angles.spinRate ?? this.spinDegreesPerSecond;
  }

  // The one value RESET cannot reach through the store. The three angles and the
  // spin rate are slices, so they come back through setAngles when the TRANSFORM
  // rows read their defaults; the spin the turntable has wound up is engine
  // state with no row of its own.
  public reset() {
    this.spinDegrees = 0;
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

  // Rebuilt per call rather than cached. Twice a frame at worst — the matrix and
  // the gizmo — against roughly 200 flops each, next to the 48k the vertex pass
  // costs on the largest mesh. A cache would have to be invalidated by spin,
  // sliders, RESET and, once E1b lands, every pointer move.
  private rotation(): number[][] {
    const pitch = this.matrix3D.pitchMatrix(this.pitchDegrees);
    const yaw = this.matrix3D.yawMatrix(this.yawDegrees + this.spinDegrees);
    const roll = this.matrix3D.rollMatrix(this.rollDegrees);

    return this.matrix3D.multiply(roll, this.matrix3D.multiply(yaw, pitch));
  }

  private clampPitch(degrees: number): number {
    return Math.min(PITCH_LIMIT_DEGREES, Math.max(-PITCH_LIMIT_DEGREES, degrees));
  }
}

export default CameraRig;
