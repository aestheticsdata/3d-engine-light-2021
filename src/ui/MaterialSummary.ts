// The texture derivation, owned once per shape.
//
// A triangle's fourth slot is either a colour (an `rgba(...)` string) or a
// texture key. Anything that is not an rgba string is therefore a texture, and
// a shape is TEXTURED when at least one of its triangles carries one.
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

import type { Object3D } from "@data/types";

export type MaterialLabel = "TEXTURED" | "SOLID";

// The runtime check earns its keep even though the tuple types slot 3 as a
// string: nothing in this project runs under strictNullChecks, so malformed
// geometry reaches here as `undefined` rather than as a compile error.
const isTextureKey = (material: unknown): material is string =>
  typeof material === "string" && !material.startsWith("rgba");

class MaterialSummary {
  private readonly keys: readonly string[];

  constructor(object3D: Object3D) {
    // Frozen rather than copied on every read. The list is derived once per
    // shape change, and a caller that reaches for .sort() should fail loudly
    // instead of quietly reordering what the panel is about to print.
    this.keys = Object.freeze(
      Array.from(new Set(object3D.triangles.map((triangle) => triangle[3]).filter(isTextureKey))),
    );
  }

  public get textureKeys(): readonly string[] {
    return this.keys;
  }

  public get label(): MaterialLabel {
    return this.keys.length > 0 ? "TEXTURED" : "SOLID";
  }
}

export default MaterialSummary;
