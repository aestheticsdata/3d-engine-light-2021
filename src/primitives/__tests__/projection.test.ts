// The projection primitives, in the node environment and with no DOM in sight.
//
// That is the point of the file rather than an incidental detail: Point3D used
// to resolve the canvas itself, from a class-field initialiser, so importing it
// under vitest's node environment threw before a single assertion ran. These
// tests exist because they can now be written at all.
//
// The live-follow case is the one worth guarding (E9b/COS-250). Point3D holds
// the render target rather than copying its three numbers, the same way it
// already held the camera — so a resize reaches every mesh already on screen
// without anything rebuilding them, and dragging the window moves the picture
// instead of leaving it stranded at the size it was built at.

import cube from "@data/shapes/cube";
import sphere from "@data/shapes/sphere";
import Camera from "@primitives/Camera";
import Matrix3D from "@primitives/Matrix3D";
import Mesh from "@primitives/Mesh";
import Point3D from "@primitives/Point3D";
import RenderTarget from "@primitives/RenderTarget";
import Triangle from "@primitives/Triangle";
import { describe, expect, it } from "vitest";

import type { Object3D } from "@data/types";
import type { CameraOptions } from "@primitives/Camera";
import type { ProjectedBoundsPass } from "@primitives/Mesh";
import type { NearClipContext } from "@primitives/Triangle";

const renderTarget = () => new RenderTarget({ width: 1024, height: 640 });

// Focal 300 at magnification 1 puts the eye 300 out and leaves the centre plane
// at scale 1, which is what makes the projected numbers below readable by hand.
const cameraOf = (options: Partial<CameraOptions> = {}) => new Camera({ focal: 300, magnification: 1, ...options });

describe("RenderTarget", () => {
  it("halves width and height into the centre, rounding down on an odd dimension", () => {
    const odd = new RenderTarget({ width: 1025, height: 641 });

    expect(renderTarget().centerX).toBe(512);
    expect(renderTarget().centerY).toBe(320);
    expect(odd.centerX).toBe(512);
    expect(odd.centerY).toBe(320);
  });

  it("resolves scale to 1 at the seed dimensions", () => {
    expect(renderTarget().scale).toBe(1);
  });

  // Width plays no part in it — only height, because that is the axis the
  // vertical field-of-view identity is written against.
  it("derives scale from height relative to the reference height, independent of width", () => {
    const target = new RenderTarget({ width: 800, height: 480 });

    expect(target.scale).toBeCloseTo(480 / 640, 10);
  });

  // The exact case ShapeThumbnails depends on: pinning referenceHeight to the
  // target's own height is what keeps a differently-sized render target
  // behaving as though it had none at all.
  it("resolves scale to 1 when the reference height is pinned to the target's own height", () => {
    const target = new RenderTarget({ width: 88, height: 88, referenceHeight: 88 });

    expect(target.scale).toBe(1);
  });

  it("recomputes width, height, centre and scale on setSize, without moving the reference height", () => {
    const target = renderTarget();

    target.setSize(800, 480);

    expect(target.width).toBe(800);
    expect(target.height).toBe(480);
    expect(target.centerX).toBe(400);
    expect(target.centerY).toBe(240);
    // Still divided by 640, the reference the target opened with — setSize
    // moves the target's own size, not the world it was authored against.
    expect(target.scale).toBeCloseTo(480 / 640, 10);
  });
});

