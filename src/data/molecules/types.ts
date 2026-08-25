// The shapes of the molecule data layer, and nothing else — the same contract
// as src/data/types.ts one level up.
//
// The one import is type-only and erased at compile time, so the emitted
// module still imports nothing at runtime. It exists because the element union
// must be derived FROM the table in elements.ts — that derivation is what makes
// an unknown element a compile error — and a type import is the only way to
// point at it without putting a module on the value graph.

import type { ElementSymbol } from "@data/molecules/elements";

// Positions are in Ångströms, the unit every SDF record uses, never engine
// units. The generator scales; the file stays checkable against the source it
// was typed from, without dividing by anything.
export interface Atom {
  element: ElementSymbol;
  position: [number, number, number];
}

// `a` and `b` are indices into the molecule's atom array. `order` ships now
// even though every bond draws as a single rod: the prose depends on it — CO₂
// IS two double bonds — and adding the field later would mean editing every
// molecule file instead of one.
export interface Bond {
  a: number;
  b: number;
  order: 1 | 2 | 3;
}

export interface Molecule {
  name: string;
  atoms: Atom[];
  bonds: Bond[];
}
