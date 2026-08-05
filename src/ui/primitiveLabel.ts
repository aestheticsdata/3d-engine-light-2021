// The human-readable name for a primitive key, derived in exactly one place.
//
// SHAPE INFO's NAME row prints it, and SHAPE STORY falls back to it when a
// primitive has no write-up. Two surfaces, one derivation — the same reason
// sceneObjectId exists.
//
//   torusKnot              -> Torus Knot
//   kisRhombicDodecahedron -> Kis Rhombic Dodecahedron
//   torusKnot25            -> Torus Knot 25
//   cube                   -> Cube
//
// The digit rule arrived with COS-410's knot keys, which carry their (p, q) in
// the name. Without it the NAME row reads "Torus Knot25", which looks like a
// typo rather than like a parameter — and the alternative, renaming the keys to
// avoid digits, would cost the one thing that tells four near-identical
// thumbnails apart.

export const primitiveLabel = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
