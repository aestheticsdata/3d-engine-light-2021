// The shape's own attitude: where it rests, and the turntable it rests on.
//
// It is the half of CameraRig that was never about the camera. The accumulator
// lived there because E1a built the rig before the shape had any orientation of
// its own, and E1b then gave the camera a mouse without anyone revisiting it —
// so the class named after the viewpoint was still holding the object's motion.
// This is that half, moved out.
//
// Spin accumulates as a MATRIX rather than as three angles, and that
// distinction is the whole motion. The per-frame rate sliders this replaced
// multiplied a fixed small delta into the already-rotated points every frame —
// a constant angular velocity about a fixed axis, which reads as one smooth
// tumble. Growing three Euler angles linearly and recomposing them each frame is
// a different motion entirely: the effective axis wanders as the angles grow, so
// the solid appears to turn one way, then another, then another. Compose the
// delta; do not accumulate the angles.
//
// matrix() is S · O — the pose first, then the turntable — and the order is the
// decision, not an accident. O puts the shape where the rows say, and S spins
// that posed shape about the world-fixed axis SPIN names. Under O · S the axis
// itself would tilt whenever PITCH moved, which is a turntable whose platter
// tips when you reposition the object standing on it.
//
// None of the three angles is clamped. The rows keep their own ±180 range — a
// range input has to be bounded — and saturate against an angle that carries on.
//
// Angles are degrees, in and out. Matrix3D converts internally, so a
// `180 / Math.PI` anywhere in this file is a bug.

import Matrix3D from "@primitives/Matrix3D";

// Every value a control can write. Partial at the call site so one slider moves
// one number without the caller having to restate the other three.
export interface ShapeAngles {
  pitch: number;
  yaw: number;
  roll: number;
  spinRate: number;
}

// The turntable's angular velocity, as a direction. SPIN names the yaw
// component — the fastest of the three and the one the row is scaled in — and
// these are the other two against it, taken from the per-frame rates this
// replaced (87.3 and 48.0 against yaw's 122.2 °/s). Together they are the fixed
// axis the solid tumbles about; SPIN only scales how fast it goes round it.
const SPIN_AXIS_PITCH = 87.3 / 122.2;
const SPIN_AXIS_YAW = 1;
const SPIN_AXIS_ROLL = 48 / 122.2;
// |(pitch, yaw, roll)|, so a SPIN of 122 °/s means 122 °/s of *yaw* rather than
// 122 °/s about the tilted axis — which is what makes the row's number mean the
// same thing it did before the other two axes came back.
const SPIN_AXIS_LENGTH = Math.sqrt(SPIN_AXIS_PITCH ** 2 + SPIN_AXIS_YAW ** 2 + SPIN_AXIS_ROLL ** 2);

class ShapeRig {
  private readonly matrix3D: Matrix3D;
  private pitchDegrees: number;
  private yawDegrees: number;
  private rollDegrees: number;
  private spinDegreesPerSecond: number;
  private spinMatrix: number[][];

  constructor() {
    this.matrix3D = new Matrix3D();
    this.pitchDegrees = 0;
    this.yawDegrees = 0;
    this.rollDegrees = 0;
    this.spinDegreesPerSecond = 0;
    this.spinMatrix = this.matrix3D.identity();
  }

  // What the camera is handed to build the mesh matrix with.
  public matrix(): number[][] {
    return this.matrix3D.multiply(this.spinMatrix, this.pose());
  }

  // Seconds, not frames. The old path applied a fixed angle per rendered frame,
  // which made the turntable run at whatever rate the display happened to offer
  // and at half speed under the RENDER tab's 30fps cap. The caller clamps a long
  // gap so a backgrounded tab does not snap the shape on return.
  public advance(elapsedSeconds: number) {
    const spun = this.spinDegreesPerSecond * elapsedSeconds;

    this.spinMatrix = this.matrix3D.multiply(this.deltaSpin(spun), this.spinMatrix);
  }

  public setAngles(angles: Partial<ShapeAngles>) {
    this.pitchDegrees = angles.pitch ?? this.pitchDegrees;
    this.yawDegrees = angles.yaw ?? this.yawDegrees;
    this.rollDegrees = angles.roll ?? this.rollDegrees;
    this.spinDegreesPerSecond = angles.spinRate ?? this.spinDegreesPerSecond;
  }

  // The one value RESET cannot reach through the store. The three angles and the
  // spin rate are slices, so they come back through setAngles when the TRANSFORM
  // rows read their defaults; the accumulator has no row of its own.
  public reset() {
    this.spinMatrix = this.matrix3D.identity();
  }

  // roll · pitch · yaw, the same composition the camera builds its own attitude
  // with, so a shape pitched 30° reads as the mirror of a camera elevated 30°
  // rather than as some third convention the console would then have to explain.
  private pose(): number[][] {
    const pitch = this.matrix3D.pitchMatrix(this.pitchDegrees);
    const yaw = this.matrix3D.yawMatrix(this.yawDegrees);
    const roll = this.matrix3D.rollMatrix(this.rollDegrees);

    return this.matrix3D.multiply(roll, this.matrix3D.multiply(pitch, yaw));
  }

  // One frame's worth of turntable: a single rotation about the fixed spin axis,
  // multiplied into the accumulator rather than rebuilt from a running angle.
  // Both halves matter — rebuilding from angles makes the axis wander, and
  // composing three per-axis deltas makes it depend on the frame rate.
  private deltaSpin(degrees: number): number[][] {
    return this.matrix3D.axisAngleMatrix(SPIN_AXIS_PITCH, SPIN_AXIS_YAW, SPIN_AXIS_ROLL, degrees * SPIN_AXIS_LENGTH);
  }
}

export default ShapeRig;
