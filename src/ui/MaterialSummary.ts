// The texture derivation, owned once per shape and per material.
//
// Per material as well as per shape since E4a, and that is the substantive
// change: what a mesh samples is no longer a property of the registry entry
// alone. SOLID paints every triangle with the base colour and suppresses the
// cube's dog and galaxy faces, so a summary derived from the geometry would go
// on printing TEXTURED about a shape that is drawing no texture at all. The
// three surfaces describe what the renderer does, which has always been this
// module's whole claim.
//
// A triangle's fourth slot is either a colour or a texture key, and which one is
// the declared key set's answer rather than this module's. The prefix test that
// used to live here had no business being spelled in a UI file at all, and
// textureKeys records why it was wrong as well as where it went. A shape is
// TEXTURED when at least one of its triangles carries a declared key.
//
// The shape info panel needs the raw list of texture keys, and the status bar
// and viewport HUD need the two-value label. Both used to be free functions and
// the label re-ran the whole pipeline, so the two callers walked the same
// object twice and the three surfaces printing the same word about the same
// shape each derived it independently. Here they share one field, which makes
// them consistent by construction rather than by discipline — the drift this
// module has always said it exists to prevent.
//
// Ownership: drafted as texLabel.ts by the status-bar ticket because it was the
// first consumer to need the label; the shape info ticket extends this class
// rather than starting a second copy.

import { CHECKER_KEY, isTextureKey, UV_GRID_KEY } from "@textures/textureKeys";

import type { Object3D } from "@data/types";
import type { MeshMaterial } from "@rendering/material";

// Four values since E4b generated the two textures behind them. The two
// procedural members were held back deliberately while nothing could produce
// them — a union member no code path returns is dead code with a comment
// attached — and they arrived with the generators rather than before.
export type MaterialLabel = "TEXTURED" | "SOLID" | "CHECKER" | "UV GRID";

// What a mesh actually samples, which is a question about the material at least
// as much as about the geometry. SOLID samples nothing; a procedural mode
// samples one generated texture on every face, the cube's two bitmap faces
// included; AUTHORED alone defers to the shape files, which is what makes its
// answer identical to the one this class gave before it took a material at all.
const sampledKeys = (object3D: Object3D, material: MeshMaterial): string[] => {
  if (material.mode === CHECKER_KEY || material.mode === UV_GRID_KEY) {
    return [material.mode];
  }

  if (material.mode === "solid") {
    return [];
  }

  return object3D.triangles.map((triangle) => triangle[3]).filter(isTextureKey);
};

// The word the three surfaces print, which is the mode's own where the mode has
// one and the geometry's answer where it does not. Not derived from the key list
// alone: "checker" is the key and "CHECKER" is the label, and inferring one from
// the other by uppercasing would be a rule that breaks on the next key with two
// words in it — as UV GRID already does.
const labelFor = (keys: readonly string[], material: MeshMaterial): MaterialLabel => {
  if (material.mode === CHECKER_KEY) {
    return "CHECKER";
  }

  if (material.mode === UV_GRID_KEY) {
    return "UV GRID";
  }

  return keys.length > 0 ? "TEXTURED" : "SOLID";
};

class MaterialSummary {
  private readonly keys: readonly string[];
  private readonly word: MaterialLabel;

  constructor(object3D: Object3D, material: MeshMaterial) {
    // Frozen rather than copied on every read. The list is derived once per
    // shape change, and a caller that reaches for .sort() should fail loudly
    // instead of quietly reordering what the panel is about to print.
    this.keys = Object.freeze(Array.from(new Set(sampledKeys(object3D, material))));
    this.word = labelFor(this.keys, material);
  }

  public get textureKeys(): readonly string[] {
    return this.keys;
  }

  public get label(): MaterialLabel {
    return this.word;
  }
}

export default MaterialSummary;
