// The two properties DITHERING's ticket (E3d/COS-244) names as the ones that
// decide whether the pass is worth having, asserted rather than eyeballed: it
// leaves a colour already on the lattice exactly alone, and over one tile it
// averages back to what it was given, so a gradient keeps its slope and loses
// only its terracing.

import { ditherBias, ditherChannel } from "@rendering/orderedDither";
import { describe, expect, it } from "vitest";

const LEVELS = 32;
const CHANNEL_MAX = 255;

// The sixteen offsets of one tile, in no particular order — every assertion here
// is about all sixteen at once, never about which cell holds which.
const TILE = Array.from({ length: 16 }, (_, cell) => ditherBias(cell % 4, Math.floor(cell / 4)));

const levelValue = (level: number): number => (level * CHANNEL_MAX) / (LEVELS - 1);

describe("ditherBias", () => {
  it("gives each of the sixteen cells of the tile its own offset", () => {
    expect(new Set(TILE).size).toBe(16);
  });

  it("keeps every offset inside one level, and off both of its edges", () => {
    // Strictly inside (0, 1) is what makes the pass idempotent: an offset of
    // exactly 0 or 1 would carry a value already on the lattice to a neighbour.
    for (const bias of TILE) {
      expect(bias).toBeGreaterThan(0);
      expect(bias).toBeLessThan(1);
    }
  });

  it("tiles with a period of four in both directions", () => {
    expect(ditherBias(5, 9)).toBe(ditherBias(1, 1));
    expect(ditherBias(1024, 640)).toBe(ditherBias(0, 0));
  });
});

describe("ditherChannel", () => {
  // The ticket's "dithering must be a no-op on flat colour", in the form this
  // module can actually promise: a value the pass has already produced comes back
  // unchanged from every cell of the tile, so a flat area of it acquires no
  // pattern at all. Rasterizer keeps the stronger promise for FLAT shading by
  // never sending that path here in the first place.
  it("leaves a value already on the lattice exactly where it is, from every cell", () => {
    for (let level = 0; level < LEVELS; level += 1) {
      const value = levelValue(level);

      for (const bias of TILE) {
        expect(ditherChannel(value, bias)).toBe(value);
      }
    }
  });

  it("holds both ends of the range", () => {
    for (const bias of TILE) {
      expect(ditherChannel(0, bias)).toBe(0);
      expect(ditherChannel(CHANNEL_MAX, bias)).toBe(CHANNEL_MAX);
    }
  });

  it("splits a value between levels across the tile rather than rounding it away", () => {
    // Half way between level 12 and level 13, so half the tile has to land on
    // each — the case a plain quantisation would collapse to one of the two and
    // call a contour.
    const value = (levelValue(12) + levelValue(13)) / 2;
    const landed = TILE.map((bias) => ditherChannel(value, bias));

    expect(landed.filter((channel) => channel === levelValue(12))).toHaveLength(8);
    expect(landed.filter((channel) => channel === levelValue(13))).toHaveLength(8);
  });

  it("averages back to the input across the tile, for every 8-bit value", () => {
    // Sixteen thresholds spaced a sixteenth of a level apart, so the tile mean is
    // the input rounded to the nearest sixteenth of a level: at worst half that
    // spacing out, which is a quarter of one 8-bit step and therefore invisible
    // once FrameBuffer's Uint8ClampedArray has rounded the write.
    const tolerance = levelValue(1) / 32;

    for (let value = 0; value <= CHANNEL_MAX; value += 1) {
      const mean = TILE.reduce((total, bias) => total + ditherChannel(value, bias), 0) / TILE.length;

      expect(Math.abs(mean - value)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("clamps a channel a specular term carried past the top of the range", () => {
    for (const bias of TILE) {
      expect(ditherChannel(400, bias)).toBe(CHANNEL_MAX);
      expect(ditherChannel(-20, bias)).toBe(0);
    }
  });
});
