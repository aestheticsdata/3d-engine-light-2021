// SHADING MODE: the six-chip grid that picks how faces are shaded.
//
// Only WIRE has a rasteriser behind it today. The other five persist a
// cosmetic pick and carry the placeholder affordance — this section renders
// no CSS filter and asserts nothing about the canvas for them.
//
// WIRE and the PIPELINE WIREFRAME toggle are two views of one boolean
// (RenderPipelinePanel owns it). syncFromWireframe() is the echo back from
// that boolean. Picking a non-WIRE chip also clears wireframe, and that
// change echoes back synchronously — so the guard compares the incoming
// boolean against what the current mode implies (impliesWireframe) and
// returns early when they already agree, which is what stops a GOURAUD pick
// from being overwritten back to FLAT by its own echo.

import DOMScope from "@ui/DOMScope";
import ChipGrid from "@ui/inspector/controls/ChipGrid";
import { impliesWireframe } from "@ui/modeLabel";

import type { ChipDescriptor } from "@ui/inspector/controls/ChipGrid";
import type { ShadingModeKey } from "@ui/modeLabel";
import type UIStateStore from "@ui/UIStateStore";

const DEFAULT_MODE: ShadingModeKey = "FLAT";
const HINT_ID = "ph-shading-mode";

const CHIPS: ChipDescriptor[] = [
  {
    id: "POINTS",
    label: "POINTS",
    placeholder: { title: "POINTS shading is not implemented yet (de-mock E3).", describedBy: HINT_ID },
  },
  { id: "WIRE", label: "WIRE" },
  { id: "FLAT", label: "FLAT" },
  {
    id: "GOURAUD",
    label: "GOURAUD",
    placeholder: { title: "GOURAUD shading is not implemented yet (de-mock E3).", describedBy: HINT_ID },
  },
  {
    id: "DEPTH",
    label: "DEPTH",
    placeholder: { title: "DEPTH shading is not implemented yet (de-mock E3).", describedBy: HINT_ID },
  },
  {
    id: "NORMALS",
    label: "NORMALS",
    placeholder: { title: "NORMALS shading is not implemented yet (de-mock E3).", describedBy: HINT_ID },
  },
];

export interface ShadingSectionOptions {
  chipGridSelector: string;
  hintRoot: string;
  store: UIStateStore;
  onSelect: (mode: ShadingModeKey) => void;
}

class ShadingSection {
  private readonly store: UIStateStore;
  private readonly chips: ChipGrid;
  private readonly onSelect: (mode: ShadingModeKey) => void;
  private currentMode: ShadingModeKey;

  constructor(options: ShadingSectionOptions) {
    const hintRoot = new DOMScope(document).require<HTMLElement>(options.hintRoot, "SHADING MODE section is missing.");

    this.store = options.store;
    this.onSelect = options.onSelect;
    this.currentMode = DEFAULT_MODE;
    this.store.registerSlice({ shadingMode: DEFAULT_MODE });

    this.chips = new ChipGrid({
      selector: options.chipGridSelector,
      modifier: "chip--mode",
      columns: 3,
      onPick: this.pick,
    });
    this.chips.setChips(CHIPS);
    this.chips.setActive(DEFAULT_MODE);

    hintRoot.append(this.buildHint());
  }

  public syncFromWireframe(wireframeEnabled: boolean) {
    const impliesWire = impliesWireframe(this.currentMode);
    if (wireframeEnabled === impliesWire) {
      return;
    }
    this.setMode(wireframeEnabled ? "WIRE" : DEFAULT_MODE);
  }

  public syncFromStore() {
    this.setMode(this.store.getState().shadingMode ?? DEFAULT_MODE);
  }

  private pick = (id: string) => {
    const mode = id as ShadingModeKey;
    this.setMode(mode);
    this.onSelect(mode);
  };

  private setMode(mode: ShadingModeKey) {
    this.currentMode = mode;
    this.chips.setActive(mode);
    this.store.setState({ shadingMode: mode });
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");
    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = "This shading mode is not implemented yet (de-mock E3).";
    return hint;
  }
}

export default ShadingSection;
