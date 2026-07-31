// The texture derivation, in one place.
//
// A triangle's fourth slot is either a colour (an `rgba(...)` string) or a
// texture key. Anything that is not an rgba string is therefore a texture, and
// a shape is TEXTURED when at least one of its triangles carries one.
//
// The shape info panel needs the raw list of texture keys, and the status bar
// and viewport HUD need the two-value label — so both are exported here rather
// than derived twice. Three surfaces printing the same word about the same
// shape is exactly the drift this module exists to prevent.
//
// Ownership: drafted here by the status-bar ticket because it was the first
// consumer to need the label; the shape info ticket extends this module rather
// than starting a second copy.

import { Object3D } from "@data/types";

export const textureKeys = (object3D: Object3D): string[] =>
  Array.from(
    new Set(
      object3D.triangles
        .map((triangle) => triangle[3])
        .filter(
          (material) =>
            typeof material === "string" && !material.startsWith("rgba"),
        ),
    ),
  ) as string[];

export const texLabel = (object3D: Object3D): "TEXTURED" | "SOLID" =>
  textureKeys(object3D).length > 0 ? "TEXTURED" : "SOLID";
