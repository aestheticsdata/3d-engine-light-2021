// Benzene — twelve atoms in one plane, and the file with the least
// trigonometry in it for the most atoms: a regular hexagon's side equals its
// circumradius, so both shells are one radius and six shared azimuths.
//
// SOURCED: r(C–C) = 1.397 Å, r(C–H) = 1.084 Å, ∠CCC = ∠HCC = 120°, point
// group D6h — Herzberg, "Electronic Spectra and Electronic Structure of
// Polyatomic Molecules" (Van Nostrand, 1966), the determination NIST CCCBDB
// serves as benzene's experimental geometry. The third file in this family to
// cite that one volume, after ammonia's and carbon dioxide's.
//
// HAL-161 asked for 1.39 and 1.09, and those are the rounded teaching pair
// rather than a determination — no source publishes them as a measurement.
// Recorded rather than quietly substituted, because the difference is visible
// in the fifth decimal of every coordinate below and someone checking this
// file against the ticket would otherwise read it as an error. The identity
// the ticket was built on is untouched by the swap: side equals circumradius
// holds for any hexagon, so the hydrogen shell is r(C–C) + r(C–H) whatever
// those two are, and here that is 1.397 + 1.084 = 2.481 Å.
//
// NOT SOURCED, and worth separating from the pair above: neither 120° is an
// independent measurement. D6h fixes both exactly, at any bond length, the way
// Td fixes methane's arccos(−1/3) — CCCBDB prints them because its table has
// columns for them. They are measured back out below as a check on the
// rounding, never typed in as an input.
//
// DERIVED: six carbons at radius 1.397 Å and six hydrogens at radius 2.481 Å,
// at azimuths 0°, 60°, … 300° measured from +y, every atom on z = 0, rounded
// to five decimals. The first carbon up the y axis with the molecule in the
// z = 0 plane is water's and carbon dioxide's convention, and it is also the
// layout CCCBDB publishes benzene's own cartesians in — C1 at (0, 1.3970, 0),
// C2 at (1.2098, 0.6985, 0) — so the file can be read against the source row
// by row rather than after a rotation.
//
// MEASURED BACK OUT of the literals below: the six C–C distances take two
// values, 1.397000000 and 1.397002175 Å, and the six C–H two, 1.084000000 and
// 1.083998668 Å — spreads of 2.2 × 10⁻⁶ and 1.3 × 10⁻⁶ Å against a drawn rod
// 0.14 Å wide. All twelve angles land within 1.1 × 10⁻⁴° of 120°. The whole of
// that error is the five-decimal rounding of the one irrational component,
// sin 60°: the ±0.6985 and ±1.2405 columns are exact halves and round to
// nothing at all, which is why two of the six C–C distances come out exactly
// 1.397 and the other four do not.
//
// Two things here are exact rather than nearly so, and both follow from the
// symmetry surviving into the literals. Every z is a typed 0, so the ring is
// coplanar exactly and not merely to floating-point noise; and the centroid is
// the origin to the last bit, because the six azimuths cancel in pairs. Alone
// in this family benzene arrives already centred, so MoleculeGenerator's
// centring step subtracts a true zero from it.
//
// KEKULÉ IN THE DATA, AROMATIC IN FACT, and this is the one thing in the file
// most worth reading before editing it. The ring bonds alternate order 2 and
// order 1 because `Bond` has an order and a hexagon of aromatic bonds cannot
// be written in that field. Real benzene has neither: all six C–C bonds are
// identical — which is what the equal lengths above already say, since a
// genuine alternation would print roughly 1.34 and 1.46 here — and the six
// electrons are delocalised around the ring. The alternation is therefore a
// notation, not a claim, and the BONDING row on the card says so in the one
// place a reader will see it. Do not "fix" the ring by measuring the drawn
// mesh and concluding the orders are wrong; the lengths are right and the
// orders are a convention. The same simplification carbon dioxide's file
// records applies on top, since every bond here draws as a single rod.

import type { Molecule } from "@data/molecules/types";

const benzene: Molecule = {
  name: "Benzene",
  atoms: [
    { element: "C", position: [0, 1.397, 0] },
    { element: "C", position: [1.20984, 0.6985, 0] },
    { element: "C", position: [1.20984, -0.6985, 0] },
    { element: "C", position: [0, -1.397, 0] },
    { element: "C", position: [-1.20984, -0.6985, 0] },
    { element: "C", position: [-1.20984, 0.6985, 0] },
    { element: "H", position: [0, 2.481, 0] },
    { element: "H", position: [2.14861, 1.2405, 0] },
    { element: "H", position: [2.14861, -1.2405, 0] },
    { element: "H", position: [0, -2.481, 0] },
    { element: "H", position: [-2.14861, -1.2405, 0] },
    { element: "H", position: [-2.14861, 1.2405, 0] },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 1, b: 2, order: 1 },
    { a: 2, b: 3, order: 2 },
    { a: 3, b: 4, order: 1 },
    { a: 4, b: 5, order: 2 },
    { a: 5, b: 0, order: 1 },
    { a: 0, b: 6, order: 1 },
    { a: 1, b: 7, order: 1 },
    { a: 2, b: 8, order: 1 },
    { a: 3, b: 9, order: 1 },
    { a: 4, b: 10, order: 1 },
    { a: 5, b: 11, order: 1 },
  ],
};

export default benzene;
