import Point2D from "@primitives/Point2D";

import type Camera from "@primitives/Camera";
import type Viewport from "@primitives/Viewport";

class Point3D {
  private x: number;
  private y: number;
  private z: number;
  // Held, not copied, and that is the difference from the viewport below: the
  // projection is one shared record every vertex reads through, so a slider
  // writes one number rather than two fields on each of 3960 points. A mesh
  // built before the camera has moved therefore cannot project at a stale
  // focal length — there is only ever one.
  private readonly camera: Camera;
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
  constructor(x: number, y: number, z: number, viewport: Viewport, camera: Camera) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.sx = x;
    this.sy = y;
    this.sz = z;
    this.vpX = viewport.x;
    this.vpY = viewport.y;
    this.camera = camera;
  }

  public get zValue(): number {
    return this.z;
  }

  // Outside the view volume, which is the camera's question rather than the
  // point's: it owns the two planes and the depth the projection divides by.
  public get isClipped(): boolean {
    return this.camera.clips(this.z);
  }

  // Both projections in one call, because the branch is the camera's and not
  // this vertex's: perspective divides by the depth, orthographic does not, and
  // the point does the same multiply either way.
  public convert3D2D(): Point2D {
    const scale = this.camera.scaleAt(this.z);
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
