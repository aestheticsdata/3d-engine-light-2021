// MATERIAL: how the surface is painted.
//
// Three of the four controls are real. OPACITY reaches the rasteriser through
// TriangleRenderOptions and has been live since before the refonte; the five
// swatches and two of the four texture chips became live with E4a. What is left
// unwired is CHECKER, UV GRID and UV SCALE, which need generators E4b builds.
//
// The structural reason textures could not be swapped at runtime is gone rather
// than worked around. Materials are still baked per triangle in
// src/data/shapes/* — rgba() strings plus the `dog` and `galaxy` keys on the
// cube — and that is deliberate, because it is what makes the registry worth
// reading. E4a classifies that authored slot once and resolves it against a
// mesh-wide material, so AUTHORED still draws exactly what the shape files say
// while SOLID overrides all of it.
//
// The swatch row is where the palette turns into a colour the engine can use.
// The names are the store's — RESET and the store stay readable — and what
// leaves here is whatever --color-swatch-* resolved to, so colors.css remains
// the one place the palette is written down.
//
// The OPACITY input keeps the id #opacitySlider. RenderPipelinePanel resolves
// that element to own its `disabled` state and the follow-cursor tooltip, so
// this section must build it before that class is constructed.

import ChipGrid from "@ui/inspector/controls/ChipGrid";
import SliderRow from "@ui/inspector/controls/SliderRow";

import type { TextureMode } from "@rendering/material";
import type UIStateStore from "@ui/UIStateStore";

// AUTHORED and white, because the default state has to be the frame the renderer
// already draws: AUTHORED is the mode that defers to the shape files, and white
// is the identity of the multiply the base colour performs. The mockup opens on
// CHECKER and red, which would have made the console's first frame a shape
// nothing in the registry describes.
export const DEFAULT_TEXTURE: TextureMode = "authored";
export const DEFAULT_BASE_COLOR = "white";
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
const HINT_TEXT = "Procedural textures and their tiling are not generated yet (de-mock E4b).";

// The design's fourth chip is NO TEXTURE, which in an engine whose shapes ship
// their own materials would either be a synonym for SOLID or the only state in
// which the cube's dog and galaxy faces are visible. AUTHORED names what it
// actually does. Renamed in place, so the two-column grid does not move.
//
// The ids are TextureMode's own values rather than a second vocabulary mapped
// onto it: one union behind the chip and the branch in resolveMaterial, so
// neither end can grow a value the other does not have.
const TEXTURES: { id: TextureMode; label: string; placeholder?: { title: string; describedBy: string } }[] = [
  { id: "checker", label: "CHECKER", placeholder: { title: HINT_TEXT, describedBy: HINT_ID } },
  { id: "solid", label: "SOLID" },
  { id: "uvGrid", label: "UV GRID", placeholder: { title: HINT_TEXT, describedBy: HINT_ID } },
  { id: "authored", label: "AUTHORED" },
];

// The design's palette, in its order. Each name keys a --color-swatch-* token;
// the hex lives in colors.css and never here.
const BASE_COLORS = ["red", "yellow", "green", "blue", "white"];

export interface MaterialSectionOptions {
  root: HTMLElement;
  textureGridSelector: string;
  swatchRowSelector: string;
  store: UIStateStore;
  onTexture: (mode: TextureMode) => void;
  onBaseColor: (css: string) => void;
  onOpacity: (sliderValue: number) => void;
}

class MaterialSection {
  private readonly store: UIStateStore;
  private readonly apply: MaterialSectionOptions;
  private readonly textures: ChipGrid;
  private readonly swatches: Map<string, HTMLButtonElement>;
  private readonly opacity: SliderRow;
  private readonly uvScale: SliderRow;

  constructor(options: MaterialSectionOptions) {
    this.store = options.store;
    this.apply = options;
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
      onPick: (id) => this.pickTexture(id as TextureMode),
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

  // Writes the store's values into the controls AND pushes them to the renderer,
  // the same two halves CameraSection.syncFromStore carries and for the same
  // reason: this is the RESET path, and a reset that moved the chip without
  // moving the mesh would leave the two disagreeing until the next click.
  public syncFromStore() {
    const state = this.store.getState();
    const texture = state.texture ?? DEFAULT_TEXTURE;
    const baseColor = state.baseColor ?? DEFAULT_BASE_COLOR;

    this.textures.setActive(texture);
    this.setActiveSwatch(baseColor);
    this.uvScale.setValue(state.uvScale ?? DEFAULT_UV_SCALE);

    this.apply.onTexture(texture);
    this.apply.onBaseColor(this.cssFor(baseColor));
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
      swatch.setAttribute("aria-label", name);
      swatch.setAttribute("aria-pressed", "false");
      swatch.addEventListener("click", () => this.pickBaseColor(name));

      this.swatches.set(name, swatch);
      fragment.appendChild(swatch);
    });

    row.appendChild(fragment);
    this.setActiveSwatch(DEFAULT_BASE_COLOR);
  }

  private pickTexture(mode: TextureMode) {
    this.textures.setActive(mode);
    this.store.setState({ texture: mode });
    this.apply.onTexture(mode);
  }

  private pickBaseColor(name: string) {
    this.setActiveSwatch(name);
    this.store.setState({ baseColor: name });
    this.apply.onBaseColor(this.cssFor(name));
  }

  // The palette resolved rather than restated. The swatch already paints
  // var(--color-swatch-<name>), so reading its computed background is what keeps
  // colors.css the one place the five colours are written down — the engine gets
  // a colour, and this section is the only thing that knows a colour called
  // "green" exists.
  //
  // Read when a swatch is picked rather than when it is built, so it cannot
  // depend on whether the stylesheet had resolved by the time this constructor
  // ran.
  private cssFor(name: string): string {
    const swatch = this.swatches.get(name);

    return swatch ? getComputedStyle(swatch).backgroundColor : name;
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
