// Ammonia — the molecule whose shape is set by something this model does not
// draw. The nitrogen's lone pair pushes the three N–H bonds down off the plane,
// which is the whole reason NH₃ is a pyramid and not a triangle; nothing in the
// atoms array below says so, and a reader who knows chemistry will look for it.
//
// SOURCED: r(N–H) = 1.012 Å and ∠HNH = 106.7° — Herzberg, "Electronic Spectra
// and Electronic Structure of Polyatomic Molecules" (Van Nostrand, 1966), the
// determination NIST CCCBDB serves as ammonia's experimental geometry. CCCBDB
// prints the angle as 106.67°; 106.7° is the rounded form this file takes, the
// one the card prints and the one most tables quote. The 0.03° between them is
// several orders below anything a ball-and-stick mesh can express.
//
// Recorded rather than smoothed over: CCCBDB labels methane's length "re" and
// labels neither of these, so no structure type is asserted here. Claiming one
// would be inventing a provenance the source does not give.
//
// BOTH numbers are measurements, which is what separates this file from
// methane's next door. Td symmetry left methane exactly one free parameter and
// fixed its angle at arccos(−1/3); C3v leaves two, so ammonia's angle is
// experiment's to report and cannot be derived from anything.
//
// DERIVED: nitrogen at the origin, the C3 axis up the y axis, the three
// hydrogens at azimuths 0°, 120° and 240° about it, each at polar angle θ from
// the axis. θ is what the bond angle fixes, through
//
//     cos∠HNH = cos²θ − ½sin²θ = (3cos²θ − 1) / 2
//
// which inverts to cos²θ = (cos∠HNH + ½) / (3/2). At ∠HNH = 106.7°:
//
//     cos 106.7°  = −0.28736052
//     cos²θ       = (−0.28736052 + 0.5) / 1.5 = 0.14175965
//     cosθ        =  0.37650983
//     θ           =  67.882340°
//
// MEASURED BACK OUT of the literals below: the three N–H distances come to
// 1.012001, 1.011995 and 1.011995 Å, and the three angles to 106.6997°,
// 106.6997° and 106.6999° — 106.70° at the two decimals the card rounds to, and
// 13.3° short of the 120° that would make this trigonal planar. That last
// number is the one worth checking: three hydrogens 120° apart in AZIMUTH is
// this molecule, three hydrogens 120° apart BETWEEN BONDS is BF₃, and the two
// are told apart by nothing else.
//
// Unlike methane, the rounding here does not cancel. Methane's hydrogens have
// three components of equal magnitude, so five decimals scale each one by a
// common factor and leave the shape untouched; ammonia's do not, so a residual
// survives — 6.2 × 10⁻⁶ Å across the three bond lengths, and under 3 × 10⁻⁴
// degrees on the angles.

import type { Molecule } from "@data/molecules/types";

const ammonia: Molecule = {
  name: "Ammonia",
  atoms: [
    { element: "N", position: [0, 0, 0] },
    { element: "H", position: [0.93753, 0.38103, 0] },
    { element: "H", position: [-0.46876, 0.38103, 0.81192] },
    { element: "H", position: [-0.46876, 0.38103, -0.81192] },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 },
  ],
};

export default ammonia;
