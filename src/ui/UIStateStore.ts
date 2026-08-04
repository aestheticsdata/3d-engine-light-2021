// The shared store for UI values that have no engine home yet.
//
// Shipped deliberately empty. Each widget ticket adds one slice for the values
// it owns — shading mode, texture, base colour, UV scale, scale, the four
// lighting values, fog, grid step, projection, sky / floor / grid / shadow,
// dropped frames — by extending UIState and registering its defaults.
//
// THE CONTRACT: a slice is only complete when the toolbar's RESET path restores
// it. Adding a value here without adding it to RESET leaves the console with a
// control that RESET silently ignores, which is the bug this store exists to
// prevent.
//
// Consumers subscribe rather than keeping private copies — the quick toggles
// and the scene graph both read state the inspector owns, and a second copy is
// how the two ends of a toggle end up disagreeing.
//
// Two behaviours here are load-bearing and easy to tidy into a bug. registerSlice
// writes the slice into BOTH defaults and state before notifying, which is what
// makes RESET coverage automatic. resetAll notifies ONCE for the whole console
// rather than once per slice, so the panels repaint in a single pass. Both are
// pinned by src/ui/__tests__/UIStateStore.test.ts.

import type { ShadingModeKey } from "@ui/modeLabel";

export interface UIState {
  // Slices are added here by the ticket that owns each value.

  // --- scene graph ---------------------------------------------------------
  // Keyed by the stable row id, never by the displayed name: the mesh row's
  // label changes with every primitive, so selecting by what it says would
  // drop the selection on each shape change.
  sceneSelection?: string;
  sceneHidden?: readonly string[];
  // The drawn count (D6) — what Surface3D.render returns, not the registry
  // count. Published by Main on the existing 90ms display throttle; the scene
  // graph subscribes rather than reading the renderer itself, so there is one
  // number behind the row, the toolbar and the telemetry card.
  drawnTriangles?: number;

  // --- SHAPE tab -----------------------------------------------------------
  // UI-space rotation rates, signed -100..100 with a real zero. The engine's
  // own values are off-centre and differ per axis; rotationRates.ts is the only
  // place that knows the mapping. Registered by TransformSection.
  pitchRate?: number;
  yawRate?: number;
  rollRate?: number;
  spin?: number;
  // No engine behind these four yet (de-mock E4). They are stored rather than
  // discarded so the console remembers the choice and RESET can undo it.
  zoom?: number;
  scale?: number;
  texture?: string;
  baseColor?: string;
  uvScale?: number;

  // --- RENDER tab -----------------------------------------------------------
  // zbuffer / dither / edgeAA and the four light* values are de-mock E3
  // placeholders, same as SHAPE tab's zoom/scale/texture/baseColor/uvScale
  // above: no engine sits behind any of them yet, and they are stored only so
  // RESET can undo the choice. shadingMode is different — it is chip-selection
  // state that deliberately does NOT feed modeLabel(). The status bar, the HUD
  // and SHAPE INFO describe what the rasteriser actually does, and printing
  // GOURAUD there would be the same lie a CSS filter would have been. Do not
  // wire this field into modeLabel() to make the chip "real" — that is not a
  // fix, it is de-mock E3's job.
  shadingMode?: ShadingModeKey;
  zbuffer?: boolean;
  dither?: boolean;
  edgeAA?: boolean;
  lightAzimuth?: number;
  lightElevation?: number;
  lightAmbient?: number;
  lightSpecular?: number;
}

// Optional above, and guaranteed below: every field is filled by the owning
// widget's registerSlice() call at import time. They are declared optional
// because the store starts empty and slices arrive as their modules load —
// consumers still read through a fallback rather than assuming load order.

// Exported because subscribe's callers have to be able to name the shape they
// must satisfy; the module form kept this private and left them guessing.
export type Listener = (state: Readonly<UIState>) => void;

class UIStateStore {
  private readonly state: UIState;
  private readonly listeners: Set<Listener>;
  private readonly defaults: Partial<UIState>;

  constructor() {
    this.state = {};
    this.listeners = new Set();
    this.defaults = {};
  }

  public getState(): Readonly<UIState> {
    return this.state;
  }

  public setState(patch: Partial<UIState>) {
    Object.assign(this.state, patch);
    this.notify();
  }

  // Declares a slice together with the values RESET must restore it to. Calling
  // this at the declaration site is what makes RESET coverage automatic: a
  // ticket that adds a slice gets it restored without anyone editing the reset
  // handler, which is the failure mode this registry exists to prevent.
  public registerSlice(slice: Partial<UIState>) {
    Object.assign(this.defaults, slice);
    Object.assign(this.state, slice);
    this.notify();
  }

  // Restores every registered default and notifies once, so the whole console
  // repaints in a single pass rather than once per slice.
  public resetAll() {
    Object.assign(this.state, this.defaults);
    this.notify();
  }

  // Returns the unsubscribe function.
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  // Iterating the live Set is deliberate: a listener that subscribes from
  // inside a notification is reached in that same pass, and a setState raised
  // from inside one runs its pass immediately. Main's mesh-hidden change
  // detector (src/app/Main.ts) is shaped around both. Spreading the Set into an
  // array first looks like tidying and silently changes them.
  private notify() {
    this.listeners.forEach((listener) => {
      listener(this.state);
    });
  }
}

export default UIStateStore;
