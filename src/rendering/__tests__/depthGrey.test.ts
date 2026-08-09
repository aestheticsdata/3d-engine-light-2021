// DEPTH mode's ramp.
//
// The clamps are the load-bearing part. The window is a bounding SPHERE around
// the orbit target, so a mesh wider than it is deep leaves both ends of the ramp
// unused, and one posed off-centre by a transition's screen offset can put a
// face outside it entirely — neither of which may produce a channel the buffer
// then wraps.

import { depthGrey, depthLevel } from "@rendering/depthGrey";
import { describe, expect, it } from "vitest";

const NEAR = 100;
const FAR = 300;

describe("depthLevel", () => {
  it("puts the near edge at white and the far edge at black", () => {
    expect(depthLevel(NEAR, NEAR, FAR)).toBe(255);
    expect(depthLevel(FAR, NEAR, FAR)).toBe(0);
  });

  it("ramps linearly in depth between them", () => {
    expect(depthLevel(200, NEAR, FAR)).toBe(128);
    expect(depthLevel(150, NEAR, FAR)).toBe(191);
  });

  it("clamps rather than wrapping outside the window", () => {
    expect(depthLevel(-500, NEAR, FAR)).toBe(255);
    expect(depthLevel(9000, NEAR, FAR)).toBe(0);
  });

  it("reads a zero span as white rather than dividing by it", () => {
    // A frame with no renderables folds a bounding radius of 0, and Surface3D
    // still sets the range from it.
    expect(depthLevel(240, 240, 240)).toBe(255);
  });
});

describe("depthGrey", () => {
  it("spreads one level across the three channels at full alpha", () => {
    expect(depthGrey(200, NEAR, FAR)).toEqual([128, 128, 128, 1]);
  });
});
