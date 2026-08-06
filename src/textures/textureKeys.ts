// Which strings in a triangle's fourth slot name a texture, declared once.
//
// A slot is either a CSS colour or a texture key, and the console used to tell
// them apart by testing whether the string began with `rgba` — which is wrong
// the moment a shape author writes a hex colour, and which had to be spelled the
// same way in every place that asked. Membership in a declared set is the honest
// test: a key is a texture because this module says so, not because of how its
// characters happen to begin.
//
// The registry is deliberately not the owner of this. TextureRegistry.has()
// answers "is this bitmap decoded yet", which is a different question wearing
// the same shape — classifying through it would read a slow-loading texture as
// a colour. It is also the wrong lifetime: Triangle classifies its slot when the
// mesh is built and only meets the registry later, through the render options.
//
// Not a data table alone, and that is why the predicate lives beside it: the set
// is derived from the URL record so the two cannot drift, and E4b's procedural
// keys join the set without having a URL at all.

import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";

// key -> URL, the record TextureRegistry.load consumes at boot.
const imageTextures: Record<string, string> = {
  dog: dogUrl,
  galaxy: galaxyUrl,
};

const declaredKeys: ReadonlySet<string> = new Set(Object.keys(imageTextures));

// `unknown` rather than `string`, and the typeof guard is not defensive padding:
// nothing in this project runs under strictNullChecks, so a malformed fourth
// slot reaches here as `undefined` rather than as a compile error.
export const isTextureKey = (slot: unknown): slot is string => typeof slot === "string" && declaredKeys.has(slot);

export default imageTextures;
