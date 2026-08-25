// Element → count, the one walk over an atom array. Its own module because two
// things need it: the formula beside it, and HAL-162's build-time cross-check
// against PubChem's MolecularFormula, which compares counts rather than
// strings. Deriving the counts twice is how those two answers would eventually
// disagree.

import type { ElementSymbol } from "@data/molecules/elements";
import type { Atom } from "@data/molecules/types";

export const atomCounts = (atoms: Atom[]): Partial<Record<ElementSymbol, number>> => {
  const counts: Partial<Record<ElementSymbol, number>> = {};

  for (const atom of atoms) {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  }

  return counts;
};
