// The checker floor's dissolve, and the invariant HAL-174 has to hold on to:
// at a reveal of 1 this is arithmetically the curve that shipped, so the
// console's opening frame does not move by a pixel.
//
// The expected values below are worked out from the geometry rather than by
// re-running the implementation's own expression. At the shipped constants the
// reach is 6000 units and the rim band is the outer 1500 of it, so the disc is
// opaque out to 4500 and the band's own midpoint — where a smoothstep is exactly
// a half — sits at 5250.

import { RIM_FADE_FRACTION, rimFadeAt } from "@rendering/groundRimFade";
import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";
import { describe, expect, it } from "vitest";

const REACH = metresToUnits(GROUND_DEPTH_METRES);
const RIM = REACH * RIM_FADE_FRACTION;
const OPAQUE_TO = REACH - RIM;

describe("rimFadeAt at a full reveal", () => {
  it("holds the inner disc fully opaque out to where the rim band starts", () => {
    expect(rimFadeAt(0, 1)).toBe(1);
    expect(rimFadeAt(OPAQUE_TO / 2, 1)).toBe(1);
    expect(rimFadeAt(OPAQUE_TO, 1)).toBe(1);
  });

  it("reads exactly a half at the rim band's own midpoint", () => {
    expect(rimFadeAt(OPAQUE_TO + RIM / 2, 1)).toBeCloseTo(0.5, 12);
  });

  it("reaches nothing at the rim and stays there beyond it", () => {
    expect(rimFadeAt(REACH, 1)).toBe(0);
    expect(rimFadeAt(REACH * 2, 1)).toBe(0);
  });

  // The smoothstep's whole point: the ramp leaves full opacity with zero
  // gradient, so there is no visible ring where the band begins.
  it("leaves the opaque disc smoothly rather than with a corner", () => {
    const justInside = rimFadeAt(OPAQUE_TO + RIM / 1000, 1);

    expect(justInside).toBeLessThan(1);
    expect(justInside).toBeGreaterThan(0.999);
  });
});

describe("rimFadeAt as the reveal runs out", () => {
  // The withdrawal's shape: the disc shrinks toward the orbit target rather than
  // dimming in place, so a radius still inside the full-reveal disc is already
  // gone at half of it.
  it("shrinks the whole disc, rim band and all, in proportion to the reveal", () => {
    expect(rimFadeAt(OPAQUE_TO / 2, 0.5)).toBe(1);
    expect(rimFadeAt((OPAQUE_TO + RIM / 2) / 2, 0.5)).toBeCloseTo(0.5, 12);
    expect(rimFadeAt(REACH / 2, 0.5)).toBe(0);
  });

  it("takes the far ground first: a radius inside the full disc is gone at a half reveal", () => {
    expect(rimFadeAt(OPAQUE_TO, 1)).toBe(1);
    expect(rimFadeAt(OPAQUE_TO, 0.5)).toBe(0);
  });

  // Including the exact centre, where the reach and the rim are both zero and an
  // unguarded ratio would be 0/0. That centre is the last floor standing, so it
  // is the one radius a bug here would leave lit over a withdrawn scene.
  it("is nothing everywhere once the reveal reaches zero", () => {
    [0, 1, OPAQUE_TO, REACH, REACH * 10].forEach((radius) => {
      expect(rimFadeAt(radius, 0)).toBe(0);
    });
  });

  it("never comes back with a negative reveal", () => {
    expect(rimFadeAt(0, -0.25)).toBe(0);
  });
});

// A dissolve that is not monotonic in radius is a floor with a ring in it. The
// sweep below covers the whole span at every reveal between the two endpoints,
// which is where a scaled reach could plausibly fold back on itself.
describe("rimFadeAt is monotonic in radius at every reveal", () => {
  const REVEALS = [1, 0.9, 0.75, 0.5, 0.25, 0.1, 0.01];

  REVEALS.forEach((reveal) => {
    it(`never rises with radius at a reveal of ${reveal}`, () => {
      let previous = rimFadeAt(0, reveal);

      for (let radius = 0; radius <= REACH * 1.5; radius += REACH / 200) {
        const alpha = rimFadeAt(radius, reveal);

        expect(alpha).toBeLessThanOrEqual(previous);
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);

        previous = alpha;
      }
    });
  });
});
