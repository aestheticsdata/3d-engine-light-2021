// SHAPE STORY: the prose card under the inspector, in either of its two modes.
//
// It owns no state and reads nothing — the catalogue entry is pushed in on every
// shape change, together with the primitive key it belongs to.
//
// The second mode is the molecule one (HAL-157). Its trigger is the presence of
// the third argument rather than a flag or a second method: a shape either has
// chemistry to print or it does not, and that is already expressible.
//
// EVERY WRITE HAS TO BE TOTAL, and that is the trap this card ships with if it
// is not watched. The same nodes are repainted on every shape change, so each
// thing molecule mode changes — the header, the badge label, the two hidden
// rows, the injected properties — must be written back on the solid path too.
// A field only one branch touches is a field that survives the switch away.
// syncMode is the single place both branches go through, so there is one list
// to keep total rather than two that must agree.

import { molarMass } from "@data/molecules/molarMass";
import { moleculeFormula } from "@data/molecules/moleculeFormula";
import DOMScope from "@ui/DOMScope";
import { primitiveLabel } from "@ui/primitiveLabel";

import type { MoleculeInfo } from "@data/moleculeInfo";
import type { ShapeInfo, ShapeReference } from "@data/shapeInfo";

// Lowercase because .panel__title uppercases in CSS; a pre-shouted string here
// would be a second styling source. Singular "molecule": one is on screen, and
// this card's rule is that its header names what it is showing.
const SOLID_HEADER = "shape story";
const MOLECULE_HEADER = "molecule properties";

const SOLID_BADGE_LABEL = "DENSITY";
const MOLECULE_BADGE_LABEL = "FORMULA";

const MOLAR_MASS_DECIMALS = 2;

class ShapeStoryPanel {
  private readonly header: HTMLElement;
  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly feature: HTMLElement;
  private readonly badgeLabel: HTMLElement;
  private readonly badgeValue: HTMLElement;
  private readonly generator: HTMLElement;
  private readonly generatorRow: HTMLElement;
  private readonly windingRow: HTMLElement;
  private readonly properties: HTMLElement;
  private readonly references: HTMLElement;

  constructor() {
    const scope = new DOMScope(document);
    const missing = "SHAPE STORY node is missing.";

    this.header = scope.require<HTMLElement>("#shapeStoryHeader", missing);
    this.title = scope.require<HTMLElement>("#shapeStoryTitle", missing);
    this.description = scope.require<HTMLElement>("#shapeStoryDescription", missing);
    this.feature = scope.require<HTMLElement>("#shapeStoryFeature", missing);
    this.badgeLabel = scope.require<HTMLElement>("#shapeStoryBadgeLabel", missing);
    this.badgeValue = scope.require<HTMLElement>("#shapeStoryDensity", missing);
    this.generator = scope.require<HTMLElement>("#shapeStoryGenerator", missing);
    this.generatorRow = scope.require<HTMLElement>("#shapeStoryGeneratorRow", missing);
    this.windingRow = scope.require<HTMLElement>("#shapeStoryWindingRow", missing);
    this.properties = scope.require<HTMLElement>("#shapeStoryProperties", missing);
    this.references = scope.require<HTMLElement>("#shapeStoryReferences", missing);
  }

  public show(primitive: string, info: ShapeInfo | undefined, molecule?: MoleculeInfo) {
    // Unreachable today — every primitive in data.ts has a shapeInfo entry — and
    // kept for the one that eventually lands without a write-up. The generator
    // row falls back to an em dash rather than an empty slot, so the label never
    // stands over nothing.
    if (!info) {
      this.syncMode(undefined);
      this.title.textContent = primitiveLabel(primitive);
      this.description.textContent = "";
      this.feature.textContent = "";
      this.badgeValue.textContent = "";
      this.generator.textContent = "—";
      this.syncReferences();
      return;
    }

    this.syncMode(molecule);
    this.title.textContent = info.title;
    this.description.textContent = info.description;
    this.feature.textContent = info.geometricFeature;

    if (molecule) {
      // The formula and the mass are derived here rather than stored, so
      // neither can contradict the mesh: both read the atom array the geometry
      // was built from. References come from moleculeInfo, never from
      // shapeInfo — two link lists for one card is how they drift apart.
      this.badgeValue.textContent = moleculeFormula(molecule.structure.atoms);
      this.syncReferences(molecule.references);
      return;
    }

    this.badgeValue.textContent = info.densityLabel;
    this.generator.textContent = info.generator;
    this.syncReferences(info.references);
  }

  // Both directions of the switch, in one place. GENERATOR and WINDING hide for
  // a molecule rather than being repurposed: WINDING is a literal in the markup,
  // and left standing under a chemistry header it would be the card asserting
  // something about a molecule that it is not saying.
  private syncMode(molecule: MoleculeInfo | undefined) {
    this.header.textContent = molecule ? MOLECULE_HEADER : SOLID_HEADER;
    this.badgeLabel.textContent = molecule ? MOLECULE_BADGE_LABEL : SOLID_BADGE_LABEL;
    this.generatorRow.hidden = molecule !== undefined;
    this.windingRow.hidden = molecule !== undefined;

    this.properties.replaceChildren();

    if (!molecule) {
      return;
    }

    // Emptied rather than left as it was. Nothing reads a hidden row, so this
    // buys no pixel today — but a row holding the PREVIOUS shape's generator is
    // the untotal write this class's header is about, and the day the row stops
    // being hidden it would print a lie about a molecule. Caught by driving ten
    // switches and diffing, which is the only way it ever surfaces.
    this.generator.textContent = "";

    molecule.properties.forEach((property) => {
      this.properties.appendChild(this.buildRow(property.label, property.value));
    });
    // Last, and after the authored rows: it is the derived one, and the reader
    // meets what the file states before what was computed from it. Formatted
    // here because the precision is this card's business — molarMass returns a
    // number precisely so it can be printed more than one way.
    this.properties.appendChild(
      this.buildRow("MOLAR MASS", `${molarMass(molecule.structure.atoms).toFixed(MOLAR_MASS_DECIMALS)} g/mol`),
    );
  }

  private buildRow(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "shape-story__row";

    const key = document.createElement("span");
    key.className = "shape-story__key";
    key.textContent = label;

    const slot = document.createElement("span");
    slot.className = "shape-story__value";
    // textContent, as everywhere in this folder: the formula's subscripts are
    // Unicode, so nothing here needs innerHTML and src/ui still has none.
    slot.textContent = value;

    row.append(key, slot);

    return row;
  }

  // Opened in a new tab so the running animation is never torn down; noopener
  // keeps the opened page from reaching back through window.opener.
  private syncReferences(references: ShapeReference[] = []) {
    this.references.replaceChildren();

    references.forEach((reference) => {
      const link = document.createElement("a");
      link.className = "shape-story__link";
      link.href = reference.url;
      link.textContent = reference.label;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      this.references.appendChild(link);
    });
  }
}

export default ShapeStoryPanel;
