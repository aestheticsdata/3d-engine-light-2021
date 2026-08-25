// The masses the MOLECULE PROPERTIES card will print, held to two decimals —
// the panel's own display precision. The derivation returns the raw number and
// the formatting here is the test's, which is exactly the split the module
// header commits to.

import { molarMass } from "@data/molecules/molarMass";
import { describe, expect, it } from "vitest";

import type { ElementSymbol } from "@data/molecules/elements";
import type { Atom } from "@data/molecules/types";

const atoms = (...symbols: ElementSymbol[]): Atom[] => symbols.map((element) => ({ element, position: [0, 0, 0] }));

describe("molarMass", () => {
  it("lands each starter molecule on its published mass at two decimals", () => {
    expect(molarMass(atoms("O", "H", "H")).toFixed(2)).toBe("18.02");
    expect(molarMass(atoms("C", "H", "H", "H", "H")).toFixed(2)).toBe("16.04");
    expect(molarMass(atoms("N", "H", "H", "H")).toFixed(2)).toBe("17.03");
    expect(molarMass(atoms("O", "C", "O")).toFixed(2)).toBe("44.01");
    expect(molarMass(atoms("C", "C", "C", "C", "C", "C", "H", "H", "H", "H", "H", "H")).toFixed(2)).toBe("78.11");
  });

  it("returns a number, not a formatted string", () => {
    expect(molarMass(atoms("O", "H", "H"))).toBeCloseTo(18.015, 3);
  });

  it("sums to zero over no atoms", () => {
    expect(molarMass([])).toBe(0);
  });
});
