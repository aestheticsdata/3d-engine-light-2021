// The (2, 7) torus knot, 7₁ — the septafoil.
//
// The longest curve of the four, and the one the tessellation budget bites
// hardest: 396 path segments leave exactly ten tube segments.
//
// Green, both tones — see torusKnot25.ts for why the pair shares a hue.

import TorusKnotGenerator from "@data/shapes/TorusKnotGenerator";

import type { Object3D } from "@data/types";

const torusKnot27: Object3D = new TorusKnotGenerator({
  p: 2,
  q: 7,
  lightCell: "rgba(158, 240, 158,1)",
  darkCell: "rgba(32, 138, 74,1)",
}).build();

export default torusKnot27;
