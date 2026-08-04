// CAMERA: five view presets, the projection pair, and the two sliders that are
// the only live camera controls the console has.
//
// FOV and ZOOM both reach the renderer through CameraController. Their defaults
// are imported from it rather than restated here, because the controller seeds
// itself with the same two numbers for the frames before syncFromStore() runs —
// two constants that have to agree is how the opening frame ends up describing a
// camera the sliders do not.
//
// The view presets became real with the camera rig: a chip eases the rig to an
// absolute pitch/yaw/roll over 350ms. They stay momentary and unlit, which is
// not a leftover from when they were inert — the design never draws one
// selected, because a preset is a one-shot write and not a mode the camera stays
// in. The first drag after one leaves the viewpoint somewhere no chip names.

import { DEFAULT_FOV, DEFAULT_ZOOM_SLIDER_VALUE } from "@app/CameraController";
import viewPresets from "@camera/viewPresets";
import DOMScope from "@ui/DOMScope";
import ChipGrid from "@ui/inspector/controls/ChipGrid";
import SliderRow from "@ui/inspector/controls/SliderRow";

import type { ViewPresetKey } from "@camera/viewPresets";
import type UIStateStore from "@ui/UIStateStore";
import type { ProjectionKey } from "@ui/UIStateStore";

export const DEFAULT_PROJECTION: ProjectionKey = "PERSPECTIVE";

const FOV_MIN = 15;
const FOV_MAX = 120;
const ZOOM_MIN = 0;
const ZOOM_MAX = 100;

// Off the preset table rather than a second list of five labels here: the chip
// order is the table's declaration order, so adding a view is one edit.
const VIEW_PRESETS = Object.keys(viewPresets) as ViewPresetKey[];
const PROJECTIONS: ProjectionKey[] = ["PERSPECTIVE", "ORTHOGRAPHIC"];

// The markup already carries this exact sentence twice, for the status bar's
// PERSPECTIVE segment and the viewport HUD's. A third node saying the same thing
// about the same gap is what the hint id exists to avoid, so this chip points at
// the HUD's — which lives outside every tab panel and is therefore in the
// accessibility tree whenever anything is.
const PROJECTION_HINT_ID = "ph-vp-projection";
const PROJECTION_HINT_TEXT = "Orthographic projection is not wired to the engine yet (de-mock E2).";

export interface CameraSectionOptions {
  viewGridSelector: string;
  projectionGridSelector: string;
  rowsSelector: string;
  store: UIStateStore;
  onFov: (degrees: number) => void;
  onZoom: (sliderValue: number) => void;
  onViewPreset: (key: ViewPresetKey) => void;
}

class CameraSection {
  private readonly store: UIStateStore;
  private readonly apply: CameraSectionOptions;
  private readonly projectionGrid: ChipGrid;
  private readonly fov: SliderRow;
  private readonly zoom: SliderRow;

  constructor(options: CameraSectionOptions) {
    const scope = new DOMScope(document);
    const rows = scope.require<HTMLElement>(options.rowsSelector, "CAMERA section is missing.");

    this.store = options.store;
    this.apply = options;
    this.store.registerSlice({
      fov: DEFAULT_FOV,
      zoom: DEFAULT_ZOOM_SLIDER_VALUE,
      projection: DEFAULT_PROJECTION,
    });

    const viewGrid = new ChipGrid({
      selector: options.viewGridSelector,
      modifier: "chip--view",
      columns: VIEW_PRESETS.length,
      momentary: true,
      // Nothing is stored: a preset is a jump, and the three angles it writes
      // are already RESET-covered as the TRANSFORM tab's own slices. Remembering
      // which chip was last pressed would be remembering a mode the camera is
      // not in the moment anything else moves it.
      onPick: (id) => options.onViewPreset(id as ViewPresetKey),
    });
    viewGrid.setChips(VIEW_PRESETS.map((key) => ({ id: key, label: key })));

    this.projectionGrid = new ChipGrid({
      selector: options.projectionGridSelector,
      modifier: "chip--proj",
      columns: PROJECTIONS.length,
      onPick: (id) => this.pickProjection(id as ProjectionKey),
    });
    this.projectionGrid.setChips(
      PROJECTIONS.map((key) => ({
        id: key,
        label: key,
        // Per-chip, not grid-level: PERSPECTIVE is the projection the engine
        // actually runs, and dimming it would claim the working half of the
        // pair is unbuilt.
        placeholder:
          key === "ORTHOGRAPHIC" ? { title: PROJECTION_HINT_TEXT, describedBy: PROJECTION_HINT_ID } : undefined,
      })),
    );
    this.projectionGrid.setActive(DEFAULT_PROJECTION);

    this.fov = new SliderRow({
      label: "FOV",
      min: FOV_MIN,
      max: FOV_MAX,
      value: DEFAULT_FOV,
      format: (value) => `${value}°`,
      onInput: (value) => {
        this.store.setState({ fov: value });
        options.onFov(value);
      },
    });

    this.zoom = new SliderRow({
      label: "ZOOM",
      min: ZOOM_MIN,
      max: ZOOM_MAX,
      value: DEFAULT_ZOOM_SLIDER_VALUE,
      format: (value) => `${value}%`,
      onInput: (value) => {
        this.store.setState({ zoom: value });
        options.onZoom(value);
      },
    });

    rows.append(this.fov.element, this.zoom.element);
  }

  // Writes the store's values into the rows AND pushes them to the camera. Both
  // halves matter: this is the RESET path, and a reset that moved the sliders
  // without moving the camera would leave the two disagreeing until the next
  // drag.
  public syncFromStore() {
    const state = this.store.getState();
    const fov = state.fov ?? DEFAULT_FOV;
    const zoom = state.zoom ?? DEFAULT_ZOOM_SLIDER_VALUE;

    this.fov.setValue(fov);
    this.zoom.setValue(zoom);
    this.projectionGrid.setActive(state.projection ?? DEFAULT_PROJECTION);

    this.apply.onFov(fov);
    this.apply.onZoom(zoom);
  }

  private pickProjection(key: ProjectionKey) {
    this.projectionGrid.setActive(key);
    this.store.setState({ projection: key });
  }
}

export default CameraSection;
