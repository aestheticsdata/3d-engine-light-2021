// PIPELINE: the five ON/OFF rows that gate rasteriser stages.
//
// WIREFRAME and BACKFACE CULLING are real — RenderPipelinePanel owns both
// booleans and the opacity side effect culling carries; this section only
// renders the rows and forwards a click. Z-BUFFER, DITHERING and EDGE
// ANTIALIAS have no rasteriser behind them yet (de-mock E3) and are pure
// UIStateStore state with the placeholder affordance.

import DOMScope from "@ui/DOMScope";
import ToggleRow from "@ui/inspector/controls/ToggleRow";

import type UIStateStore from "@ui/UIStateStore";

export const DEFAULT_ZBUFFER = true;
export const DEFAULT_DITHER = false;
export const DEFAULT_EDGE_AA = true;

const HINT_ID = "ph-pipeline-stage";
const HINT_TEXT = "This pipeline stage is not implemented yet (de-mock E3).";

export interface PipelineSectionOptions {
  root: string;
  store: UIStateStore;
  wireframe: boolean;
  cullBackfaces: boolean;
  onWireframeToggle: (next: boolean) => void;
  onCullToggle: (next: boolean) => void;
}

class PipelineSection {
  private readonly store: UIStateStore;
  private readonly wireframeRow: ToggleRow;
  private readonly cullRow: ToggleRow;
  private readonly zbufferRow: ToggleRow;
  private readonly ditherRow: ToggleRow;
  private readonly edgeAARow: ToggleRow;

  constructor(options: PipelineSectionOptions) {
    const root = new DOMScope(document).require<HTMLElement>(options.root, "PIPELINE section is missing.");
    const placeholder = { title: HINT_TEXT, describedBy: HINT_ID };

    this.store = options.store;
    this.store.registerSlice({ zbuffer: DEFAULT_ZBUFFER, dither: DEFAULT_DITHER, edgeAA: DEFAULT_EDGE_AA });

    this.wireframeRow = new ToggleRow({
      label: "WIREFRAME",
      on: options.wireframe,
      onToggle: options.onWireframeToggle,
    });
    this.cullRow = new ToggleRow({
      label: "BACKFACE CULLING",
      on: options.cullBackfaces,
      onToggle: options.onCullToggle,
    });
    this.zbufferRow = new ToggleRow({
      label: "Z-BUFFER",
      on: DEFAULT_ZBUFFER,
      placeholder,
      onToggle: (next) => this.store.setState({ zbuffer: next }),
    });
    this.ditherRow = new ToggleRow({
      label: "DITHERING",
      on: DEFAULT_DITHER,
      placeholder,
      onToggle: (next) => this.store.setState({ dither: next }),
    });
    this.edgeAARow = new ToggleRow({
      label: "EDGE ANTIALIAS",
      on: DEFAULT_EDGE_AA,
      placeholder,
      onToggle: (next) => this.store.setState({ edgeAA: next }),
    });

    root.append(
      this.wireframeRow.element,
      this.cullRow.element,
      this.zbufferRow.element,
      this.ditherRow.element,
      this.edgeAARow.element,
      this.buildHint(),
    );
  }

  public setWireframeUi(on: boolean) {
    this.wireframeRow.setOn(on);
  }

  public setCullingUi(on: boolean) {
    this.cullRow.setOn(on);
  }

  public syncFromStore() {
    const state = this.store.getState();
    this.zbufferRow.setOn(state.zbuffer ?? DEFAULT_ZBUFFER);
    this.ditherRow.setOn(state.dither ?? DEFAULT_DITHER);
    this.edgeAARow.setOn(state.edgeAA ?? DEFAULT_EDGE_AA);
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");
    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = HINT_TEXT;
    return hint;
  }
}

export default PipelineSection;
