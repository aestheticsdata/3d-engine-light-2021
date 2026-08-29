// Nicotine — twenty-six atoms in TWO rings that do not lie in the same plane,
// which is the whole reason it is here. Every molecule in this directory so
// far has been one rigid thing, or one rigid thing with small groups hung off
// it. Nicotine is two rigid things joined by a single bond that turns: a flat
// aromatic pyridine and a puckered saturated pyrrolidine, meeting at 72.97°.
// Nothing enforces that angle. Turn the bond and you have a different
// conformer of the same molecule, and this file ships one of them.
//
// SOURCED: PubChem CID 89594, 3D record, retrieved 2026-08-29 by
// scripts/fetch-molecule.mjs. PubChem records are public domain, with the
// caveat that an individual depositor's record may carry its own terms.
// IUPAC name 3-[(2S)-1-methylpyrrolidin-2-yl]pyridine; InChIKey
// SNICXCGAKADSCV-JTQLQIEISA-N.
//
// WHICH NICOTINE, and unlike glucose the record answers. Glucose's file has to
// explain that CID 5793's InChI carries a "6?" where its anomeric centre
// should be and that the conformer generator picked one. Nicotine's reads
// /t10-/m0/s1: one stereocentre, fully specified, and PubChem's SMILES marks
// it too. This is (S)-nicotine — the enantiomer tobacco makes. Its mirror
// image is a different substance with different behaviour, and it is not what
// is drawn here.
//
// NOT DERIVED, for the reason caffeine's header sets out. What could be
// checked was:
//
//   COMPOSITION. Counted from the atoms below: C₁₀H₁₄N₂, 162.24 g/mol,
//   against PubChem's C₁₀H₁₄N₂ and 162.23. The formulas match exactly and the
//   masses do NOT — this is the first file in the directory where they differ
//   at all, by 0.01 g/mol. That is the two sides rounding IUPAC's standard
//   atomic weights at different points, not a missing atom, and it is the
//   reason scripts/fetch-molecule.mjs compares mass on a 0.05 tolerance while
//   comparing composition exactly. A missing hydrogen would be 1.008.
//
//   THE PYRIDINE IS FLAT: 0.00010 Å maximum deviation through its six ring
//   atoms — second only to aspirin's 0.00004, and both of them tighter than
//   caffeine's 0.00046. The carbon joining it to the other ring sits 0.002 Å
//   off it.
//
//   THE PYRROLIDINE IS NOT, and must not be: 0.261 Å maximum deviation, with
//   its five atoms at +0.214, −0.086, −0.063, +0.195 and −0.260 Å from their
//   own mean plane. A saturated five-ring cannot be flat without every bond
//   angle being wrong, so a flat one here would have meant the same 2D leak
//   glucose's chair rules out.
//
//   THE HINGE. Angle between the two rings' mean planes 72.97°; the
//   N–C–C–C torsion across the joining bond 27.62°. Neither is a right angle
//   and neither is zero, which is what a real rotatable bond looks like.
//
//   BOND LENGTHS, none adjusted: C–C 1.386–1.540, C–N 1.352–1.476,
//   C–H 1.084–1.100 Å. The wide C–C range is the two ring types side by side —
//   aromatic near 1.39, saturated near 1.54 — rather than a bad number.
//
//   NO CLASH, by caffeine's measure: closest approach from an atom's centre to
//   a rod it is not an endpoint of, 1.084 Å against a drawn rod radius of
//   0.07 Å. That is the widest such figure of any molecule here.
//
// THE PYRIDINE BOND ORDERS ARE A KEKULÉ STRUCTURE, alternating 1 and 2 around
// a ring whose own geometry says all six are the same, exactly as aspirin's
// header records. The pyrrolidine's are all genuinely single.

import type { Molecule } from "@data/molecules/types";

const nicotine: Molecule = {
  name: "Nicotine",
  atoms: [
    { element: "N", position: [-1.7023, -0.7962, -0.0339] },
    { element: "N", position: [2.2968, -0.7091, 1.2171] },
    { element: "C", position: [-0.8846, 0.3095, -0.5713] },
    { element: "C", position: [-1.4955, 1.5824, 0.0436] },
    { element: "C", position: [-2.6857, 1.0984, 0.8596] },
    { element: "C", position: [-3.0281, -0.2382, 0.2329] },
    { element: "C", position: [0.5872, 0.1544, -0.2513] },
    { element: "C", position: [-1.7618, -1.9503, -0.9217] },
    { element: "C", position: [1.5569, 0.7025, -1.0791] },
    { element: "C", position: [1.0008, -0.5357, 0.8738] },
    { element: "C", position: [2.9009, 0.5451, -0.7593] },
    { element: "C", position: [3.2156, -0.1627, 0.3895] },
    { element: "H", position: [-1.0084, 0.3665, -1.6624] },
    { element: "H", position: [-1.8454, 2.2456, -0.7571] },
    { element: "H", position: [-0.8018, 2.1528, 0.6709] },
    { element: "H", position: [-2.3896, 0.965, 1.9076] },
    { element: "H", position: [-3.522, 1.8029, 0.8293] },
    { element: "H", position: [-3.6094, -0.8662, 0.9151] },
    { element: "H", position: [-3.6021, -0.088, -0.6903] },
    { element: "H", position: [-2.3643, -2.746, -0.4698] },
    { element: "H", position: [-0.7627, -2.3668, -1.0885] },
    { element: "H", position: [-2.1975, -1.7036, -1.8965] },
    { element: "H", position: [1.2798, 1.2544, -1.9728] },
    { element: "H", position: [0.3027, -0.9778, 1.577] },
    { element: "H", position: [3.6775, 0.9638, -1.389] },
    { element: "H", position: [4.2491, -0.3134, 0.6833] },
  ],
  bonds: [
    { a: 0, b: 2, order: 1 },
    { a: 0, b: 5, order: 1 },
    { a: 0, b: 7, order: 1 },
    { a: 1, b: 9, order: 1 },
    { a: 1, b: 11, order: 2 },
    { a: 2, b: 3, order: 1 },
    { a: 2, b: 6, order: 1 },
    { a: 2, b: 12, order: 1 },
    { a: 3, b: 4, order: 1 },
    { a: 3, b: 13, order: 1 },
    { a: 3, b: 14, order: 1 },
    { a: 4, b: 5, order: 1 },
    { a: 4, b: 15, order: 1 },
    { a: 4, b: 16, order: 1 },
    { a: 5, b: 17, order: 1 },
    { a: 5, b: 18, order: 1 },
    { a: 6, b: 8, order: 1 },
    { a: 6, b: 9, order: 2 },
    { a: 7, b: 19, order: 1 },
    { a: 7, b: 20, order: 1 },
    { a: 7, b: 21, order: 1 },
    { a: 8, b: 10, order: 2 },
    { a: 8, b: 22, order: 1 },
    { a: 9, b: 23, order: 1 },
    { a: 10, b: 11, order: 1 },
    { a: 10, b: 24, order: 1 },
    { a: 11, b: 25, order: 1 },
  ],
};

export default nicotine;
