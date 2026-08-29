// Aspirin — twenty-one atoms, and the first molecule in this directory whose
// shape is a CHOICE. Caffeine is bigger and simpler in this one respect: its
// purine plate is rigid, and only the methyl hydrogens spin. Aspirin's HEAVY
// atoms move — the acetate turns about the bond that holds it to the ring, the
// carboxylic acid turns about its own — so aspirin has a conformer space
// rather than a shape, and what is below is one point in that space. Every
// molecule past this one is like that. Water's four decimals of experiment do
// not come back.
//
// SOURCED: PubChem CID 2244, 3D record, retrieved 2026-08-29 by
// scripts/fetch-molecule.mjs. PubChem records are public domain, with the
// caveat that an individual depositor's record may carry its own terms.
// IUPAC name 2-acetyloxybenzoic acid; InChIKey BSYNRYMUTXBXSQ-UHFFFAOYSA-N.
//
// NOT DERIVED, for the reason caffeine's header sets out at length: a computed
// conformer was not solved from a bond length and an angle, so there is no
// derivation here to measure back out. What could be checked was, and these
// are the numbers rather than the assurance:
//
//   COMPOSITION, against an independent authority. Counted from the atoms
//   below: C₉H₈O₄, 180.16 g/mol, against PubChem's own C₉H₈O₄ and 180.16.
//
//   THE RING IS FLAT. Best-fit plane through the six ring carbons: maximum
//   deviation 0.00004 Å. Its two substituent carbons and its four hydrogens
//   all sit within 0.014 Å of that same plane, so half this molecule is one
//   sheet.
//
//   THE ACETATE STANDS SQUARE TO THAT SHEET, which is aspirin's one memorable
//   piece of geometry and the reason the picture beats the printed formula.
//   Ring-to-acetate torsion 90.01°; the carboxylic acid is only partway out of
//   the plane, at 29.94°.
//
//   BOTH SIDE GROUPS ARE IN THEIR LOW-ENERGY FORM. The ester is s-cis
//   (O=C–O–C, 0.10°) and the acid's hydroxyl hydrogen is syn to its own
//   carbonyl (0.00°). A conformer with either one flipped would be drawing a
//   molecule nobody has made.
//
//   BOND LENGTHS, none of them adjusted: C=O 1.224–1.227, C–O 1.362–1.404,
//   C–C 1.395–1.500, C–H 1.086–1.094, O–H 0.981 Å.
//
//   NO CLASH, measured the way caffeine's header measures it so the two
//   numbers compare: the closest approach from any atom's centre to a rod it
//   is not an endpoint of is 0.981 Å, against a drawn rod radius of 0.07 Å.
//   That is the acid's hydroxyl hydrogen passing its own C–O rod, and it is
//   wider than the same figure for hand-derived water (0.958 Å). Nothing here
//   is impaled.
//
// WHAT THE NUMBERS ADMIT, and this is worth saying once for the whole fetched
// half of the directory. All six ring bonds come back 1.3948–1.3950 Å, the
// acetate's C–C is 1.5000 exactly, and the three torsions above land on 90.01,
// 0.10 and 0.00. Those are idealised fragment values assembled by a generator,
// not measurements of anything. An aromatic ring really does have six equal
// bonds, so that one is right for the right reason; an exact 1.5000 and an
// exact right angle are not. Read this file as a good model of aspirin rather
// than as aspirin.
//
// THE BOND ORDERS ARE A KEKULÉ STRUCTURE — 1 and 2 alternating around a ring
// whose own geometry says all six are identical. That is what SDF writes and
// what the repo's Bond type takes, and it costs nothing here because every
// bond is drawn as one rod whatever its order; `order` is bookkeeping the
// prose reads, not something the mesh sees. HAL-161's benzene meets the same
// mismatch on a ring with nothing else attached to distract from it.

import type { Molecule } from "@data/molecules/types";

const aspirin: Molecule = {
  name: "Aspirin",
  atoms: [
    { element: "O", position: [1.2333, 0.554, 0.7792] },
    { element: "O", position: [-0.6952, -2.7148, -0.7502] },
    { element: "O", position: [0.7958, -2.1843, 0.8685] },
    { element: "O", position: [1.7813, 0.8105, -1.4821] },
    { element: "C", position: [-0.0857, 0.6088, 0.4403] },
    { element: "C", position: [-0.7927, -0.5515, 0.1244] },
    { element: "C", position: [-0.7288, 1.8464, 0.4133] },
    { element: "C", position: [-2.1426, -0.4741, -0.2184] },
    { element: "C", position: [-2.0787, 1.9238, 0.0706] },
    { element: "C", position: [-2.7855, 0.7636, -0.2453] },
    { element: "C", position: [-0.1409, -1.8536, 0.1477] },
    { element: "C", position: [2.1094, 0.6715, -0.3113] },
    { element: "C", position: [3.5305, 0.5996, 0.1635] },
    { element: "H", position: [-0.1851, 2.7545, 0.6593] },
    { element: "H", position: [-2.7247, -1.3605, -0.4564] },
    { element: "H", position: [-2.5797, 2.8872, 0.0506] },
    { element: "H", position: [-3.8374, 0.8238, -0.509] },
    { element: "H", position: [3.729, 1.4184, 0.8593] },
    { element: "H", position: [4.2045, 0.6969, -0.6924] },
    { element: "H", position: [3.7105, -0.3659, 0.6426] },
    { element: "H", position: [-0.2555, -3.5916, -0.7337] },
  ],
  bonds: [
    { a: 0, b: 4, order: 1 },
    { a: 0, b: 11, order: 1 },
    { a: 1, b: 10, order: 1 },
    { a: 1, b: 20, order: 1 },
    { a: 2, b: 10, order: 2 },
    { a: 3, b: 11, order: 2 },
    { a: 4, b: 5, order: 1 },
    { a: 4, b: 6, order: 2 },
    { a: 5, b: 7, order: 2 },
    { a: 5, b: 10, order: 1 },
    { a: 6, b: 8, order: 1 },
    { a: 6, b: 13, order: 1 },
    { a: 7, b: 9, order: 1 },
    { a: 7, b: 14, order: 1 },
    { a: 8, b: 9, order: 2 },
    { a: 8, b: 15, order: 1 },
    { a: 9, b: 16, order: 1 },
    { a: 11, b: 12, order: 1 },
    { a: 12, b: 17, order: 1 },
    { a: 12, b: 18, order: 1 },
    { a: 12, b: 19, order: 1 },
  ],
};

export default aspirin;
