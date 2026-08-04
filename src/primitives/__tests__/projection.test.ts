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

describe("setFromSource", () => {
  it("applies the whole matrix to the coordinates the point was authored with", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, viewport());

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
    const point = new Point3D(100, 0, 0, viewport());
    const matrix3D = new Matrix3D();
    const quarterTurn = matrix3D.yawMatrix(90);

    point.setFromSource(quarterTurn);
    point.setFromSource(quarterTurn);

    expect(point.zValue).toBeCloseTo(-100, 10);

    point.setFromSource(matrix3D.yawMatrix(0));

    expect(point.zValue).toBeCloseTo(0, 10);
    expect(point.convert3D2D().x).toBeCloseTo(new Point3D(100, 0, 0, viewport()).convert3D2D().x, 10);
  });

  it("mutates in place and returns nothing", () => {
    const point = new Point3D(10, 20, 30, viewport());

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
    const point = new Point3D(0, 100, 0, viewport());

    // A quarter turn about x sends +y to +z; the yaw built beside it must leave
    // that alone rather than turning by 90 as well.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(0), matrix3D.pitchMatrix(90)));

    expect(point.zValue).toBeCloseTo(100, 10);
  });

  it("multiplies right to left, so the second operand is applied first", () => {
    const matrix3D = new Matrix3D();
    const point = new Point3D(100, 0, 0, viewport());

    // Pitch about x cannot move a point on the x axis, so this is the yaw alone
    // — and it is the yaw regardless of which order the product is read in only
    // if the second operand really did run first.
    point.setFromSource(matrix3D.multiply(matrix3D.yawMatrix(90), matrix3D.pitchMatrix(37)));

    expect(point.zValue).toBeCloseTo(-100, 10);
  });

  it("carries a translation in the fourth column", () => {
    const point = new Point3D(10, 20, 30, viewport());

    point.setFromSource(new Matrix3D().translation(1, 2, 3));

    expect(point.zValue).toBe(33);
  });
});