describe("convert3D2D", () => {
  it("puts the origin at the render target centre", () => {
    const point = new Point3D(0, 0, 0, renderTarget(), cameraOf());
    const projected = point.convert3D2D();

    expect(projected.x).toBe(512);
    expect(projected.y).toBe(320);
  });

  it("shrinks with distance and grows as the shape comes closer", () => {
    const camera = cameraOf();
    const near = new Point3D(100, 0, -150, renderTarget(), camera);
    const far = new Point3D(100, 0, 300, renderTarget(), camera);

    expect(near.convert3D2D().x).toBeGreaterThan(612);
    expect(far.convert3D2D().x).toBeLessThan(612);
  });

  it("follows the render target it was built with when it later resizes", () => {
    const target = renderTarget();
    const point = new Point3D(0, 0, 0, target, cameraOf());

    target.setSize(400, 200);

    // 400 >> 1 = 200: the new centre, not the 512 the point opened on.
    expect(point.convert3D2D().x).toBe(200);
  });

  // Why the camera record is shared rather than copied: a zoom used to be 3960
  // field writes on the torus knot, and a mesh built before the camera moved
  // projected at whatever that camera held when its vertices were constructed.
  it("follows the camera it was built with rather than a copy of it", () => {
    const camera = cameraOf();
    const point = new Point3D(100, 0, 0, renderTarget(), camera);

    expect(point.convert3D2D().x).toBe(612);

    camera.setMagnification(2);

    expect(point.convert3D2D().x).toBe(712);
  });

  // The composition this ticket introduces, and the reason it has to be tested
  // on both branches: Camera.scaleAt(z) already returns one final, fully-divided
  // number whichever mode it is in, and the render-target scale multiplies onto
  // that return value from outside — there is no divide left inside Camera for
  // it to hook into instead.
  it("multiplies the render-target scale in after the camera's own divide, in both projections", () => {
    // 320 / 640 = 0.5, chosen to be distinct from both 1 and the camera's own
    // scale, so a bug that multiplies by the wrong number cannot hide behind an
    // identity.
    const target = new RenderTarget({ width: 1024, height: 320 });
    const perspective = cameraOf();
    const orthographic = cameraOf({ mode: "ORTHOGRAPHIC", magnification: 0.75 });

    const perspectivePoint = new Point3D(100, 0, 50, target, perspective);
    const orthographicPoint = new Point3D(100, 0, 50, target, orthographic);

    expect(perspectivePoint.convert3D2D().x).toBeCloseTo(
      target.centerX + 100 * perspective.scaleAt(50) * target.scale,
      10,
    );
    expect(orthographicPoint.convert3D2D().x).toBeCloseTo(
      target.centerX + 100 * orthographic.scaleAt(50) * target.scale,
      10,
    );
  });
});

// The projection, written into a caller's record instead of a fresh Point2D
// (HAL-123). It exists so the selection bracket can fold 143 vertices without
// allocating 143 objects to read two numbers off; convert3D2D delegates to it,
// so these cases are also what pins that the two cannot drift apart.
describe("Point3D.project", () => {
  it("writes the same coordinates convert3D2D returns", () => {
    const point = new Point3D(100, 50, 0, renderTarget(), cameraOf());
    const out = { x: 0, y: 0 };

    point.project(out);

    expect(out.x).toBe(point.convert3D2D().x);
    expect(out.y).toBe(point.convert3D2D().y);
    expect(out.x).toBe(612);
    expect(out.y).toBe(370);
  });

  it("reports whether the vertex survives the view volume, near and far", () => {
    // The eye sits at fl/k = 300, so z = -350 is 50 units behind it and z =
    // 4800 is past far — the two ends Camera.clips already draws.
    const camera = cameraOf();
    const inside = new Point3D(0, 0, 0, renderTarget(), camera);
    const behind = new Point3D(0, 0, -350, renderTarget(), camera);
    const beyond = new Point3D(0, 0, 4800, renderTarget(), camera);
    const out = { x: 0, y: 0 };

    expect(inside.project(out)).toBe(true);
    expect(behind.project(out)).toBe(false);
    expect(beyond.project(out)).toBe(false);
  });

  // convert3D2D has always projected a clipped vertex rather than refusing to,
  // and Triangle.project relies on it: clipToNear splits at the plane using
  // coordinates that must already exist. Delegation must not quietly add a
  // guard the old path did not have.
  it("still writes coordinates for a vertex it reports as clipped", () => {
    const point = new Point3D(100, 0, -350, renderTarget(), cameraOf());
    const out = { x: 0, y: 0 };

    expect(point.project(out)).toBe(false);
    expect(out.x).toBe(point.convert3D2D().x);
    expect(Number.isFinite(out.x)).toBe(true);
  });

  it("reuses the record it is given rather than returning a new one", () => {
    const point = new Point3D(100, 50, 0, renderTarget(), cameraOf());
    const out = { x: -1, y: -1 };

    expect(point.project(out)).toBe(true);
    expect(out).toEqual({ x: 612, y: 370 });
  });
});

