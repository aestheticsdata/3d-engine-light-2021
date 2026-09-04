// The ink WIRE and POINTS draw with, as a function of the scenery.
//
// The two ends are the point of the ticket and the middle is the point of the
// lerp, but the case worth having a suite for is the third one: either bright
// layer standing alone has to hold the ink dark. A rule that read the sky alone
// would look right on every molecule and put white ink over the checker floor's
// near-white cells the moment someone switched SKY off by hand.

import { diagnosticInk } from "@rendering/diagnosticInk";
import { describe, expect, it } from "vitest";

const OVER_SCENERY = [10, 20, 60, 0.95];
const OVER_VOID = [255, 255, 255, 0.95];

describe("diagnosticInk", () => {
  it("keeps the near-black under the shipped scene", () => {
    expect(diagnosticInk(1, 1)).toEqual(OVER_SCENERY);
  });

  it("goes white once both layers are gone", () => {
    expect(diagnosticInk(0, 0)).toEqual(OVER_VOID);
  });

  it("holds the near-black while either layer alone is standing", () => {
    expect(diagnosticInk(1, 0)).toEqual(OVER_SCENERY);
    expect(diagnosticInk(0, 1)).toEqual(OVER_SCENERY);
  });

  it("crosses over linearly in the reveal", () => {
    expect(diagnosticInk(0.5, 0.5)).toEqual([133, 138, 158, 0.95]);
  });

  it("takes the brighter layer, not the later one", () => {
    // A withdrawal moves both, and a flip made by hand mid-sweep moves only the
    // one it names — so the two are routinely apart, and the ink has to answer
    // to whichever is still up.
    expect(diagnosticInk(0, 0.5)).toEqual(diagnosticInk(0.5, 0));
    expect(diagnosticInk(0.25, 0.5)).toEqual(diagnosticInk(0.5, 0.5));
  });

  it("clamps rather than overshooting either end", () => {
    expect(diagnosticInk(4, 4)).toEqual(OVER_SCENERY);
    expect(diagnosticInk(-2, -2)).toEqual(OVER_VOID);
  });
});
