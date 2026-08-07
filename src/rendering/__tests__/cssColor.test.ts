// blendRgba is new with E3b/COS-242: the rasteriser's own replacement for the
// painter path's sequence of context.fill() calls at globalAlpha, collapsed
// into one src-over composite per channel.

import { blendRgba } from "@rendering/cssColor";
import { describe, expect, it } from "vitest";

describe("blendRgba", () => {
  it("returns the top colour unchanged at full alpha", () => {
    expect(blendRgba([10, 20, 30, 1], [200, 100, 50, 1])).toEqual([200, 100, 50, 1]);
  });

  it("returns the base colour unchanged at zero alpha", () => {
    expect(blendRgba([10, 20, 30, 1], [200, 100, 50, 0])).toEqual([10, 20, 30, 1]);
  });

  it("averages the two colours at half alpha", () => {
    expect(blendRgba([0, 0, 0, 1], [200, 100, 40, 0.5])).toEqual([100, 50, 20, 1]);
  });

  it("always returns full alpha, since a composited colour has nothing further beneath it", () => {
    expect(blendRgba([10, 20, 30, 0.4], [200, 100, 50, 0.5])[3]).toBe(1);
  });
});
