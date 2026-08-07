// A software rasteriser fills every pixel on the main thread, so cost is
// linear in width × height. Clamping the effective device pixel ratio rather
// than the CSS size is what lets a maximised window still fill edge to edge —
// the resolution degrades, the frame does not — and the clamp is visible
// rather than hidden, because the resolution HUD chip reports the real
// backing store this produces.

// About 1600 × 1000: comfortably sharper than the console's original
// 1024 × 640 seed on an ordinary window, while keeping a 4K display's fill
// cost within reach of 60fps on the main thread.
export const MAX_RENDER_PIXELS = 1600 * 1000;

export const dprEffectiveFor = (cssWidth: number, cssHeight: number, devicePixelRatio: number): number =>
  Math.min(devicePixelRatio, Math.sqrt(MAX_RENDER_PIXELS / (cssWidth * cssHeight)));
