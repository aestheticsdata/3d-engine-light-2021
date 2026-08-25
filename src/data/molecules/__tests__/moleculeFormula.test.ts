// The five starter molecules, exactly as the epic's cards will badge them —
// subscripts included, because the assertion is about the display string, not
// about the counting underneath it.
//
// The ordering assertions pin the convention the module's header records: Hill
// for carbon compounds, the IUPAC citation sequence otherwise. Strict Hill
// would file ammonia as H₃N — the check that nitrogen leads is what keeps a
// well-meaning "fix" toward the textbook rule from silently changing a card.

import { moleculeFormula } from "@data/molecules/moleculeFormula";
import { describe, expect, it } from "vitest";

import type { ElementSymbol } from "@data/molecules/elements";
import type { Atom } from "@data/molecules/types";

const atoms = (...symbols: ElementSymbol[]): Atom[] => symbols.map((element) => ({ element, position: [0, 0, 0] }));

describe("moleculeFormula", () => {
  it("prints the five starter molecules exactly as their cards will", () => {
    expect(moleculeFormula(atoms("O", "H", "H"))).toBe("H₂O");
    expect(moleculeFormula(atoms("C", "H", "H", "H", "H"))).toBe("CH₄");
    expect(moleculeFormula(atoms("N", "H", "H", "H"))).toBe("NH₃");
    expect(moleculeFormula(atoms("O", "C", "O"))).toBe("CO₂");
    expect(moleculeFormula(atoms("C", "H", "C", "H", "C", "H", "C", "H", "C", "H", "C", "H"))).toBe("C₆H₆");
  });

  it("is a count, not a walk: shuffling the atom array changes nothing", () => {
    expect(moleculeFormula(atoms("H", "O", "H"))).toBe("H₂O");
    expect(moleculeFormula(atoms("H", "H", "H", "H", "C"))).toBe("CH₄");
  });

  it("leads with C then H when carbon is present", () => {
    expect(moleculeFormula(atoms("O", "O", "C"))).toBe("CO₂");
    expect(moleculeFormula(atoms("H", "C", "N"))).toBe("CHN");
  });

  it("follows the citation sequence when carbon is absent: N before H before O", () => {
    expect(moleculeFormula(atoms("H", "H", "O"))).toBe("H₂O");
    expect(moleculeFormula(atoms("H", "H", "H", "N"))).toBe("NH₃");
  });

  it("prints no digit for a count of one", () => {
    expect(moleculeFormula(atoms("O", "H", "H"))).not.toContain("₁");
  });

  it("subscripts a multi-digit count digit by digit", () => {
    const dodecahedrane = atoms(...Array.from({ length: 20 }, (): ElementSymbol => "C"));

    expect(moleculeFormula(dodecahedrane)).toBe("C₂₀");
  });
});
