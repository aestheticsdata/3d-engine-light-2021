// CAMERA: five view presets, the projection pair, and the two sliders that are
// the only live camera controls the console has.
//
// FOV and ZOOM both reach the renderer through CameraController. Their defaults
// are imported from it rather than restated here, because the controller seeds
// itself with the same two numbers for the frames before syncFromStore() runs —
// two constants that have to agree is how the opening frame ends up describing a
// camera the sliders do not.
//
// The view presets are inert, and not because they are unfinished. The mockup's
// presets set absolute yaw/pitch pairs; this engine's pitch and yaw are per-frame
// rotation *rates* offset from the canvas centre, so "set yaw to 180" would set a
// spin speed rather than a viewpoint. They become real with de-mock E1's camera
// rig, and they stay momentary and unlit after that too — the design never draws
// one selected.

import { DEFAULT_FOV, DEFAULT_ZOOM_SLIDER_VALUE } from "@app/CameraController";
import DOMScope from "@ui/DOMScope";
import ChipGrid from "@ui/inspector/controls/ChipGrid";
import SliderRow from "@ui/inspector/controls/SliderRow";

import type UIStateStore from "@ui/UIStateStore";
import type { ProjectionKey } from "@ui/UIStateStore";

export const DEFAULT_PROJECTION: ProjectionKey = "PERSPECTIVE";

const FOV_MIN = 15;
const FOV_MAX = 120;
const ZOOM_MIN = 0;
const ZOOM_MAX = 100;

const VIEW_PRESETS = ["FRNT", "BACK", "TOP", "SIDE", "ISO"];
const PROJECTIONS: ProjectionKey[] = ["PERSPECTIVE", "ORTHOGRAPHIC"];

const VIEW_HINT_ID = "ph-view-preset";
const VIEW_HINT_TEXT = "Rotation is rate-based, so there is no viewpoint to jump to yet (de-mock E1).";

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
      placeholder: { title: VIEW_HINT_TEXT, describedBy: VIEW_HINT_ID },
      // Nothing to do, and nothing stored either: a preset is a jump, so there
      // is no state a reset would have to undo. The chip exists so the control
      // surface is complete and the affordance says why it is quiet.
      onPick: () => {},
    });
    viewGrid.setChips(VIEW_PRESETS.map((label) => ({ id: label, label })));

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

    rows.append(this.fov.element, this.zoom.element, this.buildHint(VIEW_HINT_ID, VIEW_HINT_TEXT));
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

  private buildHint(id: string, text: string): HTMLElement {
    const hint = document.createElement("span");

    hint.className = "placeholder-hint";
    hint.id = id;
    hint.textContent = text;

    return hint;
  }
}

export default CameraSection;
