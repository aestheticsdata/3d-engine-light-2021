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

import Matrix3D from "@primitives/Matrix3D";
import Point3D from "@primitives/Point3D";
import Viewport from "@primitives/Viewport";
import { describe, expect, it } from "vitest";

const canvasOf = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;

const viewport = () => new Viewport(canvasOf(1024, 640));

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
    const point = new Point3D(0, 0, 0, viewport());
    const projected = point.convert3D2D();

    expect(projected.x).toBe(512);
    expect(projected.y).toBe(320);
  });

  it("shrinks with distance and grows as the shape comes closer", () => {
    const near = new Point3D(100, 0, -150, viewport());
    const far = new Point3D(100, 0, 300, viewport());

    expect(near.convert3D2D().x).toBeGreaterThan(612);
    expect(far.convert3D2D().x).toBeLessThan(612);
  });

  it("keeps the centre it was built with when the canvas later resizes", () => {
    const canvas = canvasOf(1024, 640);
    const point = new Point3D(0, 0, 0, new Viewport(canvas));

    canvas.width = 400;
    canvas.height = 200;

    expect(point.convert3D2D().x).toBe(512);
  });
});

describe("transformPt", () => {
  // Every row of the rotation reads the unrotated coordinates. Assigning x
  // before y is computed would feed the second row its own output, which shows
  // up as a shape that shears instead of turning.
  it("applies the whole matrix to the coordinates it started with", () => {
    const matrix = new Matrix3D();
    matrix.setAngle(90);

    const point = new Point3D(100, 0, 0, viewport());
    point.transformPt(matrix.yaw);

    // A quarter turn about y sends +x to -z, so the point ends up behind the
    // origin and its projection falls back towards the centre.
    expect(point.zValue).toBeCloseTo(-100, 10);
    expect(point.convert3D2D().x).toBeCloseTo(512, 10);
  });

  it("mutates in place and returns nothing", () => {
    const matrix = new Matrix3D();
    const point = new Point3D(10, 20, 30, viewport());

    expect(point.transformPt(matrix.roll)).toBeUndefined();
    expect(point.zValue).toBe(30);
  });
});

describe("Matrix3D", () => {
  it("hands out three usable matrices before any angle is set", () => {
    const identity = new Matrix3D();
    const point = new Point3D(10, 20, 30, viewport());

    point.transformPt(identity.pitch);
    point.transformPt(identity.yaw);
    point.transformPt(identity.roll);

    expect(point.zValue).toBe(30);
    expect(point.convert3D2D().x).toBe(new Point3D(10, 20, 30, viewport()).convert3D2D().x);
  });
});
