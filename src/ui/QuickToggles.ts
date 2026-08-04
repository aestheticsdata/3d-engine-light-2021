// The five one-tap scene switches: SKY, FLOOR, GRID, WIRE, CULL.
//
// One component with two mounts. On desktop the pills float over the viewport as
// translucent blurred chips; on mobile they leave the viewport entirely and
// become a five-column row under it. Both mounts exist in the DOM at once and
// CSS hides the wrong one at the exclusive breakpoint, so nothing here reads a
// media query or re-renders on resize — which is why one class can own two sets
// of buttons without knowing which set is visible.
//
// It owns none of the five booleans, and the two halves reach their owner
// differently. SKY, FLOOR and GRID live in UIStateStore and are re-read from it
// on every repaint, so there is no copy to go stale. WIREFRAME and CULLING live
// on RenderPipelinePanel, which this class cannot see, so those two are mirrored
// into fields — written only by syncPipeline, which Main raises from
// syncPipelineReadouts, and never written by a click. A click on either goes back
// through the panel and returns as a push.
//
// The mirror is the compromise, not the design: the same switches appear as full
// ON/OFF rows in the RENDER and WORLD tabs, and a second *source of truth* is how
// the two ends of a toggle end up disagreeing. A cache that only one call site
// can write is not that.

import DOMScope from "@ui/DOMScope";
import { DEFAULT_FLOOR, DEFAULT_GRID, DEFAULT_SKY, WORLD_LAYER_HINT_TEXT } from "@ui/inspector/EnvironmentSection";

import type UIStateStore from "@ui/UIStateStore";

// Not the WORLD tab's own hint node, even though it carries the same sentence
// about the same boolean. That one lives inside #panelWorld, which is
// display:none on every other tab, and a display:none subtree is dropped from
// the accessibility tree — so the description would resolve only while the tab
// that does not contain this pill happens to be open. This node sits with the
// viewport's other hints, where neither breakpoint hides it.
const HINT_ID = "ph-quick-grid";

// Fixed by the design, and the order is part of it: the three world layers, then
// the two rasteriser switches.
const LABELS = ["SKY", "FLOOR", "GRID", "WIRE", "CULL"] as const;

type QuickToggleKey = (typeof LABELS)[number];

export interface QuickTogglesOptions {
  mounts: string[];
  store: UIStateStore;
  wireframe: boolean;
  cullBackfaces: boolean;
  // Raised after a world layer is written, so the owner can re-read the store
  // and push the result to the renderer and to the WORLD tab's rows at once.
  onLayersChange: () => void;
  onWireframeToggle: (next: boolean) => void;
  onCullToggle: (next: boolean) => void;
}

class QuickToggles {
  private readonly store: UIStateStore;
  private readonly apply: QuickTogglesOptions;
  // One key, every button that shows it — two today, one per branch mount. The
  // sets are painted together, so a flip is never visible on one branch only.
  private readonly buttons: Map<QuickToggleKey, HTMLButtonElement[]>;
  private wireframe: boolean;
  private cullBackfaces: boolean;

  constructor(options: QuickTogglesOptions) {
    this.store = options.store;
    this.apply = options;
    this.buttons = new Map();
    this.wireframe = options.wireframe;
    this.cullBackfaces = options.cullBackfaces;

    LABELS.forEach((key) => {
      this.buttons.set(key, []);
    });

    const scope = new DOMScope(document);

    options.mounts.forEach((selector) => {
      const mount = scope.require<HTMLElement>(selector, `Quick toggles mount ${selector} is missing.`);
      mount.replaceChildren(...LABELS.map((key) => this.buildButton(key)));
    });

    this.paint();
  }

  // The three world layers, read back from the store. Called by the owner after
  // anything writes them — this component's own click, the WORLD tab's rows, or
  // RESET restoring the slice.
  public syncFromStore() {
    this.paint();
  }

  // The two rasteriser switches, and the only writer of the two mirrored fields.
  // RenderPipelinePanel owns those booleans, not the store, so they arrive the
  // same way the RENDER tab's rows get them: pushed by Main on every pipeline
  // change.
  public syncPipeline(wireframe: boolean, cullBackfaces: boolean) {
    this.wireframe = wireframe;
    this.cullBackfaces = cullBackfaces;
    this.paint();
  }

  private buildButton(key: QuickToggleKey): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "quick-toggle";
    button.textContent = key;
    button.dataset.quickToggle = key;

    // GRID alone: nothing in the renderer draws a grid, so the pill remembers
    // the choice and changes nothing. The sentence is the WORLD tab's, imported
    // rather than retyped; only the node it points at is this widget's own.
    if (key === "GRID") {
      button.dataset.placeholder = "true";
      button.title = WORLD_LAYER_HINT_TEXT;
      button.setAttribute("aria-describedby", HINT_ID);
    }

    button.addEventListener("click", () => this.flip(key));
    this.buttons.get(key)?.push(button);

    return button;
  }

  private flip(key: QuickToggleKey) {
    const next = !this.isOn(key);

    // WIRE and CULL do not touch the store: they go back through the panel that
    // owns them, so a flip from a pill runs the identical path the RENDER tab's
    // row runs — including the opacity reset that switching culling on carries.
    if (key === "WIRE") {
      this.apply.onWireframeToggle(next);
      return;
    }

    if (key === "CULL") {
      this.apply.onCullToggle(next);
      return;
    }

    if (key === "SKY") {
      this.store.setState({ sky: next });
    } else if (key === "FLOOR") {
      this.store.setState({ floor: next });
    } else {
      this.store.setState({ grid: next });
    }

    this.apply.onLayersChange();
  }

  private isOn(key: QuickToggleKey): boolean {
    if (key === "WIRE") {
      return this.wireframe;
    }

    if (key === "CULL") {
      return this.cullBackfaces;
    }

    const state = this.store.getState();

    if (key === "SKY") {
      return state.sky ?? DEFAULT_SKY;
    }

    if (key === "FLOOR") {
      return state.floor ?? DEFAULT_FLOOR;
    }

    return state.grid ?? DEFAULT_GRID;
  }

  private paint() {
    this.buttons.forEach((buttons, key) => {
      const on = this.isOn(key);

      buttons.forEach((button) => {
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-pressed", String(on));
      });
    });
  }
}

export default QuickToggles;
