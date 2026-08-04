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
  // The vertex as the registry authored it, kept for the life of the mesh. It is
  // what makes an orientation absolute rather than accumulated: every frame
  // rebuilds x/y/z from these three, so a pose is a matrix rather than a history
  // and the shape can be returned to exactly. Three doubles per vertex, which on
  // the largest mesh in the registry — the torus knot's 3960 — is about 95 KB.
  private readonly sx: number;
  private readonly sy: number;
  private readonly sz: number;

  // The viewport is read once here and its two numbers copied, not held. That is
  // today's behaviour kept exactly: a mesh already on screen keeps projecting
  // about the centre it was built with, and a later canvas resize does not move
  // it. Following the resize would be an improvement, and it belongs to the
  // ticket that owns resizing rather than to this one.
  constructor(x: number, y: number, z: number, viewport: Viewport) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.sx = x;
    this.sy = y;
    this.sz = z;
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

  // Mutates in place and returns nothing. No temporaries, and that is the
  // difference from the incremental transform this replaces: the operands are
  // the source fields, which nothing ever writes, so a row cannot be fed the
  // previous row's output. Reading column 3 is what lets the matrix carry a
  // translation as well as a rotation — the rig's orbit target rides in it.
  public setFromSource(transform: number[][]) {
    this.x = transform[0][0] * this.sx + transform[0][1] * this.sy + transform[0][2] * this.sz + transform[0][3];
    this.y = transform[1][0] * this.sx + transform[1][1] * this.sy + transform[1][2] * this.sz + transform[1][3];
    this.z = transform[2][0] * this.sx + transform[2][1] * this.sy + transform[2][2] * this.sz + transform[2][3];
  }
}

export default Point3D;