// The box behind the viewport's selection bracket (HAL-123, resized by HAL-124).
//
// It is deliberately NOT the tight per-frame AABB of the projected vertices. A
// rotating solid's screen box genuinely changes size every frame, so a bracket
// that tracked it exactly breathed and dragged its label along with it — which
// is the bug this shape exists to prevent. Both inputs here are invariant under
// rotation by construction, so the first test in this block is the contract and
// the rest are consequences of it.
describe("Mesh.projectedBounds", () => {
  const pass = (overrides: Partial<ProjectedBoundsPass> = {}): ProjectedBoundsPass => ({
    offsetX: 0,
    offsetY: 0,
    targetWidth: 1024,
    targetHeight: 640,
    ...overrides,
  });

  // One point is enough: it is the projection basis the sibling anchor is built
  // from, and nothing here reads a coordinate off it. The triangle list stays
  // empty for the same reason — the same fixture shape the transition machine's
  // own suite uses.
  const meshOf = (boundingRadius: number, target = renderTarget(), camera = cameraOf()) =>
    new Mesh({
      points: [new Point3D(0, 0, 0, target, camera)],
      triangles: [],
      boundingRadius,
    });

  const posed = (mesh: Mesh, transform: number[][]) => {
    mesh.setTransform(transform);

    return mesh.projectedBounds(pass());
  };

  // The regression, pinned. Reported against a spinning kis-rhombic
  // dodecahedron: the corners and the badge shifted on every frame.
  it("holds its size and place through any rotation of the shape", () => {
    const matrix3D = new Matrix3D();
    const mesh = meshOf(100);
    const atRest = posed(mesh, matrix3D.identity());

    expect(atRest).toEqual({ x: 412, y: 220, width: 200, height: 200 });
    expect(posed(mesh, matrix3D.yawMatrix(37))).toEqual(atRest);
    expect(posed(mesh, matrix3D.pitchMatrix(80))).toEqual(atRest);
    expect(posed(mesh, matrix3D.multiply(matrix3D.rollMatrix(140), matrix3D.yawMatrix(200)))).toEqual(atRest);
  });

  // Rotation cannot move the box, but everything else still must.
  it("follows the shape's posed origin, so an orbit or a pan carries the box with it", () => {
    const mesh = meshOf(100);

    expect(posed(mesh, new Matrix3D().translation(50, 20, 0))).toEqual({
      x: 462,
      y: 240,
      width: 200,
      height: 200,
    });
  });

  it("grows with SCALE, which rides the transform rather than the radius the registry authored", () => {
    const mesh = meshOf(100);

    // uniformScaleOf reads the length of the matrix's first column, so a 2x
    // scale doubles the half-extent and leaves the centre alone.
    expect(posed(mesh, new Matrix3D().scaleMatrix(2))).toEqual({ x: 312, y: 120, width: 400, height: 400 });
  });

  it("shrinks with distance under perspective, and holds under orthographic", () => {
    const matrix3D = new Matrix3D();
    const perspective = meshOf(100);
    const orthographic = meshOf(100, renderTarget(), cameraOf({ mode: "ORTHOGRAPHIC", magnification: 1 }));
    const pushedBack = matrix3D.translation(0, 0, 300);

    // The eye sits at fl/k = 300, so 300 further out halves the scale.
    expect(posed(perspective, pushedBack)?.width).toBeCloseTo(100, 10);
    expect(posed(orthographic, pushedBack)?.width).toBeCloseTo(200, 10);
  });

  it("carries the renderable's screen offsets", () => {
    const mesh = meshOf(100);

    mesh.setTransform(new Matrix3D().identity());

    expect(mesh.projectedBounds(pass({ offsetX: 30, offsetY: -20 }))).toEqual({
      x: 442,
      y: 200,
      width: 200,
      height: 200,
    });
  });

  it("clamps to the render target so a mesh running off the stage cannot push the box outside it", () => {
    const target = new RenderTarget({ width: 500, height: 300 });
    const mesh = meshOf(4000, target);

    mesh.setTransform(new Matrix3D().identity());

    expect(mesh.projectedBounds(pass({ targetWidth: 500, targetHeight: 300 }))).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 300,
    });
  });

  // The near plane's own answer, asked once of the centre rather than counted
  // over the vertices: a shape the camera has moved inside of has no box worth
  // drawing, and the projection is singular behind the eye either way.
  it("comes back null when the shape's own origin leaves the view volume", () => {
    const mesh = meshOf(100);

    expect(posed(mesh, new Matrix3D().translation(0, 0, -350))).toBeNull();
  });

  it("comes back null when the whole box is past one edge of the target", () => {
    const mesh = meshOf(100);

    mesh.setTransform(new Matrix3D().identity());

    expect(mesh.projectedBounds(pass({ offsetY: -800 }))).toBeNull();
    expect(mesh.projectedBounds(pass({ offsetX: 2000 }))).toBeNull();
  });

  it("comes back null for a mesh with no geometry to anchor the projection to", () => {
    const empty = new Mesh({ points: [], triangles: [], boundingRadius: 100 });

    expect(empty.projectedBounds(pass())).toBeNull();
  });
});

