// The ink the two diagnostic views draw with: WIRE's stroke and POINTS' dots.
//
// It used to be one constant spelled twice — Triangle.strokeWireframe and Mesh's
// POINT_INK — and it was a near-black. That was the right colour while there was
// only one scene for it to be right against: DEFAULT_SKY is true, the sky is a
// photograph of cloud and the checker floor's light cell is very nearly white,
// so dark ink is what reads over the shipped frame.
//
// HAL-174 gave the console a second frame and withdrew both of those layers for
// it. Nothing withdrew the ink with them, so a molecule in either diagnostic
// view was drawn in near-black on the black bgApp — every vertex on screen,
// every edge stroked, the GEOMETRY card counting all of it, and nothing to see.
// The ink is therefore not a constant but a reading of how much bright scenery
// is still standing, taken from the two reveals SceneryFade already computes and
// Main already reads once a frame for setLayers.
//
// Keyed to the scenery rather than to the MOLECULES family on purpose. What
// decides the contrast is what is behind the mesh, not what the mesh is: SKY and
// CHECKER FLOOR switched off by hand stand a solid on the same black ground and
// want the same white, and a molecule with either switched back on is in front
// of a bright layer again and wants the dark. Keying it to the family would make
// both of those the exceptions.

import { lerp } from "@animations/shapeTransition/easing";

import type { RGBA } from "@rendering/cssColor";

// The two ends, and the same alpha at both because it is doing the same job at
// both: the torus knot's wireframe piles thousands of edges into a few hundred
// pixels, and ink that composites is what keeps that reading as a mesh rather
// than as a silhouette.
const OVER_SCENERY: RGBA = [10, 20, 60, 0.95];
const OVER_VOID: RGBA = [255, 255, 255, 0.95];

// The brighter of the two layers wins, rather than a sum or an average. Either
// one alone is enough to put a light background behind the mesh — the sky fills
// the frame from the top edge down to the horizon, the floor fills what is below
// it — so the ink may only go white once both are gone. It also makes the two
// arguments symmetric, which is why they are safe as a pair of bare numbers.
export const diagnosticInk = (skyReveal: number, floorReveal: number): RGBA => {
  const scenery = Math.min(1, Math.max(0, Math.max(skyReveal, floorReveal)));

  return [
    Math.round(lerp(OVER_VOID[0], OVER_SCENERY[0], scenery)),
    Math.round(lerp(OVER_VOID[1], OVER_SCENERY[1], scenery)),
    Math.round(lerp(OVER_VOID[2], OVER_SCENERY[2], scenery)),
    // Lerped rather than taken from one end, so the two constants above stay the
    // whole definition of the ink and a later ticket that parts their alphas
    // does not have to remember this line.
    lerp(OVER_VOID[3], OVER_SCENERY[3], scenery),
  ];
};
