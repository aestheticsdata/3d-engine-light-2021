// rgbaFor is fillFor's own numeric twin — same cache, same quantisation, no
// formatRgba call at the end. The two must agree exactly: parsing fillFor's
// string back apart has to equal rgbaFor's tuple, or the two backends would
// shade the same triangle two different colours.

import { parseCssColor } from "@rendering/cssColor";
import ShadeCache, { SHADE_STEPS, SPECULAR_STEPS } from "@rendering/ShadeCache";
import { describe, expect, it } from "vitest";

import type { RGBA } from "@rendering/cssColor";

const ORANGE: RGBA = [200, 100, 40, 1];

describe("ShadeCache.rgbaFor", () => {
  it("agrees exactly with fillFor's own string, parsed back apart", () => {
    const cache = new ShadeCache();
    const css = cache.fillFor("orange-fill", ORANGE, SHADE_STEPS, 0);
    const rgba = cache.rgbaFor("orange-fill", ORANGE, SHADE_STEPS, 0);

    expect(rgba).toEqual(parseCssColor(css));
  });

  it("returns the unlit colour unchanged at shadeStep 0 with no specular", () => {
    const cache = new ShadeCache();
    expect(cache.rgbaFor("k", ORANGE, 0, 0)).toEqual([0, 0, 0, 1]);
  });

  it("returns the full colour unchanged at full shade with no specular", () => {
    const cache = new ShadeCache();
    expect(cache.rgbaFor("k", ORANGE, SHADE_STEPS, 0)).toEqual([200, 100, 40, 1]);
  });

  it("adds a highlight without exceeding 255 per channel", () => {
    const cache = new ShadeCache();
    const rgba = cache.rgbaFor("k", ORANGE, SHADE_STEPS, SPECULAR_STEPS);

    expect(rgba[0]).toBe(255);
    expect(rgba[1]).toBe(255);
    expect(rgba[2]).toBe(255);
  });

  it("caches by (fill key, shadeStep, specularStep), same as fillFor", () => {
    const cache = new ShadeCache();
    const first = cache.rgbaFor("k", ORANGE, 10, 0);
    const second = cache.rgbaFor("k", [0, 0, 0, 1], 10, 0);

    // The second call's rgba argument is ignored on a cache hit — exactly
    // fillFor's own contract, restated numerically.
    expect(second).toEqual(first);
  });
});
