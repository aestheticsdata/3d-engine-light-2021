// The summed standard atomic weights, as a number. The panel formats it: a
// derivation that returns a string has decided how it will be printed and can
// only be used once.

import elements from "@data/molecules/elements";

import type { Atom } from "@data/molecules/types";

export const molarMass = (atoms: Atom[]): number =>
  atoms.reduce((total, atom) => total + elements[atom.element].weight, 0);
