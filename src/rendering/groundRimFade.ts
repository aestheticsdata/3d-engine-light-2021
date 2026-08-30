// Where the checker floor stops being floor: one alpha, from one radius in the
// ground plane.
//
// The pure half of the pair GroundFloor opens, split out for the reason
// cssColor's blend was — the class needs a canvas and 900 projected cells to
// reach this arithmetic, and a dissolve that can only be exercised through a
// canvas is a dissolve nothing asserts. Nothing here touches the projection, the
// fog or the context, so the whole of it runs in the node suite.
//
// Keyed on the plane's own radius rather than on depth from the eye. The sheet
// is finite, so its rim is the thing that must never be visible as an edge — and
// the rim is a circle in the plane whatever the camera is doing, while depth
// stops tracking it the moment the view goes grazing or drops underneath.

import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";

// The outer share of the ground's radius that the rim dissolve occupies. The
// inner three-quarters stay fully opaque: a fade that starts at the middle is
// not a horizon, it is a translucent floor — the sky reads straight through the
// ground the user is standing over, which is not what any of this is for.
export const RIM_FADE_FRACTION = 0.25;

// `reveal` scales the disc's whole reach, rim band and all (HAL-174), so the far
// cells go first and the last floor standing is the patch directly under the
// shape before it too collapses. At a reveal of 1 every line below is
// arithmetically the one that shipped.
//
// The early return is not only the cheap path: at a reveal of 0 the reach and
// the rim are both 0, and the ratio would be 0/0 at the exact centre.
export const rimFadeAt = (radius: number, reveal: number): number => {
  if (reveal <= 0) {
    return 0;
  }

  const reach = metresToUnits(GROUND_DEPTH_METRES) * reveal;
  const rim = reach * RIM_FADE_FRACTION;
  const beyond = radius - (reach - rim);

  if (beyond <= 0) {
    return 1;
  }

  const remaining = Math.max(0, 1 - beyond / rim);

  // Smoothstep rather than linear, so the disc meets full opacity without a
  // visible ring where the ramp begins.
  return remaining * remaining * (3 - 2 * remaining);
};
