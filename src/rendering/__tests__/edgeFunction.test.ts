// The rasteriser's own arithmetic, verified against a triangle whose winding
// matches Triangle.isFrontFacing's own convention: (0,0),(4,0),(0,4) has
// (b-a)x(c-a) = 16 > 0, front-facing, the same sign edgeFunction(A,B,C) must
// produce for signedArea2 to agree with it.

import { edgeFunction, edgeWeights, interpolate, isInside, screenBounds, signedArea2 } from "@rendering/edgeFunction";
import { describe, expect, it } from "vitest";

const A = { x: 0, y: 0 };
const B = { x: 4, y: 0 };
const C = { x: 0, y: 4 };

describe("signedArea2", () => {
  it("is positive for a front-facing (CCW-by-this-codebase's-convention) triangle", () => {
    expect(signedArea2(A.x, A.y, B.x, B.y, C.x, C.y)).toBe(16);
  });

  it("matches Triangle.isFrontFacing's own cross product for the same three points", () => {
    const v1x = B.x - A.x;
    const v1y = B.y - A.y;
    const v2x = C.x - A.x;
    const v2y = C.y - A.y;

    expect(signedArea2(A.x, A.y, B.x, B.y, C.x, C.y)).toBe(v1x * v2y - v1y * v2x);
  });
});

describe("edgeWeights / isInside", () => {
  it("reports every vertex as inside, weighted entirely on itself", () => {
    // toBeCloseTo throughout: the edge function's own arithmetic produces an
    // IEEE754 -0 on some of these terms (e.g. 0 * a negative number), which
    // is mathematically zero but fails a literal toEqual against +0.
    const atA = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, A.x, A.y);
    expect(isInside(atA)).toBe(true);
    expect(atA.w0).toBeCloseTo(16, 10);
    expect(atA.w1).toBeCloseTo(0, 10);
    expect(atA.w2).toBeCloseTo(0, 10);

    const atB = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, B.x, B.y);
    expect(isInside(atB)).toBe(true);
    expect(atB.w0).toBeCloseTo(0, 10);
    expect(atB.w1).toBeCloseTo(16, 10);
    expect(atB.w2).toBeCloseTo(0, 10);

    const atC = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, C.x, C.y);
    expect(isInside(atC)).toBe(true);
    expect(atC.w0).toBeCloseTo(0, 10);
    expect(atC.w1).toBeCloseTo(0, 10);
    expect(atC.w2).toBeCloseTo(16, 10);
  });

  it("reports the centroid as inside, weighted equally", () => {
    const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, centroid.x, centroid.y);

    expect(isInside(weights)).toBe(true);
    expect(weights.w0).toBeCloseTo(weights.w1, 10);
    expect(weights.w1).toBeCloseTo(weights.w2, 10);
  });

  it("sums the three weights to the triangle's own signed area, for any point", () => {
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, 1, 1);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(weights.w0 + weights.w1 + weights.w2).toBeCloseTo(area, 10);
  });

  it("reports a point outside the triangle as not inside", () => {
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, 10, 10);
    expect(isInside(weights)).toBe(false);
  });

  it("reports a point exactly on an edge as inside, matching Camera.clips' own closed boundary", () => {
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, 2, 0);
    expect(isInside(weights)).toBe(true);
  });
});

describe("interpolate", () => {
  it("recovers a point's own y from barycentric weights of the vertices' y values", () => {
    const px = 1;
    const py = 1;
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, px, py);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(interpolate(weights, area, A.y, B.y, C.y)).toBeCloseTo(py, 10);
    expect(interpolate(weights, area, A.x, B.x, C.x)).toBeCloseTo(px, 10);
  });

  it("interpolates a non-coordinate attribute linearly between the three vertices", () => {
    // Midpoint of B and C: interpolate should read the average of their two
    // attribute values, independent of A's.
    const mid = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const weights = edgeWeights(A.x, A.y, B.x, B.y, C.x, C.y, mid.x, mid.y);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(interpolate(weights, area, 100, 10, 30)).toBeCloseTo(20, 10);
  });
});

describe("edgeFunction", () => {
  it("is zero along the edge it is built from, at both endpoints and in between", () => {
    expect(edgeFunction(A.x, A.y, B.x, B.y, A.x, A.y)).toBe(0);
    expect(edgeFunction(A.x, A.y, B.x, B.y, B.x, B.y)).toBe(0);
    expect(edgeFunction(A.x, A.y, B.x, B.y, 2, 0)).toBe(0);
  });
});

describe("screenBounds", () => {
  it("returns the triangle's own integer bounding box when fully inside the buffer", () => {
    expect(screenBounds(A.x, A.y, B.x, B.y, C.x, C.y, 100, 100)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 4,
      maxY: 4,
    });
  });

  it("clamps to the buffer when the triangle extends past its edges", () => {
    expect(screenBounds(-5, -5, 8, -5, -5, 8, 4, 4)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 3,
      maxY: 3,
    });
  });

  it("returns null when the triangle is entirely outside the buffer", () => {
    expect(screenBounds(200, 200, 210, 200, 200, 210, 100, 100)).toBeNull();
  });

  it("returns null for a triangle collapsed to a single point off-grid", () => {
    expect(screenBounds(-1, -1, -1, -1, -1, -1, 100, 100)).toBeNull();
  });
});