describe("setFromSource", () => {
  it("applies the whole matrix to the coordinates the point was authored with", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, renderTarget(), cameraOf());

    point.setFromSource(matrix3D.yawMatrix(90));

    // A quarter turn about y sends +x to -z, so the point ends up behind the
    // origin and its projection falls back towards the centre.
    expect(point.zValue).toBeCloseTo(-100, 10);
    expect(point.convert3D2D().x).toBeCloseTo(512, 10);
  });

  // The property the whole camera rig rests on. The incremental transform this
  // replaced destroyed its own operand, so a pose was the product of every frame
  // that came before it and no angle could be returned to; here the source is
  // read and never written, so the same matrix always gives the same vertex.
  it("rebuilds from the source rather than from the current position", () => {
    const point = new Point3D(100, 0, 0, renderTarget(), cameraOf());
    const matrix3D = new Matrix3D();
    const quarterTurn = matrix3D.yawMatrix(90);

    point.setFromSource(quarterTurn);
    point.setFromSource(quarterTurn);

    expect(point.zValue).toBeCloseTo(-100, 10);

    point.setFromSource(matrix3D.yawMatrix(0));

    expect(point.zValue).toBeCloseTo(0, 10);
    expect(point.convert3D2D().x).toBeCloseTo(new Point3D(100, 0, 0, renderTarget(), cameraOf()).convert3D2D().x, 10);
  });

  it("mutates in place and returns nothing", () => {
    const point = new Point3D(10, 20, 30, renderTarget(), cameraOf());

    expect(point.setFromSource(new Matrix3D().rollMatrix(0))).toBeUndefined();
    expect(point.zValue).toBe(30);
  });
});

