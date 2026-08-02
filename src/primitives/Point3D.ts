import Point2D from "@primitives/Point2D";
import type Viewport from "@primitives/Viewport";

class Point3D {
  private x: number;
  private y: number;
  private z: number;
  // Public because Triangle writes them from outside, through changeFocal and
  // changeOffsetZ, which is what the camera drives them with.
  //
  // 300 is also CameraController's DEFAULT_FOCAL_LENGTH, declared there
  // independently: two copies of one number. Recorded rather than unified,
  // because a mesh built before the camera has been applied projects at this
  // value and the two must move together or not at all.
  public fl: number = 300;
  public zOffset: number = 0;
  private readonly vpX: number;
  private readonly vpY: number;

  // The viewport is read once here and its two numbers copied, not held. That is
  // today's behaviour kept exactly: a mesh already on screen keeps projecting
  // about the centre it was built with, and a later canvas resize does not move
  // it. Following the resize would be an improvement, and it belongs to the
  // ticket that owns resizing rather than to this one.
  constructor(x: number, y: number, z: number, viewport: Viewport) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vpX = viewport.x;
    this.vpY = viewport.y;
  }

  public get zValue(): number {
    return this.z;
  }

  public convert3D2D(): Point2D {
    const scale = this.fl / (this.fl + this.z + this.zOffset);
    const tmpX = this.vpX + this.x * scale;
    const tmpY = this.vpY + this.y * scale;

    return new Point2D(tmpX, tmpY);
  }

  // Mutates in place and returns nothing. The three coordinates are read into
  // locals first because the second row of the rotation needs the unrotated x,
  // so assigning as we go would feed each row the previous row's output.
  public transformPt(rot: number[][]) {
    const x =
      rot[0][0] * this.x + rot[0][1] * this.y + rot[0][2] * this.z + rot[0][3];
    const y =
      rot[1][0] * this.x + rot[1][1] * this.y + rot[1][2] * this.z + rot[1][3];
    const z =
      rot[2][0] * this.x + rot[2][1] * this.y + rot[2][2] * this.z + rot[2][3];

    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export default Point3D;
