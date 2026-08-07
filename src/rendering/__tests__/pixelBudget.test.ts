// The clamp a maximised window needs and a normal one never notices. A software
// rasteriser fills every pixel on the main thread, so cost is linear in
// width × height — without this, a 4K browser window turns a 60fps scene into
// a slideshow. The guarantee worth pinning is not the formula but its result:
// the backing store this produces never exceeds the budget, whatever the CSS
// size or the display's own pixel ratio.

import { dprEffectiveFor, MAX_RENDER_PIXELS } from "@rendering/pixelBudget";
import { describe, expect, it } from "vitest";

describe("dprEffectiveFor", () => {
  it("returns the device pixel ratio unclamped when the backing store is well under budget", () => {
    expect(dprEffectiveFor(1024, 640, 1)).toBe(1);
  });

  it("returns the device pixel ratio unclamped at 2x on a modest window", () => {
    expect(dprEffectiveFor(600, 400, 2)).toBe(2);
  });

  it("clamps below the device pixel ratio once the backing store would exceed the budget", () => {
    const cssWidth = 1800;
    const cssHeight = 1100;
    const devicePixelRatio = 2;

    const result = dprEffectiveFor(cssWidth, cssHeight, devicePixelRatio);

    expect(result).toBeLessThan(devicePixelRatio);
    expect(result).toBeCloseTo(Math.sqrt(MAX_RENDER_PIXELS / (cssWidth * cssHeight)), 10);
  });

  // The guarantee itself, not the arithmetic behind it: whatever CSS size and
  // DPR arrive, the backing store this dprEffective produces never crosses the
  // budget it exists to enforce.
  it("never lets the resulting backing store exceed MAX_RENDER_PIXELS", () => {
    const cssWidth = 3840;
    const cssHeight = 2160;
    const devicePixelRatio = 3;

    const result = dprEffectiveFor(cssWidth, cssHeight, devicePixelRatio);
    const backingPixels = cssWidth * result * (cssHeight * result);

    expect(backingPixels).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1);
  });
});