describe("withPosition", () => {
  it("builds a sibling point at a new position under the same projection basis", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const point = new Point3D(100, 0, 0, target, camera);
    const sibling = point.withPosition(0, 0, 0);

    expect(sibling.zValue).toBe(0);
    expect(sibling.convert3D2D().x).toBe(512);
  });

  it("follows the same camera as the point it was built from, not a snapshot of it", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const point = new Point3D(100, 0, 0, target, camera);
    const sibling = point.withPosition(50, 0, 0);

    camera.setMagnification(2);

    expect(sibling.convert3D2D().x).toBeCloseTo(target.centerX + 50 * camera.scaleAt(0) * target.scale, 10);
  });

  it("is independent of the point it was built from once constructed", () => {
    const point = new Point3D(100, 0, 0, renderTarget(), cameraOf());
    const sibling = point.withPosition(0, 0, 50);

    point.setFromSource(new Matrix3D().translation(1, 2, 3));

    expect(sibling.zValue).toBe(50);
    expect(point.zValue).toBe(3);
  });
});

describe("Matrix3D", () => {
  // Every builder used to be recomputed from one cos/sin pair, so reading two of
  // them read one angle twice. Building them independently is what lets the rig
  // hold three different angles at once.
  it("builds each axis from its own angle", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(0, 100, 0, renderTarget(), cameraOf());

    // A quarter turn about x sends +y to +z; the yaw built beside it must leave
    // that alone rather than turning by 90 as well.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(0), matrix3D.pitchMatrix(90)));

    expect(point.zValue).toBeCloseTo(100, 10);
  });

  it("multiplies right to left, so the second operand is applied first", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, renderTarget(), cameraOf());

    // Pitch about x cannot move a point on the x axis, so this is the yaw alone
    // — and it is the yaw regardless of which order the product is read in only
    // if the second operand really did run first.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(90), matrix3D.pitchMatrix(37)));

    expect(point.zValue).toBeCloseTo(-100, 10);
  });

  it("carries a translation in the fourth column", () => {
    const point = new Point3D(10, 20, 30, renderTarget(), cameraOf());

    point.setFromSource(new Matrix3D().translation(1, 2, 3));

    expect(point.zValue).toBe(33);
  });
});

describe("Camera", () => {
  // The identity the whole re-parameterisation rests on, asserted rather than
  // argued: with k read off a push-back at the reference focal, the new
  // expression IS the divide it replaced. Break this and every position of the
  // zoom slider moves, silently and by a little. The five offsets are the ends
  // and the middle of that slider's own range.
  it("reproduces the divide it replaced when k comes from a push-back", () => {
    const focal = 300;

    [260, 100, 20, 0, -220].forEach((zOffset) => {
      const camera = new Camera({ focal, magnification: focal / (focal + zOffset) });

      [-173, -100, 0, 100, 173].forEach((z) => {
        expect(camera.scaleAt(z)).toBeCloseTo(focal / (focal + zOffset + z), 10);
      });
    });
  });

  it("drops the depth term in orthographic, so equal faces project equal", () => {
    const camera = new Camera({ focal: 300, magnification: 0.75, mode: "ORTHOGRAPHIC" });

    expect(camera.scaleAt(-150)).toBe(0.75);
    expect(camera.scaleAt(0)).toBe(0.75);
    expect(camera.scaleAt(150)).toBe(0.75);
  });

  // The magnification is defined as the scale at the subject's own centre plane,
  // which is what makes the two modes agree exactly there and nowhere else.
  it("keeps the centre plane fixed when the mode changes", () => {
    const camera = new Camera({ focal: 300, magnification: 0.75 });
    const perspectiveFalloff = camera.scaleAt(100);

    camera.setMode("ORTHOGRAPHIC");

    expect(camera.scaleAt(0)).toBeCloseTo(0.75, 10);
    expect(camera.scaleAt(100)).not.toBeCloseTo(perspectiveFalloff, 10);
  });

  // Dolly compensation, at the level it is actually implemented: nothing
  // recomputes a push-back, the focal simply moves and k is left alone.
  it("holds the subject's size at the centre plane when the focal moves", () => {
    const camera = new Camera({ focal: 300, magnification: 0.9375 });
    const wideFalloff = camera.scaleAt(100);

    camera.setFocal(2430.6);

    expect(camera.scaleAt(0)).toBeCloseTo(0.9375, 10);
    // The eye pulled back to hold that size, so the same vertex is a much
    // smaller fraction of the way to it and the falloff around the subject
    // flattens. That is the visible difference a FOV control is supposed to
    // make, and it is the whole reason it is not a second zoom.
    expect(camera.scaleAt(100)).toBeGreaterThan(wideFalloff);
    expect(camera.distance).toBeCloseTo(2430.6 / 0.9375, 10);
  });

  it("clips outside the view volume and nowhere inside it", () => {
    const camera = new Camera({ focal: 300, magnification: 3.75, near: 1, far: 5000 });

    // The eye sits at fl/k = 80, which is where the zoom slider's near end puts
    // it: a vertex 100 in front of the origin is then 20 units BEHIND the eye,
    // and used to project mirrored across the vanishing point.
    expect(camera.distance).toBeCloseTo(80, 10);
    expect(camera.clips(-100)).toBe(true);
    // The plane itself is inside the volume: d = z + 80, so z = -79 sits exactly
    // on near = 1 and survives, and anything closer does not.
    expect(camera.clips(-79.5)).toBe(true);
    expect(camera.clips(-79)).toBe(false);
    expect(camera.clips(0)).toBe(false);
    // Far, the same way round: z = 4920 sits exactly on 5000.
    expect(camera.clips(4920)).toBe(false);
    expect(camera.clips(4921)).toBe(true);
  });
});

