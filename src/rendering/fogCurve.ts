// The fog curve, and the colour a fogged surface fades toward.
//
// Beer-Lambert, so exponential rather than linear: a uniform medium removes a
// fixed FRACTION of what is left over each unit travelled, which integrates to
// 1 - exp(-d/k) and approaches full occlusion without ever arriving. A linear
// ramp needs a far edge to ramp to, and that edge is then visible as the one
// depth where everything goes flat at once — which is the artefact fog exists to
// hide.
//
// Pure and stateless beside the class that holds the values, the same pair
// lightDirection.ts and Lighting.ts already make: the curve is the half worth
// asserting, and `pnpm test` runs in node.

import { metresToUnits } from "@rendering/worldScale";
import { chartTokens } from "@ui/chartTokens";

// A @ui import from inside @rendering, which is the wrong direction and is the
// lesser evil for the reason BackgroundRenderer and GroundGrid already record:
// chartTokens is the one file sanctioned to hand-mirror colors.css for canvas
// painting, and the alternative is a third mirror.

// 9 m, through the one conversion E5a left for it. It is the distance over which
// the medium hides 63% of what is behind it, and it is tuned against the ground
// rather than against the shape: GROUND_DEPTH_METRES is 60, so the far rim of the
// floor sits at nearly seven falloffs and reads as fully fogged, while a 2 m shape
// at the resting distance spans less than a quarter of one.
export const FOG_FALLOFF = metresToUnits(9);

// Below this the extra fill changes nothing a screen can show, and on the torus
// knot there would be 8008 of them. The threshold belongs to the curve rather
// than to each caller, so the mesh, the floor and the grid all give up at the
// same point.
export const FOG_THRESHOLD = 0.02;

// The sky gradient's ground-side stop, which is also what the fog fades toward,
// which is why it lives here and the gradient reads it rather than the other way
// round. It is deliberately NOT in chartTokens: that file's whole contract is
// being a hand-mirror of colors.css, and this colour has no custom property
// behind it — the sky gradient is canvas-only. Extracting one of its four stops
// into the palette file and leaving the other three inline would be arbitrary;
// extracting it here is the one thing that has a reason, which is that two
// layers must agree on it.
export const SKY_HORIZON = "#f1e8ee";

// How much of the background has replaced the surface at `depth`, where depth is
// the projection's own denominator — distance from the eye rather than world z,
// so the falloff stays put as the camera turns instead of sweeping round with it.
//
// `near` is where the medium starts, not where the view volume does: the near
// side of the subject has to read as unfogged, or FOG at any setting tints the
// whole shape evenly and looks like a colour change rather than a distance.
export const fogFactor = (depth: number, near: number, amount: number): number => {
  if (amount <= 0 || depth <= near) {
    return 0;
  }

  return amount * (1 - Math.exp(-(depth - near) / FOG_FALLOFF));
};

// What the fog fades toward has to be what the frame fades toward, or the haze
// reads as a grey film laid over the scene rather than as air in it. With the sky
// on, that is the horizon the shape recedes into; with it off, BackgroundRenderer
// fills the frame flat with the app background, so that is the answer instead.
export const fogColor = (skyEnabled: boolean): string => (skyEnabled ? SKY_HORIZON : chartTokens.bgApp);
