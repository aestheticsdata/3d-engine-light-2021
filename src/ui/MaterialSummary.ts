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

import { isTextureKey } from "@textures/textureKeys";

import type { Object3D } from "@data/types";
import type { MeshMaterial } from "@rendering/material";

// Still two values, not four. E4b's CHECKER and UV GRID are unreachable until
// its generators exist, and a union member nothing can produce is dead code with
// a comment attached; that ticket widens this when it can also return them.
export type MaterialLabel = "TEXTURED" | "SOLID";

class MaterialSummary {
  private readonly keys: readonly string[];

  constructor(object3D: Object3D, material: MeshMaterial) {
    // SOLID overrides the authored slot entirely, so nothing is sampled and the
    // list is empty by construction rather than by filtering. The other modes
    // defer to the geometry, which is what makes AUTHORED's answer identical to
    // the one this class gave before it took a material at all.
    const sampled =
      material.mode === "solid" ? [] : object3D.triangles.map((triangle) => triangle[3]).filter(isTextureKey);

    // Frozen rather than copied on every read. The list is derived once per
    // shape change, and a caller that reaches for .sort() should fail loudly
    // instead of quietly reordering what the panel is about to print.
    this.keys = Object.freeze(Array.from(new Set(sampled)));
  }

  public get textureKeys(): readonly string[] {
    return this.keys;
  }

  public get label(): MaterialLabel {
    return this.keys.length > 0 ? "TEXTURED" : "SOLID";
  }
}

export default MaterialSummary;
