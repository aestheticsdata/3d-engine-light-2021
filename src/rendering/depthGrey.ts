// DEPTH mode's whole encoding (E3c/COS-243): eye-space depth as a grey ramp,
// near white and far black.
//
// The two edges are RenderStats' own depthNear/depthFar — camera.distance ± the
// largest bounding radius among the frame's renderables — which is what makes
// the ramp and the Z-BUFFER card's axis labels describe the same window. The
// ticket's other suggestion, a per-frame min/max of the submitted depths, would
// have been a different window from the one the card prints, and two readouts
// of one frame disagreeing is the thing this console is being de-mocked to stop.
//
// It is a bounding SPHERE, so a shape whose z-extent is smaller than its radius
// uses less than the full ramp: the cube's corners sit at 100√3 ≈ 173 while its
// faces span ±100, so its nearest face lands around 0.79 rather than at white.
// That is not a defect of the ramp — the histogram's bars pile up in the middle
// of their axis for exactly the same reason, and the two agreeing is the point.
//
// Camera's own near/far are the wrong pair and are deliberately not used: they
// are the view volume, tens of thousands of units deep, and every shape in the
// registry would encode as one indistinguishable grey.

import type { RGBA } from "@rendering/cssColor";

const CHANNEL_MAX = 255;

// depth is d, not 1/d — the caller undoes the buffer's reciprocal, because a
// ramp linear in 1/d crushes everything past the near edge into white.
//
// A zero span is real rather than defensive: boundingRadius is 0 for a frame
// with no renderables, and Surface3D still calls setDepthRange with the two
// equal numbers it folded. Everything then encodes as white, which is what a
// ramp with no range can honestly say.
export const depthLevel = (depth: number, near: number, far: number): number => {
  const span = far - near;
  const position = span === 0 ? 0 : (depth - near) / span;

  return Math.round((1 - Math.min(1, Math.max(0, position))) * CHANNEL_MAX);
};

// The painter path's form, where a face gets one grey rather than a ramp and
// the answer has to become a fillStyle. The rasteriser calls depthLevel above
// instead and writes the one number into its own scratch tuple: at a megapixel
// a frame, a returned triple is a million allocations a second.
export const depthGrey = (depth: number, near: number, far: number): RGBA => {
  const level = depthLevel(depth, near, far);

  return [level, level, level, 1];
};
