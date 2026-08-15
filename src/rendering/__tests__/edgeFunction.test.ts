// The rasteriser's own arithmetic, verified against a triangle whose winding
// matches Triangle.isFrontFacing's own convention: (0,0),(4,0),(0,4) has
// (b-a)x(c-a) = 16 > 0, front-facing, the same sign edgeFunction(A,B,C) must
// produce for signedArea2 to agree with it.

import {
  edgeCoverage,
  edgeFeatherReach,
  edgeFunction,
  edgeReciprocals,
  edgeRowTerm,
  edgeSlope,
  edgeSpanBound,
  edgeWeightAt,
  interpolate,
  isInside,
  screenBounds,
  signedArea2,
} from "@rendering/edgeFunction";
import { describe, expect, it } from "vitest";

const A = { x: 0, y: 0 };
const B = { x: 4, y: 0 };
const C = { x: 0, y: 4 };

// The three weights at a point, straight from edgeFunction — which is the
// definition every other form in the module answers to. A tuple rather than the
// record this used to build: E3f/3DE-116 took the record out because the raster
// loop was allocating one per candidate pixel.
const weightsAt = (px: number, py: number): [number, number, number] => [
  edgeFunction(B.x, B.y, C.x, C.y, px, py),
  edgeFunction(C.x, C.y, A.x, A.y, px, py),
  edgeFunction(A.x, A.y, B.x, B.y, px, py),
];

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

describe("the weights / isInside", () => {
  it("reports every vertex as inside, weighted entirely on itself", () => {
    // toBeCloseTo throughout: the edge function's own arithmetic produces an
    // IEEE754 -0 on some of these terms (e.g. 0 * a negative number), which
    // is mathematically zero but fails a literal toEqual against +0.
    const atA = weightsAt(A.x, A.y);
    expect(isInside(...atA)).toBe(true);
    expect(atA[0]).toBeCloseTo(16, 10);
    expect(atA[1]).toBeCloseTo(0, 10);
    expect(atA[2]).toBeCloseTo(0, 10);

    const atB = weightsAt(B.x, B.y);
    expect(isInside(...atB)).toBe(true);
    expect(atB[0]).toBeCloseTo(0, 10);
    expect(atB[1]).toBeCloseTo(16, 10);
    expect(atB[2]).toBeCloseTo(0, 10);

    const atC = weightsAt(C.x, C.y);
    expect(isInside(...atC)).toBe(true);
    expect(atC[0]).toBeCloseTo(0, 10);
    expect(atC[1]).toBeCloseTo(0, 10);
    expect(atC[2]).toBeCloseTo(16, 10);
  });

  it("reports the centroid as inside, weighted equally", () => {
    const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const [w0, w1, w2] = weightsAt(centroid.x, centroid.y);

    expect(isInside(w0, w1, w2)).toBe(true);
    expect(w0).toBeCloseTo(w1, 10);
    expect(w1).toBeCloseTo(w2, 10);
  });

  it("sums the three weights to the triangle's own signed area, for any point", () => {
    const [w0, w1, w2] = weightsAt(1, 1);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(w0 + w1 + w2).toBeCloseTo(area, 10);
  });

  it("reports a point outside the triangle as not inside", () => {
    expect(isInside(...weightsAt(10, 10))).toBe(false);
  });

  it("reports a point exactly on an edge as inside, matching Camera.clips' own closed boundary", () => {
    expect(isInside(...weightsAt(2, 0))).toBe(true);
  });
});

// The claim E3f/3DE-116 rests on, and the reason that ticket could touch the
// pixel loop while promising no visual change: hoisting the row-constant product
// out of the inner loop is an exact rearrangement, not an approximation.
//
// Asserted with toBe rather than toBeCloseTo, and over a triangle with awkward
// coordinates rather than the round one above, because "close" is not the claim.
// A weight differing in its last bit flips a pixel whose centre lands exactly on
// an edge — which is not a rare case on the Menger sponge, whose faces are axis
// aligned and land on half-pixel boundaries all over the frame.
describe("edgeRowTerm / edgeWeightAt", () => {
  const P = { x: 13.37, y: -4.2 };
  const Q = { x: 219.5, y: 88.125 };
  const R = { x: -7.75, y: 301.0625 };

  it("is bit-identical to evaluating edgeFunction at every pixel", () => {
    let compared = 0;

    for (let y = -12; y < 310; y += 7) {
      const py = y + 0.5;
      const t0 = edgeRowTerm(R.x - Q.x, py, Q.y);
      const t1 = edgeRowTerm(P.x - R.x, py, R.y);
      const t2 = edgeRowTerm(Q.x - P.x, py, P.y);

      for (let x = -12; x < 232; x += 3) {
        const px = x + 0.5;

        expect(edgeWeightAt(t0, R.y - Q.y, px, Q.x)).toBe(edgeFunction(Q.x, Q.y, R.x, R.y, px, py));
        expect(edgeWeightAt(t1, P.y - R.y, px, R.x)).toBe(edgeFunction(R.x, R.y, P.x, P.y, px, py));
        expect(edgeWeightAt(t2, Q.y - P.y, px, P.x)).toBe(edgeFunction(P.x, P.y, Q.x, Q.y, px, py));
        compared += 3;
      }
    }

    // The grid is worth something only if it was actually walked.
    expect(compared).toBeGreaterThan(10000);
  });
});

