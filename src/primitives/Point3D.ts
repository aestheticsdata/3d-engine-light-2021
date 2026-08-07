import Point2D from "@primitives/Point2D";

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

class Point3D {
  private x: number;
  private y: number;
  private z: number;
  // Held, not copied, and that is why convert3D2D differs from the render
  // target below: the projection is one shared record every vertex reads
  // through, so a slider writes one number rather than two fields on each of
  // 3960 points. A mesh built before the camera has moved therefore cannot
  // project at a stale focal length — there is only ever one.
  private readonly camera: Camera;
  // Held as well, past construction (COS-418/E2b) — not for convert3D2D,
  // which still reads only the cached numbers below, but so withPosition can
  // build a sibling point sharing this one's exact projection basis. A
  // near-plane clip fragment is a vertex with no registry entry to rebuild
  // from every frame the way setFromSource does; it is built fresh instead,
  // from whichever of its parent's own vertices withPosition is called on.
  private readonly renderTarget: RenderTarget;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly targetScale: number;
  // The vertex as the registry authored it, kept for the life of the mesh. It is
  // what makes an orientation absolute rather than accumulated: every frame
  // rebuilds x/y/z from these three, so a pose is a matrix rather than a history
  // and the shape can be returned to exactly. Three doubles per vertex, which on
  // the largest mesh in the registry — the torus knot's 3960 — is about 95 KB.
  private readonly sx: number;
  private readonly sy: number;
  private readonly sz: number;

  // The render target's three numbers are read once here and cached below;
  // convert3D2D reads only the cache, which is what keeps a mesh already on
  // screen projecting about the centre and scale it was built with — a later
  // resize does not move it, and following one would be an improvement that
  // belongs to the ticket that owns resizing (E9b) rather than to this one.
  constructor(x: number, y: number, z: number, renderTarget: RenderTarget, camera: Camera) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.sx = x;
    this.sy = y;
    this.sz = z;
    this.renderTarget = renderTarget;
    this.centerX = renderTarget.centerX;
    this.centerY = renderTarget.centerY;
    this.targetScale = renderTarget.scale;
    this.camera = camera;
  }

  // All three, at last. z has been readable since the painter's sort needed a
  // depth; x and y stayed private because nothing outside could use them for
  // anything but a second projection. E3a is what changed that — a face normal
  // is a cross product of two edges, and an edge needs all three components of
  // both ends. E6 left these to "whichever of E3a or E5b lands first and
  // actually needs it" (MeshFactory.build); this is that ticket, and E5b's
  // Mesh.getBounds reads the same two rather than declaring a third.
  public get xValue(): number {
    return this.x;
  }

  public get yValue(): number {
    return this.y;
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
  // the point does the same multiply either way. The render-target scale
  // multiplies in after that divide, never before — Camera owns nothing about
  // resolution, and multiplying rather than folding it into the focal is what
  // keeps vertical field of view constant at any render-target size.
  public convert3D2D(): Point2D {
    const scale = this.camera.scaleAt(this.z) * this.targetScale;
    const tmpX = this.centerX + this.x * scale;
    const tmpY = this.centerY + this.y * scale;

    return new Point2D(tmpX, tmpY);
  }

  // A sibling point at a new position, under the same camera and render
  // target this one holds — the one thing Triangle.emitFragment needs to
  // turn nearPlaneClip's plain {x,y,z} back into something convert3D2D can
  // project, without Triangle ever needing a RenderTarget or Camera
  // reference of its own.
  public withPosition(x: number, y: number, z: number): Point3D {
    return new Point3D(x, y, z, this.renderTarget, this.camera);
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
