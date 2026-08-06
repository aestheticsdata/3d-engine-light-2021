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
import { CHECKER_KEY, isTextureKey, UV_GRID_KEY } from "@textures/textureKeys";

import type { RGBA } from "@rendering/cssColor";

// The two procedural members are spelled with the same strings as the texture
// keys ProceduralTextures registers, and the branch below returns the mode
// itself as the key. One vocabulary for the chip, the resolver and the registry.
export type TextureMode = "authored" | "checker" | "uvGrid" | "solid";

export interface MeshMaterial {
  mode: TextureMode;
  // A CSS colour, not the palette name the swatch row is keyed by: the UI owns
  // the palette and hands over what it resolved, so the engine never has to
  // know that a colour called "green" exists.
  baseColor: string;
  // How many copies of a procedural texture cross one unit of UV. Read only in
  // the two procedural modes — see ResolvedMaterial.uvScale below for why it
  // cannot be read in the other two.
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
  // The tiling this triangle's texture is sampled at, resolved rather than read
  // off the mesh material — which is what makes UV SCALE inert outside the two
  // procedural modes. It has to be: the row ships at 8, and a scale that applied
  // in AUTHORED would open the console on the cube wearing sixty-four dogs. In
  // the procedural modes it applies to the cube's authored coordinates and to
  // the nineteen generated sets alike, so one shape does not tile at two
  // densities.
  uvScale: number;
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

// One copy of the texture across one unit of UV, which is what the affine solve
// did before a scale existed and is therefore what every non-procedural mode has
// to keep resolving to.
const UNSCALED = 1;

export const classifyMaterial = (slot: string): AuthoredMaterial =>
  isTextureKey(slot) ? { kind: "texture", key: slot } : { kind: "color", css: slot, rgba: parseCssColor(slot) };

export const resolveMaterial = (authored: AuthoredMaterial, material: MeshMaterial): ResolvedMaterial => {
  // Parsed ahead of the branches rather than inside the multiply below, because
  // SOLID needs the same numbers now: the key light shades a solid mesh exactly
  // as it shades a blended one, so every branch that returns a colour has to
  // return its channels beside it.
  const base = parseCssColor(material.baseColor);

  // The two generated textures override the authored slot for the same reason
  // SOLID does, and completely: every triangle samples the same texture, the
  // cube's two bitmap faces included. A mode that left the dog showing would not
  // be a checker on the cube, it would be a checker on four sixths of it.
  //
  // The fill beside the key is the base colour rather than the key string, and
  // unlike the authored-texture branch below it is genuinely reachable: it is
  // what a face falls back to when its UV triangle turns out degenerate, which
  // the spherical projection can produce on any solid with two vertices on one
  // ray. Carrying the channels means that face is still lit rather than flat.
  if (material.mode === CHECKER_KEY || material.mode === UV_GRID_KEY) {
    return { fill: material.baseColor, rgba: base, textureKey: material.mode, uvScale: material.uvScale };
  }

  // SOLID is the one mode that ignores the authored slot entirely, textures
  // included: every triangle becomes the base colour, which is what makes it the
  // mode for looking at a shape's geometry rather than its surface.
  if (material.mode === "solid") {
    return { fill: material.baseColor, rgba: base, textureKey: null, uvScale: UNSCALED };
  }

  if (authored.kind === "texture") {
    // The fill is the raw key, which paints nothing recognisable — deliberately
    // kept from before this module existed. It is only ever reached by a
    // texture-authored triangle with no UVs, which the registry does not
    // contain, and a loud wrong colour is the right outcome if one appears.
    return { fill: authored.key, rgba: null, textureKey: authored.key, uvScale: UNSCALED };
  }

  if (!authored.rgba || !base) {
    // The authored channels survive an unreadable BASE: the blend is what fails
    // there, not the colour, so a shape still lights correctly while the swatch
    // does nothing.
    return { fill: authored.css, rgba: authored.rgba, textureKey: null, uvScale: UNSCALED };
  }

  const blended = multiplyColor(authored.rgba, base);

  return { fill: formatRgba(blended), rgba: blended, textureKey: null, uvScale: UNSCALED };
};