describe("Triangle.clipToNear", () => {
  const context = (overrides: Partial<NearClipContext> = {}): NearClipContext => ({
    near: 1,
    far: 5000,
    eyeDistance: 300,
    offsetX: 0,
    offsetY: 0,
    cullBackfaces: true,
    ...overrides,
  });

  // Front-facing under the same 2D winding test isFrontFacing uses — a=left,
  // b=bottom, c=right, verified against the cross product by hand so this
  // fixture is known-good rather than assumed.
  const frontFacingAt = (camera: Camera, target: RenderTarget, z: number) => {
    const a = new Point3D(-50, 50, z, target, camera);
    const b = new Point3D(0, -50, z, target, camera);
    const c = new Point3D(50, 50, z, target, camera);

    return new Triangle(a, b, c, "#ff0000");
  };

  it("passes a wholly-in-front triangle through unchanged, allocating no new instance", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const triangle = frontFacingAt(camera, target, 100);

    triangle.project(0, 0);

    const out: Triangle[] = [];
    triangle.clipToNear(context(), out);

    // toBe, not toEqual: the point of this test is that the fast path
    // allocates nothing, so `out[0]` must be the exact same instance, not a
    // structurally-identical clone toEqual would also accept.
    expect(out.length).toBe(1);
    expect(out[0]).toBe(triangle);
  });

  it("drops a wholly-behind triangle entirely", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const a = new Point3D(-50, 50, -350, target, camera);
    const b = new Point3D(0, -50, -350, target, camera);
    const c = new Point3D(50, 50, -350, target, camera);
    const triangle = new Triangle(a, b, c, "#ff0000");

    triangle.project(0, 0);

    const out: Triangle[] = [];
    triangle.clipToNear(context(), out);

    expect(out).toEqual([]);
  });

  it("splits a straddling triangle into two new, non-degenerate fragments", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const a = new Point3D(-50, 50, 100, target, camera);
    const b = new Point3D(0, -50, 100, target, camera);
    const c = new Point3D(50, 50, -350, target, camera);
    const triangle = new Triangle(a, b, c, "#ff0000");

    triangle.project(0, 0);

    const out: Triangle[] = [];
    triangle.clipToNear(context(), out);

    expect(out.length).toBe(2);
    out.forEach((fragment) => {
      expect(fragment).not.toBe(triangle);
      expect(Number.isFinite(fragment.screenArea())).toBe(true);
      expect(fragment.screenArea()).toBeGreaterThan(0);
    });
    expect(out[0]).not.toBe(out[1]);
  });

  it("rejects a triangle with any vertex beyond the far plane, near test aside", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const a = new Point3D(-50, 50, 4800, target, camera);
    const b = new Point3D(0, -50, 100, target, camera);
    const c = new Point3D(50, 50, 100, target, camera);
    const triangle = new Triangle(a, b, c, "#ff0000");

    triangle.project(0, 0);

    const out: Triangle[] = [];
    triangle.clipToNear(context(), out);

    expect(out).toEqual([]);
  });

  it("skips the backface test and keeps the triangle when cullBackfaces is false", () => {
    const camera = cameraOf();
    const target = renderTarget();
    // Reverse winding of frontFacingAt — back-facing under the 2D test.
    const a = new Point3D(-50, 50, 100, target, camera);
    const b = new Point3D(50, 50, 100, target, camera);
    const c = new Point3D(0, -50, 100, target, camera);
    const triangle = new Triangle(a, b, c, "#ff0000");

    triangle.project(0, 0);
    expect(triangle.isFrontFacing()).toBe(false);

    const out: Triangle[] = [];
    triangle.clipToNear(context({ cullBackfaces: false }), out);

    expect(out.length).toBe(1);
    expect(out[0]).toBe(triangle);
  });
});

