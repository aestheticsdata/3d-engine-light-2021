// Caffeine — twenty-four atoms, and the first molecule in this registry that
// nobody typed. Water, methane, ammonia and CO₂ are each two published
// constants and some trigonometry; 1,3,7-trimethylpurine-2,6-dione has no
// symmetry left to solve from, and its coordinates are data rather than a
// formula. That difference is what this file is for.
//
// SOURCED: PubChem CID 2519, 3D record, retrieved 2026-08-28 by
// scripts/fetch-molecule.mjs. PubChem records are public domain, with the
// caveat that an individual depositor's record may carry its own terms.
// IUPAC name 1,3,7-trimethylpurine-2,6-dione; InChIKey
// RYYVLZVUVIJVGH-UHFFFAOYSA-N.
//
// NOT DERIVED, and there is no "MEASURED BACK OUT" section below for a reason
// the neighbouring files do not have to explain. A PubChem 3D record is a
// COMPUTED CONFORMER — one plausible arrangement of a molecule that has many —
// not an experimental structure. Nothing here was solved from a bond length
// and an angle, so nothing here can be recovered to prove it was solved
// correctly. Water's header can close the loop on itself; this one cannot, and
// pretending otherwise would be the more dangerous file.
//
// So what could be checked was, and these are the numbers rather than the
// assurance:
//
//   COMPOSITION, against an independent authority. The formula and molar mass
//   counted from the atoms below come to C₈H₁₀N₄O₂ and 194.19 g/mol, against
//   PubChem's own C₈H₁₀N₄O₂ and 194.19. That check is the epic's central claim
//   — a formula is counted from the structure, never declared — proved on a
//   molecule big enough for an off-by-one in the atom block to hide in.
//
//   PLANARITY. The purine bicycle is aromatic and must be flat. Best-fit plane
//   through its nine ring atoms: maximum deviation 0.00046 Å. The two carbonyl
//   oxygens sit within 0.0014 Å of that plane and the three methyl CARBONS
//   within 0.0015 Å, so the whole heavy-atom skeleton is one sheet. A pucker
//   here would have meant the wrong record rather than a real molecule.
//
//   BOND LENGTHS, all in range and none of them adjusted: C=O 1.228–1.236,
//   C–N 1.365–1.459, C=N 1.317, C=C 1.368, C–C 1.427, C–H 1.082–1.095 Å.
//
//   NO CLASH. The classic conformer artefact is a methyl hydrogen rotated into
//   a bond it is not part of, which renders as a ball impaled on a rod. The
//   closest approach from any atom to any rod it does not belong to is
//   1.082 Å, against a drawn rod radius of 0.07 Å. There is nothing to fix.
//
// The conformer was therefore accepted unchanged. Had it not been, the fix
// belonged HERE, by hand: this file is source and not a cache, and nothing
// re-runs the script to refresh it.
//
// The only atoms off the plane are the nine methyl hydrogens, at z = ±0.89,
// and they are the whole reason caffeine is not flat. Three methyls on a flat
// bicycle is the molecule.

import type { Molecule } from "@data/molecules/types";

const caffeine: Molecule = {
  name: "Caffeine",
  atoms: [
    { element: "O", position: [0.47, 2.5688, 0.0006] },
    { element: "O", position: [-3.1271, -0.4436, -0.0003] },
    { element: "N", position: [-0.9686, -1.3125, 0] },
    { element: "N", position: [2.2182, 0.1412, -0.0003] },
    { element: "N", position: [-1.3477, 1.0797, -0.0001] },
    { element: "N", position: [1.4119, -1.9372, 0.0002] },
    { element: "C", position: [0.8579, 0.2592, -0.0008] },
    { element: "C", position: [0.3897, -1.0264, -0.0004] },
    { element: "C", position: [0.0307, 1.422, -0.0006] },
    { element: "C", position: [-1.9061, -0.2495, -0.0004] },
    { element: "C", position: [2.5032, -1.1998, 0.0003] },
    { element: "C", position: [-1.4276, -2.696, 0.0008] },
    { element: "C", position: [3.1926, 1.2061, 0.0003] },
    { element: "C", position: [-2.2969, 2.1881, 0.0007] },
    { element: "H", position: [3.5163, -1.5787, 0.0008] },
    { element: "H", position: [-1.0451, -3.1973, -0.8937] },
    { element: "H", position: [-2.5186, -2.7596, 0.0011] },
    { element: "H", position: [-1.0447, -3.1963, 0.8957] },
    { element: "H", position: [4.1992, 0.7801, 0.0002] },
    { element: "H", position: [3.0468, 1.8092, -0.8992] },
    { element: "H", position: [3.0466, 1.8083, 0.9004] },
    { element: "H", position: [-1.8087, 3.1651, -0.0003] },
    { element: "H", position: [-2.9322, 2.1027, 0.8881] },
    { element: "H", position: [-2.9346, 2.1021, -0.8849] },
  ],
  bonds: [
    { a: 0, b: 8, order: 2 },
    { a: 1, b: 9, order: 2 },
    { a: 2, b: 7, order: 1 },
    { a: 2, b: 9, order: 1 },
    { a: 2, b: 11, order: 1 },
    { a: 3, b: 6, order: 1 },
    { a: 3, b: 10, order: 1 },
    { a: 3, b: 12, order: 1 },
    { a: 4, b: 8, order: 1 },
    { a: 4, b: 9, order: 1 },
    { a: 4, b: 13, order: 1 },
    { a: 5, b: 7, order: 1 },
    { a: 5, b: 10, order: 2 },
    { a: 6, b: 7, order: 2 },
    { a: 6, b: 8, order: 1 },
    { a: 10, b: 14, order: 1 },
    { a: 11, b: 15, order: 1 },
    { a: 11, b: 16, order: 1 },
    { a: 11, b: 17, order: 1 },
    { a: 12, b: 18, order: 1 },
    { a: 12, b: 19, order: 1 },
    { a: 12, b: 20, order: 1 },
    { a: 13, b: 21, order: 1 },
    { a: 13, b: 22, order: 1 },
    { a: 13, b: 23, order: 1 },
  ],
};

export default caffeine;
