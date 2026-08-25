// Water — the molecule the whole pipeline was proved on: three atoms, two
// bonds, and a bend that is unmistakably wrong if the winding or the scaling
// is off.
//
// SOURCED: r₀(O–H) = 0.9584 Å and ∠HOH = 104°27′ = 104.45° — Eisenberg &
// Kauzmann, "The Structure and Properties of Water" (OUP, 1969), the standard
// reference for water's r₀ structure.
//
// r₀, the vibrationally averaged ground state, NOT rₑ, the equilibrium
// structure at the bottom of the well. The distinction is why other sources
// print other numbers and none of them is wrong: NIST CCCBDB serves rₑ =
// 0.958 Å / 104.4776° (Hoy & Bunker 1979), and Chaplin's tables give rₑ =
// 0.95718 Å / 104.474°. Recorded because r₀ is the average position of a real
// molecule and therefore the honest thing for a ball-and-stick model to draw —
// swapping in an rₑ pair would change the mesh for no gain.
// DERIVED: oxygen at the origin, the H–O–H bisector up the y axis, both
// hydrogens in the z = 0 plane at (±0.9584·sin(52.225°), 0.9584·cos(52.225°), 0),
// rounded to five decimals.
// MEASURED BACK OUT of the literals below: both O–H distances come to
// 0.958400 Å and the angle to 104.4499° — the five-decimal rounding is the
// whole of the error.

import type { Molecule } from "@data/molecules/types";

const water: Molecule = {
  name: "Water",
  atoms: [
    { element: "O", position: [0, 0, 0] },
    { element: "H", position: [0.75754, 0.58708, 0] },
    { element: "H", position: [-0.75754, 0.58708, 0] },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ],
};

export default water;
