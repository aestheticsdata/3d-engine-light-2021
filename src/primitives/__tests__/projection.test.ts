// The projection primitives, in the node environment and with no DOM in sight.
//
// That is the point of the file rather than an incidental detail: Point3D used
// to resolve the canvas itself, from a class-field initialiser, so importing it
// under vitest's node environment threw before a single assertion ran. These
// tests exist because they can now be written at all.
//
// The capture-at-construction case is the one worth guarding. Copying the
// render target's three numbers rather than holding the instance is what keeps
// a mesh already on screen projecting about the centre and scale it was built
// with; following a resize would be an improvement, and it belongs to the
// resize ticket (E9b), not here. The camera is the opposite and is held rather
// than copied, which is what lets one slider move every vertex of every mesh
// at once. The two arrive in the same constructor and it would be easy to make
// one behave like the other by mistake.

import Camera from "@primitives/Camera";
import Matrix3D from "@primitives/Matrix3D";
import Point3D from "@primitives/Point3D";
import RenderTarget from "@primitives/RenderTarget";
import { describe, expect, it } from "vitest";

import type { CameraOptions } from "@primitives/Camera";

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

  it("keeps the centre and scale it was built with when the render target later resizes", () => {
    const target = renderTarget();
    const point = new Point3D(0, 0, 0, target, cameraOf());

    target.setSize(400, 200);

    expect(point.convert3D2D().x).toBe(512);
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
