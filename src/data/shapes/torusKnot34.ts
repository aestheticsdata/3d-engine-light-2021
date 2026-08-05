// The (3, 4) torus knot, 8₁₉ — the first of the four with p > 2, so it winds
// three times around the main axis instead of two and reads as a genuinely
// different object rather than as a trefoil with more lobes.
//
// Cyan, both tones — see torusKnot25.ts for why the pair shares a hue.

import TorusKnotGenerator from "@data/shapes/TorusKnotGenerator";

import type { Object3D } from "@data/types";

const torusKnot34: Object3D = new TorusKnotGenerator({
  p: 3,
  q: 4,
  lightCell: "rgba(150, 232, 245,1)",
  darkCell: "rgba(24, 130, 168,1)",
}).build();

export default torusKnot34;
