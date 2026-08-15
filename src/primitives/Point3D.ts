import Point2D from "@primitives/Point2D";

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

// A projected vertex, written into rather than returned (E7c/HAL-123), so a
// caller that wants the two numbers and not an object can have them without one
// being built for it. Mesh.projectedBounds reads a pair of these per frame off
// points it constructs for the purpose, and never keeps them.
export interface ScreenPoint {
  x: number;
  y: number;
}

class Point3D {
  private x: number;
  private y: number;
  private z: number;
  // Held, not copied: the projection is one shared record every vertex reads
  // through, so a slider writes one number rather than two fields on each of
  // 3960 points. A mesh built before the camera has moved therefore cannot
  // project at a stale focal length — there is only ever one.
  private readonly camera: Camera;
  // Held the same way, since E9b/COS-250: convert3D2D reads its centre and
  // scale live, which is what lets a resize reach a mesh already on screen
  // without rebuilding it. Also what lets withPosition build a sibling point
  // sharing this one's exact projection basis — a near-plane clip fragment is
  // a vertex with no registry entry to rebuild from every frame the way
  // setFromSource does, so it is built fresh instead, from whichever of its
  // parent's own vertices withPosition is called on.
  private readonly renderTarget: RenderTarget;
  // The vertex as the registry authored it, kept for the life of the mesh. It is
  // what makes an orientation absolute rather than accumulated: every frame
  // rebuilds x/y/z from these three, so a pose is a matrix rather than a history
  // and the shape can be returned to exactly. Three doubles per vertex, which on
  // the largest mesh in the registry — the torus knot's 3960 — is about 95 KB.
  private readonly sx: number;
  private readonly sy: number;
  private readonly sz: number;
  // convert3D2D's own scratch, held rather than allocated per call: delegating
  // to project() below must not double the garbage the per-triangle path makes,
  // which is three of these calls per face per frame — 23760 on the torus knot.
  // Sixteen bytes a vertex, against the 95 KB of source coordinates above.
  private readonly projected: ScreenPoint;

  constructor(x: number, y: number, z: number, renderTarget: RenderTarget, camera: Camera) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.sx = x;
    this.sy = y;
    this.sz = z;
    this.renderTarget = renderTarget;
    this.camera = camera;
    this.projected = { x: 0, y: 0 };
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

  // The depth buffer (E3b/COS-242) stores the reciprocal of this plus
  // Camera.distance — Triangle.rasterVertices reads it directly rather than
  // through a new getter, since eyeDistance is already threaded the same way
  // NearClipContext threads it to clipToNear.
  public get zValue(): number {
    return this.z;
  }

  // Outside the view volume, which is the camera's question rather than the
  // point's: it owns the two planes and the depth the projection divides by.
  public get isClipped(): boolean {
    return this.camera.clips(this.z);
  }

  // project() below, in the immutable pair its callers hold on to: Triangle
  // keeps three of these per face between the projection pass and the raster
  // one, and a shared scratch record cannot survive being read a loop later.
  //
  // The delegation is not free, and the number is measured rather than assumed
  // (E7c/HAL-123). Against an inlined second copy of the formula it costs about
  // 0.08ms of TRANSFORM per frame on the registry's heaviest mesh — 0.78 against
  // 0.71 at 48008 triangles — and nothing at all on the frame, which sits on
  // vsync at 16.7ms either way. Removing the clip test from project() recovers
  // none of it; the call itself is the cost. That is the price of the projection
  // existing once, and it is the right way round: two copies would diverge the
  // first time the projection gains a term, silently and in one of them.
  public convert3D2D(): Point2D {
    this.project(this.projected);

    return new Point2D(this.projected.x, this.projected.y);
  }

  // The projection, and the only copy of it.
  //
  // Both modes in one call, because the branch is the camera's and not this
  // vertex's: perspective divides by the depth, orthographic does not, and the
  // point does the same multiply either way. The render-target scale multiplies
  // in after that divide, never before — Camera owns nothing about resolution,
  // and multiplying rather than folding it into the focal is what keeps vertical
  // field of view constant at any render-target size.
  //
  // The return is the view-volume answer rather than a did-it-work flag, and the
  // coordinates are written either way. That asymmetry is deliberate: a vertex
  // the near plane rejects still has to project, because Triangle.clipToNear
  // splits a straddling face at the plane using coordinates that must already
  // exist. It is E2's own test (Camera.clips) rather than a second
  // `denominator > 0` beside it — one view volume, asked once.
  public project(out: ScreenPoint): boolean {
    const scale = this.camera.scaleAt(this.z) * this.renderTarget.scale;

    out.x = this.renderTarget.centerX + this.x * scale;
    out.y = this.renderTarget.centerY + this.y * scale;

    return !this.camera.clips(this.z);
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
