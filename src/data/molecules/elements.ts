// The element table: every chemistry and rendering constant a molecule needs,
// hardcoded because no chemistry database serves any of them.
//
// Where each column comes from, so none of them gets re-invented:
//
//   weight      IUPAC 2021 standard atomic weights, abridged values.
//   fill        the Jmol/CPK colour table — https://jmol.sourceforge.net/jscolors/.
//               Jmol publishes hex; the conversion to rgba() happened once,
//               here, because rgba() is what the registry's per-triangle slot
//               takes and what cssColor parses for the key light. The hue is
//               Jmol's, the format is ours.
//   covalentRadius
//               covalent radii in Ångströms — "Covalent radii revisited",
//               Cordero et al., Dalton Trans. 2008, 2832-2838, Table 2, taking
//               carbon's sp³ value. Cross-checked against ASE's
//               `covalent_radii`, which cites that paper and carries the same
//               four numbers.
//
//               3Dmol.js was the cross-check this ticket originally named, and
//               it is the WRONG one: its `bondTable` carries the older
//               Cambridge set (H 0.37, C 0.77, N 0.75, O 0.73) for bond
//               perception, not Cordero's. Recorded here so the disagreement
//               reads as two different tables rather than as an error in this
//               one.
//
//               This is the PHYSICAL constant, not the drawn size. Drawing a
//               ball at its full covalent radius does not produce a
//               ball-and-stick model: water's O and H radii sum to 0.97 Å
//               against a 0.9584 Å bond, so the two spheres interpenetrate and
//               the rod between them is entirely buried. MoleculeGenerator
//               owns the scale that turns this into a drawn radius, beside the
//               rod radius it has to be tuned against.
//
//               Do not "correct" this column toward van der Waals: the Bondi
//               radii are a separate table a future space-filling mode would
//               need, and swapping them in here turns every molecule into a
//               blob.
//
// Four elements, and nothing else until a molecule needs a fifth.

const elements = {
  H: { name: "Hydrogen", weight: 1.008, fill: "rgba(255,255,255,1)", covalentRadius: 0.31 },
  C: { name: "Carbon", weight: 12.011, fill: "rgba(144,144,144,1)", covalentRadius: 0.76 },
  N: { name: "Nitrogen", weight: 14.007, fill: "rgba(48,80,248,1)", covalentRadius: 0.71 },
  O: { name: "Oxygen", weight: 15.999, fill: "rgba(255,13,13,1)", covalentRadius: 0.66 },
} as const;

// Derived FROM the table, the way ShapeFamily is derived from shapeFamilies: an
// atom naming an element the table does not carry is a compile error rather
// than a ball painted `undefined`.
export type ElementSymbol = keyof typeof elements;

export default elements;