// The span is only allowed to make the pixel loop shorter. If it can exclude a
// pixel the edge test or the feather would have kept, it is not an optimisation,
// it is a rendering change — and this is the claim that was wrong twice while
// E3f was being written, both times only under EDGE ANTIALIAS.
//
// The subtle half is edgeFeatherReach. Coverage is a PERPENDICULAR half pixel,
// and the shallower an edge lies to the scanline the further along that row the
// same half pixel stretches. A flat one-pixel margin looks obviously sufficient
// and is not: the third triangle below has an edge at roughly four degrees,
// where the feather reaches seven columns past the edge.
describe("edgeSlope / edgeSpanBound / edgeFeatherReach", () => {
  const TRIANGLES = [
    { name: "a right triangle", a: { x: 4, y: 3 }, b: { x: 46, y: 9 }, c: { x: 7, y: 51 } },
    { name: "a thin diagonal sliver", a: { x: 2, y: 2 }, b: { x: 60, y: 58 }, c: { x: 5, y: 9 } },
    { name: "a nearly horizontal wedge", a: { x: 1, y: 20 }, b: { x: 90, y: 26 }, c: { x: 40, y: 33 } },
    { name: "a nearly vertical wedge", a: { x: 20, y: 1 }, b: { x: 33, y: 40 }, c: { x: 26, y: 90 } },
  ];

  // Every triangle above has to be front-facing or the edge test rejects all of
  // it and each assertion below passes by never running. The vacuity guard at
  // the end of the first test is what caught a back-wound one here.
  it.each(TRIANGLES)("is front-facing, so the assertions below are not vacuous: $name", (t) => {
    expect(signedArea2(t.a.x, t.a.y, t.b.x, t.b.y, t.c.x, t.c.y)).toBeGreaterThan(0);
  });

  const spanFor = (t: (typeof TRIANGLES)[number], py: number, feathered: boolean) => {
    const reciprocals = edgeReciprocals(t.a.x, t.a.y, t.b.x, t.b.y, t.c.x, t.c.y);
    const edges = [
      { dx: t.c.x - t.b.x, dy: t.c.y - t.b.y, ox: t.b.x, oy: t.b.y, r: reciprocals.r0 },
      { dx: t.a.x - t.c.x, dy: t.a.y - t.c.y, ox: t.c.x, oy: t.c.y, r: reciprocals.r1 },
      { dx: t.b.x - t.a.x, dy: t.b.y - t.a.y, ox: t.a.x, oy: t.a.y, r: reciprocals.r2 },
    ];

    let from = -200;
    let to = 200;

    for (const edge of edges) {
      const reach = feathered ? edgeFeatherReach(edge.dy, edge.r) : 0;
      const bound = edgeSpanBound(edge.ox, edgeSlope(edge.dx, edge.dy), py, edge.oy);

      if (edge.dy > 0) {
        to = Math.min(to, Math.ceil(bound + reach));
      } else if (edge.dy < 0) {
        from = Math.max(from, Math.floor(bound - reach) - 1);
      }
    }

    return { from, to };
  };

  it.each(TRIANGLES)("keeps every pixel the edge test accepts, on $name", (t) => {
    const reciprocals = edgeReciprocals(t.a.x, t.a.y, t.b.x, t.b.y, t.c.x, t.c.y);
    let inside = 0;
    let feathered = 0;

    for (let y = -5; y < 100; y += 1) {
      const py = y + 0.5;
      const bare = spanFor(t, py, false);
      const soft = spanFor(t, py, true);

      for (let x = -5; x < 100; x += 1) {
        const px = x + 0.5;
        const w0 = edgeFunction(t.b.x, t.b.y, t.c.x, t.c.y, px, py);
        const w1 = edgeFunction(t.c.x, t.c.y, t.a.x, t.a.y, px, py);
        const w2 = edgeFunction(t.a.x, t.a.y, t.b.x, t.b.y, px, py);

        if (isInside(w0, w1, w2)) {
          inside += 1;
          expect(x).toBeGreaterThanOrEqual(bare.from);
          expect(x).toBeLessThanOrEqual(bare.to);
        }

        if (edgeCoverage(w0, w1, w2, reciprocals) > 0) {
          feathered += 1;
          expect(x).toBeGreaterThanOrEqual(soft.from);
          expect(x).toBeLessThanOrEqual(soft.to);
        }
      }
    }

    // A span that kept nothing would pass every assertion above vacuously.
    expect(inside).toBeGreaterThan(20);
    expect(feathered).toBeGreaterThan(inside);
  });

  it("reaches further along the row the shallower the edge lies to it", () => {
    // Half a pixel perpendicular is half a pixel along the row for a vertical
    // edge, and grows without bound as the edge flattens toward horizontal.
    const reachFor = (dx: number, dy: number) => edgeFeatherReach(dy, 1 / Math.sqrt(dx * dx + dy * dy));

    expect(reachFor(0, 10)).toBeCloseTo(0.5, 10);
    expect(reachFor(10, 10)).toBeCloseTo(Math.SQRT2 / 2, 10);
    expect(reachFor(100, 1)).toBeCloseTo(0.5 * Math.sqrt(10001), 6);
    expect(reachFor(10, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("puts the bound where the edge weight reaches zero", () => {
    // The edge from (0,0) to (4,4) crosses y = 2.5 at x = 2.5.
    expect(edgeSpanBound(0, edgeSlope(4, 4), 2.5, 0)).toBeCloseTo(2.5, 10);
    // A horizontal edge constrains no x, and its slope is reported as 0.
    expect(edgeSlope(7, 0)).toBe(0);
  });
});

describe("interpolate", () => {
  it("recovers a point's own y from barycentric weights of the vertices' y values", () => {
    const px = 1;
    const py = 1;
    const [w0, w1, w2] = weightsAt(px, py);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(interpolate(w0, w1, w2, area, A.y, B.y, C.y)).toBeCloseTo(py, 10);
    expect(interpolate(w0, w1, w2, area, A.x, B.x, C.x)).toBeCloseTo(px, 10);
  });

  it("interpolates a non-coordinate attribute linearly between the three vertices", () => {
    // Midpoint of B and C: interpolate should read the average of their two
    // attribute values, independent of A's.
    const mid = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const [w0, w1, w2] = weightsAt(mid.x, mid.y);
    const area = signedArea2(A.x, A.y, B.x, B.y, C.x, C.y);

    expect(interpolate(w0, w1, w2, area, 100, 10, 30)).toBeCloseTo(20, 10);
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

describe("edgeReciprocals / edgeCoverage", () => {
  const reciprocals = edgeReciprocals(A.x, A.y, B.x, B.y, C.x, C.y);
  const coverageAt = (px: number, py: number): number => edgeCoverage(...weightsAt(px, py), reciprocals);

  it("inverts the length of the edge opposite each vertex", () => {
    // r0 is BC, the hypotenuse; r1 is CA and r2 is AB, both of length 4.
    expect(1 / reciprocals.r0).toBeCloseTo(Math.sqrt(32), 10);
    expect(1 / reciprocals.r1).toBeCloseTo(4, 10);
    expect(1 / reciprocals.r2).toBeCloseTo(4, 10);
  });

  it("turns an edge weight back into the perpendicular distance it was scaled from", () => {
    // (1,1) is exactly one unit from CA (the line x = 0) and sqrt(2) from the
    // hypotenuse, which is the whole claim edgeCoverage rests on.
    const [w0, w1] = weightsAt(1, 1);

    expect(w1 * reciprocals.r1).toBeCloseTo(1, 10);
    expect(w0 * reciprocals.r0).toBeCloseTo(Math.SQRT2, 10);
  });

  it("covers a pixel whole once its centre is half a pixel inside every edge", () => {
    expect(coverageAt(2, 1)).toBe(1);
    expect(coverageAt(0.5, 2)).toBe(1);
  });

  it("half-covers a centre sitting exactly on an edge", () => {
    expect(coverageAt(0, 2)).toBeCloseTo(0.5, 10);
    expect(coverageAt(2, 0)).toBeCloseTo(0.5, 10);
  });

  it("falls off linearly across the half pixel outside an edge", () => {
    expect(coverageAt(-0.25, 2)).toBeCloseTo(0.25, 10);
    expect(coverageAt(-0.4, 2)).toBeCloseTo(0.1, 10);
  });

  it("gives nothing to a centre half a pixel or more outside, which is what ends the feather", () => {
    expect(coverageAt(-0.5, 2)).toBe(0);
    expect(coverageAt(-3, 2)).toBe(0);
  });

  it("takes the nearest edge at a corner, never the sum of two", () => {
    // Near A, both CA and AB are close. Coverage follows whichever bites deeper,
    // and stays a coverage rather than becoming a double count.
    const corner = coverageAt(-0.2, 0.1);

    expect(corner).toBeCloseTo(0.3, 10);
    expect(corner).toBeGreaterThanOrEqual(0);
    expect(corner).toBeLessThanOrEqual(1);
  });
});
