// RENDER LOOP: the cap on how often the loop renders.
//
// NEW — no design equivalent, and not a restoration either. The mockup draws a
// `RENDER LOOP 61 fps` readout with no control beside it, and the pre-refonte
// app had a bare requestAnimationFrame with no throttle anywhere in its history.
// Both the placement and the control shape are this section's decisions.
//
// Chips rather than a slider: the cap has three values anyone wants, and a range
// input would invite 47fps and need a value column to explain itself. CUSTOM is
// the fourth slot for exactly that case — a number input beside the three chips
// rather than a slider replacing them.
//
// The section hands out the resolved rate, never the chip id. RenderLoop takes
// milliseconds and the framerate card takes a target; if either of them had to
// know that the string "MAX" means uncapped, there would be three places that
// agree by convention instead of one that maps.

import ChipGrid from "@ui/inspector/controls/ChipGrid";
import CustomFrameRateChip from "@ui/inspector/controls/CustomFrameRateChip";
import { MAX_CUSTOM_FRAME_RATE_FPS, MIN_CUSTOM_FRAME_RATE_FPS } from "@ui/inspector/controls/customFrameRate";

import type { ChipDescriptor } from "@ui/inspector/controls/ChipGrid";
import type UIStateStore from "@ui/UIStateStore";
import type { FrameRateCapKey } from "@ui/UIStateStore";

// MAX, which is also what RenderLoop opens at, so boot needs no push to make the
// chip and the loop agree.
export const DEFAULT_FRAME_RATE_CAP: FrameRateCapKey = "MAX";
// Only shown once the user actually commits a custom value while the cap is
// something else; RESET always lands back on MAX, which clears the input, so
// this default never has to be a value anyone would actually pick.
export const DEFAULT_CUSTOM_FRAME_RATE_FPS = 90;

// Only the three fixed chips resolve through a table — CUSTOM's rate is
// whatever the user typed, held in the store instead.
type FixedCapKey = "30" | "60" | "MAX";

const CAP_FPS: Record<FixedCapKey, number | null> = {
  "30": 30,
  "60": 60,
  MAX: null,
};

const CHIPS: ChipDescriptor[] = [
  { id: "30", label: "30" },
  { id: "60", label: "60" },
  { id: "MAX", label: "MAX" },
];

// The same default, narrowed: DEFAULT_FRAME_RATE_CAP is typed as the store's
// four-valued key because that is what it is stored as, and the fallback below
// has to be one of the three the table actually resolves.
const FALLBACK_CAP: FixedCapKey = "MAX";

// The custom input's own clamp, reused rather than restated — the field and a
// preset file are two ways of writing the same value, and only one of them went
// through CustomFrameRateChip.
const clampCustomFrameRate = (fps: number): number =>
  Math.min(MAX_CUSTOM_FRAME_RATE_FPS, Math.max(MIN_CUSTOM_FRAME_RATE_FPS, Math.round(fps)));

export interface FrameRateSectionOptions {
  chipGridSelector: string;
  store: UIStateStore;
  onSelect: (fps: number | null) => void;
}

class FrameRateSection {
  private readonly store: UIStateStore;
  private readonly chips: ChipGrid;
  private readonly customChip: CustomFrameRateChip;
  private readonly onSelect: (fps: number | null) => void;

  constructor(options: FrameRateSectionOptions) {
    this.store = options.store;
    this.onSelect = options.onSelect;
    this.store.registerSlice({
      frameRateCap: DEFAULT_FRAME_RATE_CAP,
      customFrameRateFps: DEFAULT_CUSTOM_FRAME_RATE_FPS,
    });

    this.chips = new ChipGrid({
      selector: options.chipGridSelector,
      modifier: "chip--mode",
      columns: 4,
      onPick: this.pick,
    });
    this.chips.setChips(CHIPS);

    // Built after setChips: ChipGrid.setChips replaces the grid's children,
    // so a custom chip mounted first would be wiped out by it.
    this.customChip = new CustomFrameRateChip({
      selector: options.chipGridSelector,
      onCommit: this.commitCustom,
    });

    this.chips.setActive(DEFAULT_FRAME_RATE_CAP);
  }

  // Lights whichever chip (or the custom input) is stored, and pushes the
  // rate, the same way TransformSection's does: this is the RESET path, and a
  // reset that moved the chip back to MAX without uncapping the loop would
  // leave the two disagreeing until the next click.
  //
  // Both branches guard the stored value rather than trusting it. Until E8b the
  // only writers were this section's own two handlers, so the store could only
  // hold a key from CHIPS and a rate the input had already clamped; a preset
  // file can now write either directly, and both have a way of breaking the loop
  // for the rest of the session rather than for one frame — an unknown key makes
  // CAP_FPS[cap] undefined, and RenderLoop turns that into a NaN frame interval
  // no later valid pick recovers from. Correcting through applyChip / applyCustom
  // also writes the corrected value back, so the store stops holding it.
  public syncFromStore() {
    const state = this.store.getState();
    const cap = state.frameRateCap ?? DEFAULT_FRAME_RATE_CAP;

    if (cap === "CUSTOM") {
      this.applyCustom(clampCustomFrameRate(state.customFrameRateFps ?? DEFAULT_CUSTOM_FRAME_RATE_FPS));
      return;
    }

    this.applyChip(cap in CAP_FPS ? (cap as FixedCapKey) : FALLBACK_CAP);
  }

  private pick = (id: string) => {
    this.applyChip(id as FixedCapKey);
  };

  // null means the commit was empty or non-numeric — re-reading the store
  // rather than tracking a separate "previous cap" field redisplays exactly
  // whatever was last actually applied, chip or custom alike, with no state
  // change of its own.
  private commitCustom = (fps: number | null) => {
    if (fps === null) {
      this.syncFromStore();
      return;
    }

    this.applyCustom(fps);
  };

  private applyChip(cap: FixedCapKey) {
    this.chips.setActive(cap);
    this.customChip.clear();
    this.store.setState({ frameRateCap: cap });
    this.onSelect(CAP_FPS[cap]);
  }

  private applyCustom(fps: number) {
    this.chips.setActive(null);
    this.customChip.setActive(fps);
    this.store.setState({ frameRateCap: "CUSTOM", customFrameRateFps: fps });
    this.onSelect(fps);
  }
}

export default FrameRateSection;
