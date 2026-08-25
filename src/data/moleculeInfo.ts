// The chemistry the MOLECULE PROPERTIES card prints, keyed by registry name —
// shapeInfo.ts's counterpart for the molecules, and checked the same way.
//
// The formula and the molar mass are NOT in here. They are derived from
// `structure`, which is the same array the mesh is built from, so the card
// cannot print a formula the picture contradicts. What is left is the part no
// derivation can reach: the prose properties and the links.
//
// `properties` is a list rather than fixed fields because what is worth
// printing changes from one molecule to the next — a gas earns a boiling point,
// benzene earns "aromatic — delocalised ring", which is not a number at all.
// Four is the ceiling: the footer is pinned with margin-top: auto and the card
// still has to fit at 320px, where every row pushes the prose up.
//
// Every link is a static string, free, and needs no key or account. Nothing
// here is fetched, at build time or at run time. Three links is the ceiling —
// the REFERENCES row lays them out inline and a fourth wraps the row and
// unpins the footer. PubChem and Wikipedia are mandatory, ChEBI where there is
// an entry.
//
// DrugBank, ChemSpider, HMDB and Materials Project are all rejected and are not
// to be re-litigated: the reasoning is in HAL-153, and it is licensing rather
// than taste.

import methane from "@data/molecules/methane";
import water from "@data/molecules/water";

import type { Molecule } from "@data/molecules/types";
import type { ShapeInfoEntries, ShapeReference } from "@data/shapeInfo";

export interface MoleculeProperty {
  label: string;
  value: string;
}

export interface MoleculeInfo {
  structure: Molecule;
  properties: MoleculeProperty[];
  references: ShapeReference[];
}

// The registry keys whose shapeInfo entry declares family "MOLECULES", read out
// of that table rather than restated here. This is what makes the check below
// bite: a second list of molecule keys could drift from the picker's, and the
// shape that fell out of it would draw an empty card rather than fail to build.
type MoleculeKey = {
  [K in keyof ShapeInfoEntries]: ShapeInfoEntries[K]["family"] extends "MOLECULES" ? K : never;
}[keyof ShapeInfoEntries];

// `satisfies` for the same reason data.ts and shapeInfo.ts use it, and pointed
// the other way round from shapeInfo's: there, every registry key must have a
// write-up; here, every MOLECULES key must have chemistry. Adding a molecule to
// shapeInfo and forgetting this table is a compile error at this line.
const entries = {
  water: {
    structure: water,
    properties: [
      // The angle is the one the mesh was actually built from — see the header
      // of src/data/molecules/water.ts, where it is measured back out of the
      // coordinates rather than asserted.
      { label: "GEOMETRY", value: "bent, 104.45°" },
      { label: "BOILING POINT", value: "100 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/962" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Water" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:15377" },
    ],
  },
  methane: {
    structure: methane,
    properties: [
      // Not measured, unlike water's bend: tetrahedral symmetry fixes this
      // angle at arccos(−1/3) whatever the bond length, which is why the
      // molecule file builds from cube corners rather than from the angle.
      { label: "GEOMETRY", value: "tetrahedral, 109.47°" },
      { label: "BOILING POINT", value: "−161.5 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/297" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Methane" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:16183" },
    ],
  },
} satisfies Record<MoleculeKey, MoleculeInfo>;

// Widened on the way out, exactly as shapeInfo is: every consumer looks a shape
// up by a name it got at runtime, so the literal keys would buy nothing past
// this line. Undefined for the twenty solids, which is what switches the card's
// mode.
const moleculeInfo: Record<string, MoleculeInfo | undefined> = entries;

export default moleculeInfo;
