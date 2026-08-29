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

import ammonia from "@data/molecules/ammonia";
import aspirin from "@data/molecules/aspirin";
import caffeine from "@data/molecules/caffeine";
import carbonDioxide from "@data/molecules/carbonDioxide";
import glucose from "@data/molecules/glucose";
import methane from "@data/molecules/methane";
import nicotine from "@data/molecules/nicotine";
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
  ammonia: {
    structure: ammonia,
    properties: [
      // Experiment's number, where methane's is symmetry's: C3v leaves the bond
      // angle free, so this one is measured rather than fixed at arccos(-1/3).
      { label: "GEOMETRY", value: "trigonal pyramidal, 106.7°" },
      { label: "BOILING POINT", value: "−33.3 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/222" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Ammonia" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:16134" },
    ],
  },
  carbonDioxide: {
    structure: carbonDioxide,
    properties: [
      // No tolerance and no determination behind this one: D∞h forces 180°,
      // so unlike water's bend and ammonia's pyramid there is nothing here for
      // experiment to report.
      { label: "GEOMETRY", value: "linear, 180°" },
      // Printed because the picture cannot say it: the data carries order 2 on
      // both bonds and the mesh draws one rod each, so this row is where a
      // reader learns what the rods are standing in for.
      { label: "BONDING", value: "two double bonds" },
      // Sublimes rather than boils — at 1 atm CO₂ has no liquid phase, which is
      // why this row is not the BOILING POINT the other three carry. The
      // precise figure is −78.4645(30) °C; −78.5 is that at the one decimal
      // the rest of the card keeps.
      { label: "SUBLIMES", value: "−78.5 °C at 1 atm" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/280" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Carbon_dioxide" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:16526" },
    ],
  },
  caffeine: {
    structure: caffeine,
    properties: [
      // Not a bond angle, unlike the four before it: at twenty-four atoms the
      // single number worth printing is what the skeleton IS, and caffeine's
      // is a purine — a six-ring fused to a five-ring, sharing an edge.
      { label: "GEOMETRY", value: "fused bicycle, planar purine" },
      { label: "BONDING", value: "aromatic bicycle, three methyls" },
      // Both verified against PubChem's own experimental properties for CID
      // 2519 rather than taken from the ticket that asked for them. PubChem
      // lists several melting points from different sources (235, 236.2, 238);
      // 235 is the one most tables quote and the lowest it reports.
      { label: "MELTING POINT", value: "235 °C" },
      { label: "SOLUBILITY", value: "2.16 g/100 mL at 25 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/2519" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Caffeine" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27732" },
    ],
  },
  aspirin: {
    structure: aspirin,
    properties: [
      // Both kept under caffeine's thirty-one characters, which is what the
      // value column fits before it wraps and leaves a one-word widow. The
      // GEOMETRY row names the one thing a still picture of aspirin has to get
      // across, and names it as the angle the header measured: this is not the
      // flat hexagon-with-tails of the packet insert.
      { label: "GEOMETRY", value: "flat ring, acetate at 90°" },
      { label: "BONDING", value: "aromatic ring, ester, carboxyl" },
      // Both read off PubChem's experimental section for CID 2244 rather than
      // from the ticket. PubChem lists 135, 135 (rapid heating) and 138-140 for
      // the melt; 135 is the one it leads with and the one most tables quote.
      // The solubility is its "In water, 4,600 mg/L at 25 °C", converted once
      // to the same g/100 mL that caffeine's row uses so the two compare.
      { label: "MELTING POINT", value: "135 °C" },
      { label: "SOLUBILITY", value: "0.46 g/100 mL at 25 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Aspirin" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:15365" },
    ],
  },
  glucose: {
    structure: glucose,
    properties: [
      // "chair" earns the row over any bond angle: it is the one word that
      // separates this shape from the hexagon a reader arrives with, and
      // "equatorial" is the measurement that pins it to the β anomer, since
      // PubChem's own record leaves that centre undefined.
      { label: "GEOMETRY", value: "chair ring, groups equatorial" },
      { label: "BONDING", value: "pyranose ring, five hydroxyls" },
      // From PubChem's experimental section for CID 5793. 146 °C is the value it
      // leads with. The solubility is its "In water, 4.79X10+5 mg/L at 20 °C",
      // converted once to g/100 mL; unlike caffeine's and aspirin's rows this
      // one is at 20 °C, because PubChem publishes no 25 °C figure for glucose
      // and quoting one temperature as another would be the easiest lie here.
      { label: "MELTING POINT", value: "146 °C" },
      { label: "SOLUBILITY", value: "47.9 g/100 mL at 20 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/5793" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Glucose" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:4167" },
    ],
  },
  nicotine: {
    structure: nicotine,
    properties: [
      { label: "GEOMETRY", value: "two rings, 73° apart" },
      { label: "BONDING", value: "pyridine and pyrrolidine" },
      // The first molecule in this family that is a LIQUID at room temperature,
      // which is the whole point of printing a melting point next to caffeine's
      // 235 °C. Both from PubChem's experimental section for CID 89594; the
      // solubility row is its "In water, 1X10+6 mg/L at 25 °C (miscible)", left
      // as the word rather than converted, because a g/100 mL figure for a
      // liquid that mixes in all proportions would be inventing a limit.
      { label: "MELTING POINT", value: "−79 °C" },
      { label: "SOLUBILITY", value: "miscible at 25 °C" },
    ],
    references: [
      { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/compound/89594" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Nicotine" },
      { label: "ChEBI", url: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:18723" },
    ],
  },
} satisfies Record<MoleculeKey, MoleculeInfo>;

// Widened on the way out, exactly as shapeInfo is: every consumer looks a shape
// up by a name it got at runtime, so the literal keys would buy nothing past
// this line. Undefined for the twenty solids, which is what switches the card's
// mode.
const moleculeInfo: Record<string, MoleculeInfo | undefined> = entries;

export default moleculeInfo;
