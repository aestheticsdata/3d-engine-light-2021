// Glucose — twenty-four atoms, and the one that undoes the picture everybody
// was taught. A sugar is drawn as a flat hexagon with the groups sticking out
// north and south, because that is what fits on a page. It is not flat. The
// six ring torsions below alternate in sign through ±48.6° to ±63.2°, which is
// a CHAIR: three atoms up, three atoms down, and no two adjacent. Put this on
// the stage and turn it, and the textbook drawing stops being recoverable.
//
// SOURCED: PubChem CID 5793 (title D-Glucose), 3D record, retrieved 2026-08-29
// by scripts/fetch-molecule.mjs. PubChem records are public domain, with the
// caveat that an individual depositor's record may carry its own terms.
// IUPAC name (3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol; InChIKey
// WQZGKKKJIJFFOK-GASJEMHNSA-N.
//
// WHICH GLUCOSE THIS IS, and the answer is not in the record. Aspirin's file
// says a fetched molecule ships one conformer of several; glucose goes a step
// further, because CID 5793 does not even fix the molecule. Its InChI stereo
// layer reads /t2-,3-,4+,5-,6?/ — that "6?" is the anomeric carbon, the one
// the ring oxygen and a hydroxyl both hang off, and it is UNDEFINED. PubChem's
// own SMILES leaves it unmarked too. So the record is D-glucose with the
// anomeric centre open, and the conformer generator closed it.
//
// It closed it as BETA, and that was measured rather than looked up. Taking
// the ring's mean plane and asking each substituent's bond how far it leans
// from the normal: the anomeric hydroxyl 68.4° from it, the other three
// hydroxyls 62.4–65.8°, the hydroxymethyl 71.0°. Everything is EQUATORIAL —
// lying out in the ring's own plane, nothing standing up above it. All-
// equatorial in the chair is β-D-glucopyranose and nothing else, and it is the
// reason this molecule is the one life builds with: no group is in any other
// group's way, so it is the most comfortable arrangement any common sugar can
// take. α-D-glucose is the same file with one bond turned over.
//
// NOT DERIVED, for the reason caffeine's header sets out. What could be
// checked was:
//
//   COMPOSITION, against an independent authority. Counted from the atoms
//   below: C₆H₁₂O₆, 180.16 g/mol, against PubChem's own C₆H₁₂O₆ and 180.16.
//   The same molar mass as aspirin's, to the two decimals PubChem publishes,
//   on a molecule with three fewer carbons — a coincidence and not an error.
//
//   THE RING IS NOT FLAT, which is the check this file exists to pass. Best
//   plane through the six ring atoms: maximum deviation 0.27491 Å. Ring
//   torsions +55.89, −49.56, +48.58, −53.88, +62.18, −63.20°. A flat ring
//   here would have meant a 2D record leaking through, and would have rendered
//   perfectly happily; scripts/fetch-molecule.mjs refuses the 2D endpoint for
//   exactly this molecule's sake.
//
//   BOND LENGTHS, none of them adjusted: C–C 1.525–1.530, C–O 1.416–1.429,
//   C–H 1.094–1.099, O–H 0.972–0.973 Å.
//
//   NO CLASH, by caffeine's measure so the numbers compare: closest approach
//   from an atom's centre to a rod it is not an endpoint of, 0.972 Å against a
//   drawn rod radius of 0.07 Å. Wider than hand-derived water's own 0.958 Å.
//   The tightest atom-to-atom contact is 2.169 Å, between the anomeric
//   hydroxyl's hydrogen and the hydrogen on the carbon next to it — under the
//   2.4 Å van der Waals sum for two hydrogens, which is what a gauche contact
//   in a real sugar looks like, and nowhere near a collision at the 0.155 Å
//   radius a hydrogen is actually drawn with.
//
// THE NUMBERS ARE IDEALISED, as aspirin's header says at length: five C–C
// bonds inside 0.005 Å of each other is a generator assembling standard
// fragments, not a measurement of a sugar. What is NOT idealised is the chair
// and the all-equatorial arrangement — those are conformational choices the
// generator made, and they are the two things this file is here to show.

import type { Molecule } from "@data/molecules/types";

const glucose: Molecule = {
  name: "Glucose",
  atoms: [
    { element: "O", position: [-0.6679, 1.1587, 0.257] },
    { element: "O", position: [-0.887, -2.4483, -0.3388] },
    { element: "O", position: [1.8623, -2.0693, 0.4696] },
    { element: "O", position: [2.8609, 0.5414, -0.4619] },
    { element: "O", position: [1.1222, 2.6552, 0.2574] },
    { element: "O", position: [-3.3742, 0.9717, -0.1865] },
    { element: "C", position: [-0.3727, -1.247, 0.23] },
    { element: "C", position: [1.0856, -1.0709, -0.194] },
    { element: "C", position: [-1.2211, -0.0621, -0.2375] },
    { element: "C", position: [1.6082, 0.3151, 0.1839] },
    { element: "C", position: [0.6388, 1.4132, -0.2534] },
    { element: "C", position: [-2.655, -0.1577, 0.274] },
    { element: "H", position: [-0.4248, -1.3522, 1.3206] },
    { element: "H", position: [1.2066, -1.2487, -1.2697] },
    { element: "H", position: [-1.2548, -0.0098, -1.3343] },
    { element: "H", position: [1.7952, 0.3598, 1.2636] },
    { element: "H", position: [0.5967, 1.5141, -1.344] },
    { element: "H", position: [-2.6916, -0.1535, 1.3685] },
    { element: "H", position: [-3.1564, -1.0581, -0.0922] },
    { element: "H", position: [-0.8514, -2.3615, -1.3066] },
    { element: "H", position: [1.4973, -2.9356, 0.22] },
    { element: "H", position: [2.7165, 0.4989, -1.4227] },
    { element: "H", position: [1.4876, 2.5033, 1.1448] },
    { element: "H", position: [-2.9192, 1.7652, 0.144] },
  ],
  bonds: [
    { a: 0, b: 8, order: 1 },
    { a: 0, b: 10, order: 1 },
    { a: 1, b: 6, order: 1 },
    { a: 1, b: 19, order: 1 },
    { a: 2, b: 7, order: 1 },
    { a: 2, b: 20, order: 1 },
    { a: 3, b: 9, order: 1 },
    { a: 3, b: 21, order: 1 },
    { a: 4, b: 10, order: 1 },
    { a: 4, b: 22, order: 1 },
    { a: 5, b: 11, order: 1 },
    { a: 5, b: 23, order: 1 },
    { a: 6, b: 7, order: 1 },
    { a: 6, b: 8, order: 1 },
    { a: 6, b: 12, order: 1 },
    { a: 7, b: 9, order: 1 },
    { a: 7, b: 13, order: 1 },
    { a: 8, b: 11, order: 1 },
    { a: 8, b: 14, order: 1 },
    { a: 9, b: 10, order: 1 },
    { a: 9, b: 15, order: 1 },
    { a: 10, b: 16, order: 1 },
    { a: 11, b: 17, order: 1 },
    { a: 11, b: 18, order: 1 },
  ],
};

export default glucose;
