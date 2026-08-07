// A 2x2 fixture with a distinct colour per texel is enough to pin both the
// (u,v) -> (x,y) mapping and the repeat-wrap behaviour UV SCALE depends on —
// AffineTextureMapper's CanvasPattern already tiles at "repeat", and this has
// to match it rather than clamp.

import { sampleTexel } from "@rendering/texelSampling";
import { describe, expect, it } from "vitest";

// Row-major RGBA, 2x2: top-left red, top-right green, bottom-left blue,
// bottom-right white.
const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];
const PIXELS = new Uint8ClampedArray([...RED, ...GREEN, ...BLUE, ...WHITE]);

describe("sampleTexel", () => {
  it("samples the four quadrants of a 2x2 texture at their own (u,v)", () => {
    expect(sampleTexel(PIXELS, 2, 2, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(sampleTexel(PIXELS, 2, 2, 0.9, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    expect(sampleTexel(PIXELS, 2, 2, 0, 0.9)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
    expect(sampleTexel(PIXELS, 2, 2, 0.9, 0.9)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  it("wraps a UV past 1 to the same texel as its fractional part, matching CanvasPattern repeat", () => {
    expect(sampleTexel(PIXELS, 2, 2, 1.9, 0)).toEqual(sampleTexel(PIXELS, 2, 2, 0.9, 0));
    expect(sampleTexel(PIXELS, 2, 2, 4.9, 0)).toEqual(sampleTexel(PIXELS, 2, 2, 0.9, 0));
  });

  it("wraps a negative UV the same way, rather than clamping to the edge texel", () => {
    expect(sampleTexel(PIXELS, 2, 2, -0.1, 0)).toEqual(sampleTexel(PIXELS, 2, 2, 0.9, 0));
  });

  it("wraps exactly on the seam back to the origin texel", () => {
    expect(sampleTexel(PIXELS, 2, 2, 1, 0)).toEqual(sampleTexel(PIXELS, 2, 2, 0, 0));
  });
});
