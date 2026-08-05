// The short uppercase name a SHAPE chip carries, e.g. `torusKnot` -> TKNOT.
//
// Deliberately built on primitiveLabel() rather than beside it. The two are
// different derivations for different surfaces — primitiveLabel title-cases a
// key for SHAPE INFO's NAME row and SHAPE STORY's fallback, this one shortens
// it to fit a 66px chip — but there must be exactly one place in the repo that
// knows how to split a camelCase registry key into words. A second regex here
// is the drift the epic's one-derivation rule exists to prevent, and the
// near-identical filenames make it the easiest one in the set to introduce by
// accident.
//
// The map is the editorial layer on top: TKNOT and CUBOCT are abbreviations a
// derivation cannot invent. Anything not in it falls back to the derived form,
// so a key added by COS-201 gets a readable chip on the day it lands and an
// entry here only if the derived form reads badly.

import { primitiveLabel } from "@ui/primitiveLabel";

const MAX_CHIP_CHARACTERS = 8;

const SHORT_LABELS: Record<string, string> = {
  torusKnot: "TKNOT",
  cuboctahedron: "CUBOCT",
  rhombicDodecahedron: "RHOMBDOD",
  kisRhombicDodecahedron: "KISRHDOD",
  truncatedCuboctahedron: "TRCUBOCT",
  truncatedIcosidodecahedron: "TRICOSID",
  icosidodecahedron: "ICOSIDOD",
  rhombicTriacontahedron: "RHOMBTRI",
  kisRhombicTriacontahedron: "KISRHTRI",
};

export const primitiveChipLabel = (name: string): string => {
  const mapped = SHORT_LABELS[name];

  if (mapped) {
    return mapped;
  }

  // Spaces go rather than being truncated with the word: "Torus Knot" would
  // otherwise become "TORUS KN", which reads as a typo where TORUSKNO reads as
  // an abbreviation.
  return primitiveLabel(name)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, MAX_CHIP_CHARACTERS);
};
