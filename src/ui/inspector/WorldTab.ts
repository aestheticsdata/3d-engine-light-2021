// The WORLD tab: camera and environment. Two sections and no logic of its own —
// same shape as ShapeTab and RenderTab, which this is composed alongside in
// Main's constructor.
//
// The desktop order is CAMERA then ENVIRONMENT and the mobile order is the
// reverse, which is a CSS `order` flip rather than a second DOM: on a phone the
// environment toggles are the cheaper, more tappable controls and belong above
// the fold. Nothing here knows which branch is showing.

import CameraSection from "@ui/inspector/CameraSection";
import EnvironmentSection from "@ui/inspector/EnvironmentSection";

import type { ViewPresetKey } from "@camera/viewPresets";
import type { ProjectionMode } from "@primitives/Camera";
import type UIStateStore from "@ui/UIStateStore";

export interface WorldTabOptions {
  store: UIStateStore;
  onFov: (degrees: number) => void;
  onZoom: (sliderValue: number) => void;
  onProjection: (mode: ProjectionMode) => void;
  onViewPreset: (key: ViewPresetKey) => void;
  onLayersChange: () => void;
}

class WorldTab {
  private readonly camera: CameraSection;
  private readonly environment: EnvironmentSection;

  constructor(options: WorldTabOptions) {
    this.camera = new CameraSection({
      viewGridSelector: "#viewPresetChips",
      projectionGridSelector: "#projectionChips",
      rowsSelector: "#cameraRows",
      store: options.store,
      onFov: options.onFov,
      onZoom: options.onZoom,
      onProjection: options.onProjection,
      onViewPreset: options.onViewPreset,
    });

    this.environment = new EnvironmentSection({
      togglesSelector: "#environmentToggles",
      rowsSelector: "#environmentRows",
      store: options.store,
      onLayersChange: options.onLayersChange,
    });
  }

  // Called after the store's defaults are restored, mirroring the other two
  // tabs — every section reads back from one place. CAMERA's half also re-applies
  // its three values to the renderer, because all three are live.
  public syncFromStore() {
    this.camera.syncFromStore();
    this.environment.syncFromStore();
  }

  // The environment half alone, for the case the other surface moved: a quick
  // toggle writes SKY, FLOOR or GRID and this tab's rows have to follow in the
  // same frame without the camera being re-pushed.
  public syncEnvironmentUi() {
    this.environment.syncFromStore();
  }
}

export default WorldTab;
