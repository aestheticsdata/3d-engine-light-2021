// The two rules COS-410 added to the knot sweep, and the one thing it must not
// have changed.
//
// Both rules exist because their failure mode is a shape that renders happily
// and is wrong: a (p, q) with a common factor sweeps a LINK — several separate
// loops — that looks like a perfectly good knot, and a tessellation over budget
// moves POLY BUDGET for every other shape in the console without anyone
// noticing. Neither is visible in a screenshot, so both are asserted here.
//
// Nothing in this file touches a canvas or the DOM: the generators are pure and
// the meshes are plain arrays, which is what keeps this suite in the node
// environment with the rest.

import TorusKnotGenerator from "@data/shapes/TorusKnotGenerator";
import { describe, expect, it } from "vitest";

// GeometryWidget derives POLY BUDGET as the next power of two above the densest
// shape in the registry. It cannot be imported here — it reads the DOM — so the
// number is restated, which is the same bargain the generator itself makes.
const POLY_BUDGET = 8192;

describe("TorusKnotGenerator", () => {
  it("rejects a (p, q) that is a link rather than a knot", () => {
    expect(() => new TorusKnotGenerator({ p: 2, q: 4 })).toThrow(/link, not a knot/);
    expect(() => new TorusKnotGenerator({ p: 3, q: 6 })).toThrow(/coprime/);
  });

  it("accepts the four knots the registry ships", () => {
    expect(() => new TorusKnotGenerator({ p: 2, q: 3 })).not.toThrow();
    expect(() => new TorusKnotGenerator({ p: 2, q: 5 })).not.toThrow();
    expect(() => new TorusKnotGenerator({ p: 2, q: 7 })).not.toThrow();
    expect(() => new TorusKnotGenerator({ p: 3, q: 4 })).not.toThrow();
  });

  // The trefoil's 220 path segments and 18 tube segments became a derivation in
  // COS-410. 44 x (2 + 3) is 220 and floor(4096 / 220) is 18, so the shape that
  // was already in the registry has to come out byte-identical — the geometry
  // baseline is the other half of this check.
  it("leaves the trefoil's mesh exactly where it was", () => {
    const trefoil = new TorusKnotGenerator().build();

    expect(trefoil.points.length).toBe(3960);
    expect(trefoil.triangles.length).toBe(7920);
  });

  // The trade COS-410 chose, as a table. Every knot spends nearly the whole
  // budget and none of them exceeds it, which is the property that keeps
  // POLY_BUDGET on 8192: 8008 is the registry maximum and the next power of two
  // above it is still 8192.
  //
  // The longer curves are the ones that come out no denser — (2, 7) needs 396
  // path segments where the trefoil needs 220, and pays for them with a
  // ten-segment tube instead of an eighteen-segment one.
  it("keeps every knot inside the poly budget", () => {
    const expected = [
      { p: 2, q: 3, points: 3960, triangles: 7920 },
      { p: 2, q: 5, points: 4004, triangles: 8008 },
      { p: 2, q: 7, points: 3960, triangles: 7920 },
      { p: 3, q: 4, points: 4004, triangles: 8008 },
    ];

    expected.forEach((knot) => {
      const mesh = new TorusKnotGenerator({ p: knot.p, q: knot.q }).build();

      expect(mesh.points.length).toBe(knot.points);
      expect(mesh.triangles.length).toBe(knot.triangles);
      expect(mesh.triangles.length).toBeLessThanOrEqual(POLY_BUDGET);
    });
  });

  // A knot dense enough to need a tube below ten segments throws instead of
  // quietly going over budget. There is no such knot in the registry; the guard
  // is here so adding one is a failed build rather than a moved bar.
  it("refuses a knot it cannot tessellate within the budget", () => {
    expect(() => new TorusKnotGenerator({ p: 5, q: 7 })).toThrow(/budget/);
  });
});
