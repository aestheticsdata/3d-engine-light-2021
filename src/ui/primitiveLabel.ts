// The human-readable name for a primitive key, derived in exactly one place.
//
// SHAPE INFO's NAME row prints it, and SHAPE STORY falls back to it when a
// primitive has no write-up. Two surfaces, one derivation — the same reason
// sceneObjectId exists.
//
//   torusKnot              -> Torus Knot
//   kisRhombicDodecahedron -> Kis Rhombic Dodecahedron
//   cube                   -> Cube

export const primitiveLabel = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
