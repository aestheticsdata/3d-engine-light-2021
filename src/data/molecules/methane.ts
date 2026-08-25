// Methane — five atoms around a centre, and the one molecule in the set whose
// shape owes nothing to experiment: tetrahedral symmetry fixes every angle,
// leaving a single measured number to place all four hydrogens.
//
// SOURCED: rₑ(C–H) = 1.087 ± 0.001 Å — Hirota, "Anharmonic Potential Function
// and Equilibrium Structure of Methane", J. Mol. Spectrosc. 77, 213-221
// (1979), the determination NIST CCCBDB serves as methane's experimental
// geometry.
//
// That is rₑ, the equilibrium structure at the bottom of the well, where water
// next door deliberately takes r₀, the vibrationally averaged one. The two
// files disagree on purpose rather than by oversight: CCCBDB lists only the rₑ
// determination for methane, so honouring water's convention here would mean
// preferring a less standard number to a better one for a difference no
// ball-and-stick model can show — the envelope scaling divides it out, since
// changing every C–H length together moves nothing but the ratio of ball to
// rod, by under a percent.
//
// NOT SOURCED, and this is the point of building from the cube: the H–C–H
// angle is not a measurement at all. Td symmetry fixes it at arccos(−1/3)
// exactly, for any bond length whatsoever. CCCBDB does print 109.471° beside
// the length, but at ±2° — a tolerance that marks it as a nominal entry rather
// than an independent determination. Typing a rounded 109.47° back in as an
// input would therefore be inventing an experimental constant AND building a
// tetrahedron that is slightly not one.
//
// DERIVED: carbon at the origin, the four hydrogens along four alternating
// corners of a cube — (1, 1, 1), (1, −1, −1), (−1, 1, −1), (−1, −1, 1) — each
// normalised and scaled to the bond length, rounded to five decimals.
//
// MEASURED BACK OUT of the literals below: all four C–H distances come to
// 1.087000446 Å, equal to the last bit rather than merely close, and all six
// H–C–H angles to 109.471221°, which is arccos(−1/3) to every decimal printed.
// The tetrahedron survives the rounding exactly because every coordinate has
// the same magnitude: five decimals scale all three components of every
// hydrogen by one common factor, so the directions are untouched and the whole
// of the error — 4.5 × 10⁻⁷ Å — lands in the bond length, where nothing about
// the shape depends on it.

import type { Molecule } from "@data/molecules/types";

const methane: Molecule = {
  name: "Methane",
  atoms: [
    { element: "C", position: [0, 0, 0] },
    { element: "H", position: [0.62758, 0.62758, 0.62758] },
    { element: "H", position: [0.62758, -0.62758, -0.62758] },
    { element: "H", position: [-0.62758, 0.62758, -0.62758] },
    { element: "H", position: [-0.62758, -0.62758, 0.62758] },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 },
    { a: 0, b: 4, order: 1 },
  ],
};

export default methane;