// The winding convention the key light reads a normal off (E3a/COS-241).
//
// Lighting takes the outward normal to be -(b-a) x (c-a), and that minus sign is
// the whole ticket: get it backwards and every solid is lit from inside, which
// looks like a plausible picture of a differently-lit solid rather than like a
// bug. Nothing in the render path can catch it, because the sign never reaches
// the cull — isFrontFacing works on projected coordinates and would go on
// agreeing with itself.
//
// So it is pinned twice. The first case is the identity the ticket states, and
// it is asserted under ORTHOGRAPHIC because that is where it is exact: the
// projected cross product is s squared times Nraw.z only when all three vertices
// share one s, which perspective does not give a face that runs away from the
// eye. The second is the geometric claim the first is standing in for, and it
// holds under any projection at all.
describe("the face-normal sign convention", () => {
  const rawNormal = (object3D: Object3D, indices: readonly number[]) => {
    const [a, b, c] = indices.map((index) => object3D.points[index]);

    return [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
  };

  it("agrees with the 2D backface test on every face of the cube", () => {
    const camera = new Camera({ focal: 300, magnification: 1, mode: "ORTHOGRAPHIC" });
    const points = cube.points.map((point) => new Point3D(point[0], point[1], point[2], renderTarget(), camera));

    const disagreements = cube.triangles.filter((triangle) => {
      const [a, b, c, material] = triangle;
      const face = new Triangle(points[a], points[b], points[c], material);

      face.project(0, 0);

      return face.isFrontFacing() !== rawNormal(cube, [a, b, c])[2] > 0;
    });

    expect(cube.triangles.length).toBeGreaterThan(0);
    expect(disagreements).toEqual([]);
  });

  // Every face of a convex solid centred on the origin has its outward normal
  // pointing away from that origin, so the dot product with any of its own
  // vertices is positive. The sphere is in here as well as the cube because it
  // is the shape with degenerate faces: those come out at exactly zero, which is
  // the value Lighting's guard rejects rather than a sign it could get wrong.
  it("points -Nraw away from the centre on every face of the cube and the sphere", () => {
    [cube, sphere].forEach((object3D) => {
      const inward = object3D.triangles.filter(([a, b, c]) => {
        const normal = rawNormal(object3D, [a, b, c]);
        const vertex = object3D.points[a];

        return -(normal[0] * vertex[0] + normal[1] * vertex[1] + normal[2] * vertex[2]) < 0;
      });

      expect(inward).toEqual([]);
    });
  });
});
