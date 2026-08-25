// The count is what HAL-162 will hold against PubChem's MolecularFormula, so
// what is asserted here is that it is a count and nothing else: no order
// sensitivity, no phantom zero entries for elements a molecule does not carry.

import { atomCounts } from "@data/molecules/atomCounts";
import { describe, expect, it } from "vitest";

import type { ElementSymbol } from "@data/molecules/elements";
import type { Atom } from "@data/molecules/types";

const atom = (element: ElementSymbol): Atom => ({ element, position: [0, 0, 0] });

describe("atomCounts", () => {
  it("counts each element the atom array carries, and only those", () => {
    const water = [atom("O"), atom("H"), atom("H")];

    expect(atomCounts(water)).toEqual({ O: 1, H: 2 });
  });

  it("does not depend on the order the atoms are declared in", () => {
    const declared = [atom("C"), atom("O"), atom("O")];
    const shuffled = [atom("O"), atom("C"), atom("O")];

    expect(atomCounts(shuffled)).toEqual(atomCounts(declared));
  });

  it("returns an empty record for an empty atom array", () => {
    expect(atomCounts([])).toEqual({});
  });
});
