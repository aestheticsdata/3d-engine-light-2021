// ENVIRONMENT: what the scene is made of around the shape.
//
// Three of the four toggles are real. SKY DOME, CHECKER FLOOR and, since
// COS-246 (E5a), GRID OVERLAY gate layers BackgroundRenderer actually paints,
// and they are the controls in the console with a second surface showing the
// same switch — the viewport's quick toggles carry SKY, FLOOR and GRID as
// well. That is why all three write the store and none of them keeps a
// private boolean: the owner re-reads the store and pushes the result back to
// every surface, so the two can never drift. GRID STEP is real alongside GRID
// OVERLAY, for the same reason and through the same onLayersChange callback —
// it sizes both the grid's own spacing and the floor's checker cell.
//
// GROUND SHADOW and FOG still have nothing behind them — the renderer casts no
// shadow and applies no fog curve. Both are de-mock E5b (COS-247), and they
// are stored rather than discarded so the console remembers the choice and
// RESET can undo it.

import DOMScope from "@ui/DOMScope";
import SliderRow from "@ui/inspector/controls/SliderRow";
import ToggleRow from "@ui/inspector/controls/ToggleRow";

import type UIStateStore from "@ui/UIStateStore";

// Sky and floor default on because both ran unconditionally before they were
// switchable; grid defaults off because nothing draws one, and a switch reading
// ON would claim something the canvas is not doing. The mockup ships all three
// true — the console's defaults mirror the renderer, never the design.
export const DEFAULT_SKY = true;
export const DEFAULT_FLOOR = true;
export const DEFAULT_GRID = false;
export const DEFAULT_SHADOW = false;
export const DEFAULT_FOG = 18;
export const DEFAULT_GRID_STEP = 4;

const FOG_MIN = 0;
const FOG_MAX = 100;
const GRID_STEP_MIN = 1;
const GRID_STEP_MAX = 20;

// GROUND SHADOW and FOG are what still read this: neither has an engine behind
// it yet (de-mock E5b, COS-247). GRID OVERLAY and GRID STEP left this hint when
// COS-246 (E5a) made them real, and the GRID quick-toggle pill's own copy —
// #ph-quick-grid, previously out in the viewport markup — went with them; a
// pill with no placeholder attributes has nothing left to describe.
const HINT_ID = "ph-world-layer";
const HINT_TEXT = "This world layer is not drawn by the renderer yet (de-mock E5b).";

export interface EnvironmentSectionOptions {
  togglesSelector: string;
  rowsSelector: string;
  store: UIStateStore;
  // Raised after a layer boolean is written, so the owner can re-read the store
  // and push the result to the renderer and to the quick toggles at once.
  onLayersChange: () => void;
}

class EnvironmentSection {
  private readonly store: UIStateStore;
  private readonly skyRow: ToggleRow;
  private readonly floorRow: ToggleRow;
  private readonly gridRow: ToggleRow;
  private readonly shadowRow: ToggleRow;
  private readonly fog: SliderRow;
  private readonly gridStep: SliderRow;

  constructor(options: EnvironmentSectionOptions) {
    const scope = new DOMScope(document);
    const toggles = scope.require<HTMLElement>(options.togglesSelector, "ENVIRONMENT toggles are missing.");
    const rows = scope.require<HTMLElement>(options.rowsSelector, "ENVIRONMENT rows are missing.");
    const placeholder = { title: HINT_TEXT, describedBy: HINT_ID };

    this.store = options.store;
    this.store.registerSlice({
      sky: DEFAULT_SKY,
      floor: DEFAULT_FLOOR,
      grid: DEFAULT_GRID,
      shadow: DEFAULT_SHADOW,
      fog: DEFAULT_FOG,
      gridStep: DEFAULT_GRID_STEP,
    });

    this.skyRow = new ToggleRow({
      label: "SKY DOME",
      on: DEFAULT_SKY,
      onToggle: (next) => {
        this.store.setState({ sky: next });
        options.onLayersChange();
      },
    });
    this.floorRow = new ToggleRow({
      label: "CHECKER FLOOR",
      on: DEFAULT_FLOOR,
      onToggle: (next) => {
        this.store.setState({ floor: next });
        options.onLayersChange();
      },
    });
    this.gridRow = new ToggleRow({
      label: "GRID OVERLAY",
      on: DEFAULT_GRID,
      onToggle: (next) => {
        this.store.setState({ grid: next });
        options.onLayersChange();
      },
    });
    this.shadowRow = new ToggleRow({
      label: "GROUND SHADOW",
      on: DEFAULT_SHADOW,
      placeholder,
      onToggle: (next) => this.store.setState({ shadow: next }),
    });

    this.fog = new SliderRow({
      label: "FOG",
      min: FOG_MIN,
      max: FOG_MAX,
      value: DEFAULT_FOG,
      placeholder,
      format: (value) => `${value}%`,
      onInput: (value) => this.store.setState({ fog: value }),
    });
    // Raises onLayersChange, same as the toggles above: the value it writes
    // feeds BackgroundRenderer.setWorld, which sizes both the grid's spacing
    // and the floor's checker cell.
    this.gridStep = new SliderRow({
      label: "GRID STEP",
      min: GRID_STEP_MIN,
      max: GRID_STEP_MAX,
      value: DEFAULT_GRID_STEP,
      format: (value) => `${value}m`,
      onInput: (value) => {
        this.store.setState({ gridStep: value });
        options.onLayersChange();
      },
    });

    // Applied here rather than asked for in SliderRow's options: it is a
    // mobile-only padding correction for the one place a slider follows a
    // bottom-ruled toggle row, not a property of the control.
    this.fog.element.classList.add("slider-row--tight-bottom");
    this.gridStep.element.classList.add("slider-row--tight-bottom");

    toggles.append(this.skyRow.element, this.floorRow.element, this.gridRow.element, this.shadowRow.element);
    rows.append(this.fog.element, this.gridStep.element, this.buildHint());
  }

  public syncFromStore() {
    const state = this.store.getState();

    this.skyRow.setOn(state.sky ?? DEFAULT_SKY);
    this.floorRow.setOn(state.floor ?? DEFAULT_FLOOR);
    this.gridRow.setOn(state.grid ?? DEFAULT_GRID);
    this.shadowRow.setOn(state.shadow ?? DEFAULT_SHADOW);
    this.fog.setValue(state.fog ?? DEFAULT_FOG);
    this.gridStep.setValue(state.gridStep ?? DEFAULT_GRID_STEP);
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");

    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = HINT_TEXT;

    return hint;
  }
}

export default EnvironmentSection;
