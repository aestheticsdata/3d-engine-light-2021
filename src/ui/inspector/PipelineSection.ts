// PIPELINE: the five ON/OFF rows that gate rasteriser stages.
//
// All five are real, and this section is the last one in the RENDER tab to have
// carried a placeholder. WIREFRAME and BACKFACE CULLING were always live —
// RenderPipelinePanel owns both booleans and the opacity side effect culling
// carries; this section only renders the rows and forwards a click. Z-BUFFER
// became live with E3b (COS-242), when the toggle started selecting Surface3D's
// rasteriser backend. DITHERING and EDGE ANTIALIAS followed with E3d (COS-244) —
// both now gate a per-pixel pass inside that backend — which is what took the
// last placeholder affordance, and the hint span that explained it, out of this
// file entirely.
//
// The three defaults below are read by Main every frame as well as by the rows,
// so they are the single answer to "what does this console do before anyone
// touches it". EDGE ANTIALIAS defaults ON deliberately: E3b's own ticket makes
// it the condition for Z-BUFFER defaulting on, because a hand-written rasteriser
// without it draws harder edges than the painter path it replaced.

import DOMScope from "@ui/DOMScope";
import ToggleRow from "@ui/inspector/controls/ToggleRow";

import type UIStateStore from "@ui/UIStateStore";

export const DEFAULT_ZBUFFER = true;
export const DEFAULT_DITHER = false;
export const DEFAULT_EDGE_AA = true;

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
      onToggle: (next) => this.store.setState({ zbuffer: next }),
    });
    this.ditherRow = new ToggleRow({
      label: "DITHERING",
      on: DEFAULT_DITHER,
      onToggle: (next) => this.store.setState({ dither: next }),
    });
    this.edgeAARow = new ToggleRow({
      label: "EDGE ANTIALIAS",
      on: DEFAULT_EDGE_AA,
      onToggle: (next) => this.store.setState({ edgeAA: next }),
    });

    root.append(
      this.wireframeRow.element,
      this.cullRow.element,
      this.zbufferRow.element,
      this.ditherRow.element,
      this.edgeAARow.element,
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
}

export default PipelineSection;
