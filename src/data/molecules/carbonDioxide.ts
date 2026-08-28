// Carbon dioxide — three atoms on one line, and the first double bonds in the
// data. There is no trigonometry in this file: the molecular axis IS a
// coordinate axis, so the sourced bond length is typed straight in as a
// coordinate and nothing is derived from it.
//
// SOURCED: r(C–O) = 1.162 Å and ∠OCO = 180°, point group D∞h — Herzberg,
// "Electronic Spectra and Electronic Structure of Polyatomic Molecules" (Van
// Nostrand, 1966), the determination NIST CCCBDB serves as carbon dioxide's
// experimental geometry. The same 1966 determination ammonia's file cites, and
// CCCBDB labels this length no more than it labels that one, so again no
// structure type is asserted here.
//
// Three lengths are in circulation and none of them is wrong; recorded so the
// spread reads as rounding rather than as an error in this one. Wikipedia
// prints 116.3 pm = 1.163 Å, and 1.16 Å is the figure most tables quote. That
// is 0.003 Å across the three, against a drawn rod 0.14 Å wide.
//
// DERIVED: nothing — and that is this file's one distinguishing property.
// Carbon at the origin with the C∞ axis up the y axis, the convention water's
// C2 and ammonia's C3 both follow, puts each oxygen at ±r along that axis with
// no projection to take and no decimals to drop.
//
// MEASURED BACK OUT of the literals below: both C=O distances come to 1.162 Å
// exactly — the same double, not merely the same to five decimals — the angle
// to 180.000000000000°, and the cross product of the two bond vectors to zero,
// which is collinearity asserted rather than eyeballed. Alone in the set this
// file has no rounding residual to report, because it did no rounding.
//
// BOTH BONDS ARE DOUBLE, and the picture says otherwise on purpose. This epic
// draws one rod per bond whatever its order — the standard ball-and-stick
// simplification — and parallel rods are its first named follow-up. The data
// is right and the render is simplified, so the disagreement is not to be
// settled by editing `order` down to 1.

import type { Molecule } from "@data/molecules/types";

const carbonDioxide: Molecule = {
  name: "Carbon dioxide",
  atoms: [
    { element: "C", position: [0, 0, 0] },
    { element: "O", position: [0, 1.162, 0] },
    { element: "O", position: [0, -1.162, 0] },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
  ],
};

export default carbonDioxide;
