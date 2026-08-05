// The (2, 5) torus knot, 5₁ — Solomon's seal, or the cinquefoil.
//
// Amber, both tones. The two-tone checker averages out at thumbnail size, so
// what separates four near-identical knots at 44px is the HUE that average
// lands on, not the contrast within the pair: the trefoil reads pink, this one
// amber, 7₁ green, 8₁₉ cyan. A light/dark pair from opposite sides of the wheel
// would give a saturated braid at full size and grey mud in the picker.

import TorusKnotGenerator from "@data/shapes/TorusKnotGenerator";

import type { Object3D } from "@data/types";

const torusKnot25: Object3D = new TorusKnotGenerator({
  p: 2,
  q: 5,
  lightCell: "rgba(255, 214, 130,1)",
  darkCell: "rgba(196, 116, 24,1)",
}).build();

export default torusKnot25;
