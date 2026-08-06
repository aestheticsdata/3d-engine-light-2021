// The runtime material: what the whole mesh is made of, resolved against what
// each triangle was authored as.
//
// The registry's per-triangle slot is not migrated and is not going to be. It is
// what makes the shape files worth reading — the sphere alternates two colours
// by `(lat + lon) % 2`, the Menger sponge picks six by face, the Archimedean
// solids colour by face arity — and a per-mesh material that replaced all of
// that would flatten twenty primitives into one. So the slot stays, reclassified
// once at mesh-build time into an AuthoredMaterial, and the mesh material below
// says what to do with it.
//
// The per-triangle override is therefore the left-hand column of the table
// existing at all: in `authored` mode the slot decides what is drawn, which is
// how the cube goes on mixing four flat faces with two textured ones while the
// whole mesh still answers to one object.
//
// Resolution runs when the material changes, never per frame. Triangle caches
// what comes out of here.

import { formatRgba, multiplyColor, parseCssColor } from "@rendering/cssColor";
import { isTextureKey } from "@textures/textureKeys";

import type { RGBA } from "@rendering/cssColor";

// `checker` and `uvGrid` are declared but resolve as `authored` until E4b builds
// the generators behind them, which is exactly what their chips promise: they
// store the choice and change nothing. Declaring them now is what keeps the two
// tickets from disagreeing about the vocabulary.
export type TextureMode = "authored" | "checker" | "uvGrid" | "solid";

export interface MeshMaterial {
  mode: TextureMode;
  // A CSS colour, not the palette name the swatch row is keyed by: the UI owns
  // the palette and hands over what it resolved, so the engine never has to
  // know that a colour called "green" exists.
  baseColor: string;
  // Nothing reads this yet — the tiling it scales is E4b's. It is declared here
  // rather than added later so the model does not change shape twice.
  uvScale: number;
}

// `rgba` is null when the string is not one of the forms cssColor parses, and
// `css` is kept verbatim beside it so an unblendable colour still draws as the
// registry authored it.
export type AuthoredMaterial = { kind: "color"; css: string; rgba: RGBA | null } | { kind: "texture"; key: string };

// `rgba` is the numeric form of `fill`, kept rather than recomputed (E3a): the
// key light multiplies the colour that actually reaches the canvas, which is the
// product of the authored slot and the BASE swatch, not either one alone. Parsing
// `fill` back per triangle per frame would be a second parse of a string this
// function built from numbers it already had.
//
// Null means "do not light this": a texture key, or a colour cssColor could not
// read. Both fall back to painting `fill` as-is, which is what they did before a
// light existed.
export interface ResolvedMaterial {
  fill: string;
  rgba: RGBA | null;
  textureKey: string | null;
}

// White, as a literal rather than through --color-swatch-white: this is the
// identity of the multiply below, so it has to be exactly 255 on every channel
// and cannot follow a token someone might restyle. A mesh built before anything
// pushes a material resolves through this and therefore draws what the registry
// authored, which is what keeps the opening frame where it was.
export const DEFAULT_MESH_MATERIAL: MeshMaterial = Object.freeze({
  mode: "authored",
  baseColor: "#ffffff",
  uvScale: 8,
});

export const classifyMaterial = (slot: string): AuthoredMaterial =>
  isTextureKey(slot) ? { kind: "texture", key: slot } : { kind: "color", css: slot, rgba: parseCssColor(slot) };

export const resolveMaterial = (authored: AuthoredMaterial, material: MeshMaterial): ResolvedMaterial => {
  // Parsed ahead of the branches rather than inside the multiply below, because
  // SOLID needs the same numbers now: the key light shades a solid mesh exactly
  // as it shades a blended one, so every branch that returns a colour has to
  // return its channels beside it.
  const base = parseCssColor(material.baseColor);

  // SOLID is the one mode that ignores the authored slot entirely, textures
  // included: every triangle becomes the base colour, which is what makes it the
  // mode for looking at a shape's geometry rather than its surface.
  if (material.mode === "solid") {
    return { fill: material.baseColor, rgba: base, textureKey: null };
  }

  if (authored.kind === "texture") {
    // The fill is the raw key, which paints nothing recognisable — deliberately
    // kept from before this module existed. It is only ever reached by a
    // texture-authored triangle with no UVs, which the registry does not
    // contain, and a loud wrong colour is the right outcome if one appears.
    return { fill: authored.key, rgba: null, textureKey: authored.key };
  }

  if (!authored.rgba || !base) {
    // The authored channels survive an unreadable BASE: the blend is what fails
    // there, not the colour, so a shape still lights correctly while the swatch
    // does nothing.
    return { fill: authored.css, rgba: authored.rgba, textureKey: null };
  }

  const blended = multiplyColor(authored.rgba, base);

  return { fill: formatRgba(blended), rgba: blended, textureKey: null };
};
