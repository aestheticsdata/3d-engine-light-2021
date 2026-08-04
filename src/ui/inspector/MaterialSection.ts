// MATERIAL: how the surface is painted.
//
// One of the four controls is real. OPACITY reaches the rasteriser through
// TriangleRenderOptions and has been live since before the refonte; the texture
// chips, the base-colour swatches and UV SCALE are built now and wired by
// de-mock E4. They are not inert — each stores its choice, so the console
// remembers what you picked and RESET puts it back — they simply change nothing
// on the canvas yet.
//
// Textures cannot be swapped at runtime today for a structural reason worth
// recording: materials are baked per triangle in src/data/shapes/*, as rgba()
// strings plus the `dog` and `galaxy` keys on the cube. There is no material
// slot to point somewhere else.
//
// The OPACITY input keeps the id #opacitySlider. RenderPipelinePanel resolves
// that element to own its `disabled` state and the follow-cursor tooltip, so
// this section must build it before that class is constructed.

import ChipGrid from "@ui/inspector/controls/ChipGrid";
import SliderRow from "@ui/inspector/controls/SliderRow";

import type UIStateStore from "@ui/UIStateStore";

export const DEFAULT_TEXTURE = "checker";
export const DEFAULT_BASE_COLOR = "red";
export const DEFAULT_UV_SCALE = 8;
export const DEFAULT_OPACITY_UI = 100;

// Exported because RenderPipelinePanel resolves the same element to own its
// `disabled` state and the follow-cursor tooltip. One place spells the id, and
// it is the place that creates it.
export const OPACITY_SLIDER = "#opacitySlider";

const OPACITY_MIN = 0;
const OPACITY_MAX = 100;
const UV_MIN = 1;
const UV_MAX = 16;
const HINT_ID = "ph-shape-material";
const HINT_TEXT = "Materials are baked per triangle and cannot be swapped at runtime yet (de-mock E4).";

const TEXTURES = [
  { id: "checker", label: "CHECKER" },
  { id: "solid", label: "SOLID" },
  { id: "uvGrid", label: "UV GRID" },
  { id: "none", label: "NO TEXTURE" },
];

// The design's palette, in its order. Each name keys a --color-swatch-* token;
// the hex lives in colors.css and never here.
const BASE_COLORS = ["red", "yellow", "green", "blue", "white"];

export interface MaterialSectionOptions {
  root: HTMLElement;
  textureGridSelector: string;
  swatchRowSelector: string;
  store: UIStateStore;
  onOpacity: (sliderValue: number) => void;
}

class MaterialSection {
  private readonly store: UIStateStore;
  private readonly textures: ChipGrid;
  private readonly swatches: Map<string, HTMLButtonElement>;
  private readonly opacity: SliderRow;
  private readonly uvScale: SliderRow;

  constructor(options: MaterialSectionOptions) {
    this.store = options.store;
    this.swatches = new Map();
    this.store.registerSlice({
      texture: DEFAULT_TEXTURE,
      baseColor: DEFAULT_BASE_COLOR,
      uvScale: DEFAULT_UV_SCALE,
    });

    this.textures = new ChipGrid({
      selector: options.textureGridSelector,
      modifier: "chip--tex",
      columns: 2,
      onPick: (id) => {
        this.store.setState({ texture: id });
        this.textures.setActive(id);
      },
      placeholder: { title: HINT_TEXT, describedBy: HINT_ID },
    });
    this.textures.setChips(TEXTURES);
    this.textures.setActive(DEFAULT_TEXTURE);

    this.buildSwatches(options.swatchRowSelector);

    this.opacity = new SliderRow({
      label: "OPACITY",
      min: OPACITY_MIN,
      max: OPACITY_MAX,
      value: DEFAULT_OPACITY_UI,
      format: (value) => `${value}%`,
      onInput: options.onOpacity,
      inputId: "opacitySlider",
    });

    this.uvScale = new SliderRow({
      label: "UV SCALE",
      min: UV_MIN,
      max: UV_MAX,
      value: DEFAULT_UV_SCALE,
      format: (value) => `${value}×`,
      onInput: (value) => this.store.setState({ uvScale: value }),
      placeholder: { title: HINT_TEXT, describedBy: HINT_ID },
    });

    options.root.append(this.opacity.element, this.uvScale.element, this.buildHint());
  }

  public get opacityRow(): SliderRow {
    return this.opacity;
  }

  public syncFromStore() {
    const state = this.store.getState();

    this.textures.setActive(state.texture ?? DEFAULT_TEXTURE);
    this.setActiveSwatch(state.baseColor ?? DEFAULT_BASE_COLOR);
    this.uvScale.setValue(state.uvScale ?? DEFAULT_UV_SCALE);
  }

  // Buttons, not divs: a colour is a choice, and a choice has to be reachable
  // from the keyboard. chip.css already paints .swatch and its active ring.
  private buildSwatches(selector: string) {
    const row = document.querySelector<HTMLElement>(selector);

    if (!row) {
      throw new Error(`MATERIAL node is missing — no element matches ${selector}.`);
    }

    const fragment = document.createDocumentFragment();

    BASE_COLORS.forEach((name) => {
      const swatch = document.createElement("button");

      swatch.type = "button";
      // .tap-pad extends the hit area to the touch minimum without changing the
      // 38x32 the design paints on mobile.
      swatch.className = "swatch tap-pad";
      swatch.style.setProperty("--tap-pad", "6px");
      swatch.style.background = `var(--color-swatch-${name})`;
      swatch.dataset.placeholder = "true";
      swatch.title = HINT_TEXT;
      swatch.setAttribute("aria-describedby", HINT_ID);
      swatch.setAttribute("aria-label", name);
      swatch.setAttribute("aria-pressed", "false");
      swatch.addEventListener("click", () => {
        this.store.setState({ baseColor: name });
        this.setActiveSwatch(name);
      });

      this.swatches.set(name, swatch);
      fragment.appendChild(swatch);
    });

    row.appendChild(fragment);
    this.setActiveSwatch(DEFAULT_BASE_COLOR);
  }

  private setActiveSwatch(name: string) {
    this.swatches.forEach((swatch, id) => {
      const active = id === name;
      swatch.classList.toggle("is-active", active);
      swatch.setAttribute("aria-pressed", String(active));
    });
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");

    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = HINT_TEXT;

    return hint;
  }
}

export default MaterialSection;
