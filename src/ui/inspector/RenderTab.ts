// The RENDER tab: shading mode, pipeline, lighting. Three sections and no
// logic of its own — same shape as ShapeTab, which this is composed
// alongside in Main's constructor.
//
// syncPipeline() is the one hook the rest of the tab does not drive itself:
// wireframe and backface culling are RenderPipelinePanel's booleans, not
// this store's, so Main pushes them in on every pipeline change, the same
// way it already pushes opacity to the SHAPE tab.

import LightingSection from "@ui/inspector/LightingSection";
import PipelineSection from "@ui/inspector/PipelineSection";
import ShadingSection from "@ui/inspector/ShadingSection";

import type { ShadingModeKey } from "@ui/modeLabel";
import type UIStateStore from "@ui/UIStateStore";

export interface RenderTabOptions {
  store: UIStateStore;
  wireframe: boolean;
  cullBackfaces: boolean;
  onShadingSelect: (mode: ShadingModeKey) => void;
  onWireframeToggle: (next: boolean) => void;
  onCullToggle: (next: boolean) => void;
}

class RenderTab {
  private readonly shading: ShadingSection;
  private readonly pipeline: PipelineSection;
  private readonly lighting: LightingSection;

  constructor(options: RenderTabOptions) {
    this.shading = new ShadingSection({
      chipGridSelector: "#shadingChips",
      hintRoot: "#shadingSection",
      store: options.store,
      onSelect: options.onShadingSelect,
    });

    this.pipeline = new PipelineSection({
      root: "#pipelineToggles",
      store: options.store,
      wireframe: options.wireframe,
      cullBackfaces: options.cullBackfaces,
      onWireframeToggle: options.onWireframeToggle,
      onCullToggle: options.onCullToggle,
    });

    this.lighting = new LightingSection({
      root: "#lightingRows",
      store: options.store,
    });
  }

  // Called after the store's defaults are restored, mirroring
  // ShapeTab.syncFromStore — every section reads back from one place.
  public syncFromStore() {
    this.shading.syncFromStore();
    this.pipeline.syncFromStore();
    this.lighting.syncFromStore();
  }

  public syncPipeline(wireframeEnabled: boolean, cullBackfaces: boolean) {
    this.shading.syncFromWireframe(wireframeEnabled);
    this.pipeline.setWireframeUi(wireframeEnabled);
    this.pipeline.setCullingUi(cullBackfaces);
  }
}

export default RenderTab;
