// The display formula, counted from the atom array — never declared. A formula
// is not a structure (C₂H₆O is ethanol AND dimethyl ether), so the arrow only
// points this way: the file states atoms, the formula is read off them, and it
// cannot contradict the mesh because it is read off the same array the mesh is
// built from.
//
// Ordering: with carbon present, Hill order — carbon first, hydrogen second,
// everything else alphabetically. Without carbon, the IUPAC element sequence
// rather than strict Hill's alphabetical run, and the difference is one
// molecule wide but load-bearing: strict Hill files ammonia as H₃N — that is
// how PubChem indexes it — and this string is a display for a teaching card,
// not an index entry. The sequence cites nitrogen before hydrogen before
// oxygen, which yields the NH₃ and H₂O a reader expects. HAL-162's cross-check
// compares atomCounts, not this string, so the two conventions never collide.
//
// Unicode subscripts (U+2080–U+2089), never <sub>: every writer in this
// console is textContent, and a formula is not the reason to introduce the
// first innerHTML.

import { atomCounts } from "@data/molecules/atomCounts";

import type { ElementSymbol } from "@data/molecules/elements";
import type { Atom } from "@data/molecules/types";

const SUBSCRIPT_ZERO = 0x2080;

// The IUPAC citation sequence, restricted to the element table and checked
// against it: a fifth element added to the table refuses to compile until it is
// ranked here. Carbon is absent because the Hill branch handles it first.
const CITATION_RANK = { N: 0, H: 1, O: 2 } satisfies Record<Exclude<ElementSymbol, "C">, number>;

// A narrowing, not a cast: the no-carbon branch cannot contain carbon by
// construction, and this is how the type system is told so.
const isCitationRanked = (symbol: ElementSymbol): symbol is keyof typeof CITATION_RANK => symbol in CITATION_RANK;

// A count of 1 prints no digit — H₂O, never H₂O₁. Multi-digit counts map digit
// by digit, so a future C₆H₁₂O₆ subscripts its 12 correctly.
const subscript = (count: number): string =>
  count === 1 ? "" : String(count).replace(/\d/g, (digit) => String.fromCharCode(SUBSCRIPT_ZERO + Number(digit)));

export const moleculeFormula = (atoms: Atom[]): string => {
  const counts = atomCounts(atoms);
  const present = [...new Set(atoms.map((atom) => atom.element))];

  const ordered = present.includes("C")
    ? [
        ...present.filter((symbol) => symbol === "C"),
        ...present.filter((symbol) => symbol === "H"),
        ...present.filter((symbol) => symbol !== "C" && symbol !== "H").sort(),
      ]
    : present.filter(isCitationRanked).sort((a, b) => CITATION_RANK[a] - CITATION_RANK[b]);

  return ordered.map((symbol) => `${symbol}${subscript(counts[symbol] ?? 0)}`).join("");
};
