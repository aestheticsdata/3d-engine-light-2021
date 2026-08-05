// The projection primitives, in the node environment and with no DOM in sight.
//
// That is the point of the file rather than an incidental detail: Point3D used
// to resolve the canvas itself, from a class-field initialiser, so importing it
// under vitest's node environment threw before a single assertion ran. These
// tests exist because they can now be written at all.
//
// The capture-at-construction case is the one worth guarding. Copying the two
// numbers rather than holding the Viewport is what keeps a mesh already on
// screen projecting about the centre it was built with; making it follow a
// resize would be an improvement, and it belongs to the resize ticket, not here.
// The camera is the opposite and is held rather than copied, which is what lets
// one slider move every vertex of every mesh at once. The two arrive in the same
// constructor and it would be easy to make one behave like the other by mistake.

import Camera from "@primitives/Camera";
import Matrix3D from "@primitives/Matrix3D";
import Point3D from "@primitives/Point3D";
import Viewport from "@primitives/Viewport";
import { describe, expect, it } from "vitest";

import type { CameraOptions } from "@primitives/Camera";

const canvasOf = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;

const viewport = () => new Viewport(canvasOf(1024, 640));

// Focal 300 at magnification 1 puts the eye 300 out and leaves the centre plane
// at scale 1, which is what makes the projected numbers below readable by hand.
const cameraOf = (options: Partial<CameraOptions> = {}) => new Camera({ focal: 300, magnification: 1, ...options });

describe("Viewport", () => {
  it("halves the canvas, rounding down on an odd dimension", () => {
    const odd = new Viewport(canvasOf(1025, 641));

    expect(viewport().x).toBe(512);
    expect(viewport().y).toBe(320);
    expect(odd.x).toBe(512);
    expect(odd.y).toBe(320);
  });
});

describe("convert3D2D", () => {
  it("puts the origin at the viewport centre", () => {
    const point = new Point3D(0, 0, 0, viewport(), cameraOf());
    const projected = point.convert3D2D();

    expect(projected.x).toBe(512);
    expect(projected.y).toBe(320);
  });

  it("shrinks with distance and grows as the shape comes closer", () => {
    const camera = cameraOf();
    const near = new Point3D(100, 0, -150, viewport(), camera);
    const far = new Point3D(100, 0, 300, viewport(), camera);

    expect(near.convert3D2D().x).toBeGreaterThan(612);
    expect(far.convert3D2D().x).toBeLessThan(612);
  });

  it("keeps the centre it was built with when the canvas later resizes", () => {
    const canvas = canvasOf(1024, 640);
    const point = new Point3D(0, 0, 0, new Viewport(canvas), cameraOf());

    canvas.width = 400;
    canvas.height = 200;

    expect(point.convert3D2D().x).toBe(512);
  });

  // Why the record is shared rather than copied: a zoom used to be 3960 field
  // writes on the torus knot, and a mesh built before the camera moved projected
  // at whatever that camera held when its vertices were constructed.
  it("follows the camera it was built with rather than a copy of it", () => {
    const camera = cameraOf();
    const point = new Point3D(100, 0, 0, viewport(), camera);

    expect(point.convert3D2D().x).toBe(612);

    camera.setMagnification(2);

    expect(point.convert3D2D().x).toBe(712);
  });
});

describe("setFromSource", () => {
  it("applies the whole matrix to the coordinates the point was authored with", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, viewport(), cameraOf());

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
    const point = new Point3D(100, 0, 0, viewport(), cameraOf());
    const matrix3D = new Matrix3D();
    const quarterTurn = matrix3D.yawMatrix(90);

    point.setFromSource(quarterTurn);
    point.setFromSource(quarterTurn);

    expect(point.zValue).toBeCloseTo(-100, 10);

    point.setFromSource(matrix3D.yawMatrix(0));

    expect(point.zValue).toBeCloseTo(0, 10);
    expect(point.convert3D2D().x).toBeCloseTo(new Point3D(100, 0, 0, viewport(), cameraOf()).convert3D2D().x, 10);
  });

  it("mutates in place and returns nothing", () => {
    const point = new Point3D(10, 20, 30, viewport(), cameraOf());

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
    const point = new Point3D(0, 100, 0, viewport(), cameraOf());

    // A quarter turn about x sends +y to +z; the yaw built beside it must leave
    // that alone rather than turning by 90 as well.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(0), matrix3D.pitchMatrix(90)));

    expect(point.zValue).toBeCloseTo(100, 10);
  });

  it("multiplies right to left, so the second operand is applied first", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, viewport(), cameraOf());

    // Pitch about x cannot move a point on the x axis, so this is the yaw alone
    // — and it is the yaw regardless of which order the product is read in only
    // if the second operand really did run first.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(90), matrix3D.pitchMatrix(37)));

    expect(point.zValue).toBeCloseTo(-100, 10);
  });

  it("carries a translation in the fourth column", () => {
    const point = new Point3D(10, 20, 30, viewport(), cameraOf());

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
