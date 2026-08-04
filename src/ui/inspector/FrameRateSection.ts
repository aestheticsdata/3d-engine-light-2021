// RENDER LOOP: the cap on how often the loop renders.
//
// NEW — no design equivalent, and not a restoration either. The mockup draws a
// `RENDER LOOP 61 fps` readout with no control beside it, and the pre-refonte
// app had a bare requestAnimationFrame with no throttle anywhere in its history.
// Both the placement and the control shape are this section's decisions.
//
// Chips rather than a slider: the cap has three values anyone wants, and a range
// input would invite 47fps and need a value column to explain itself.
//
// The section hands out the resolved rate, never the chip id. RenderLoop takes
// milliseconds and the framerate card takes a target; if either of them had to
// know that the string "MAX" means uncapped, there would be three places that
// agree by convention instead of one that maps.

import ChipGrid from "@ui/inspector/controls/ChipGrid";

import type { ChipDescriptor } from "@ui/inspector/controls/ChipGrid";
import type UIStateStore from "@ui/UIStateStore";
import type { FrameRateCapKey } from "@ui/UIStateStore";

// MAX, which is also what RenderLoop opens at, so boot needs no push to make the
// chip and the loop agree.
export const DEFAULT_FRAME_RATE_CAP: FrameRateCapKey = "MAX";

const CAP_FPS: Record<FrameRateCapKey, number | null> = {
  "30": 30,
  "60": 60,
  MAX: null,
};

const CHIPS: ChipDescriptor[] = [
  { id: "30", label: "30" },
  { id: "60", label: "60" },
  { id: "MAX", label: "MAX" },
];

export interface FrameRateSectionOptions {
  chipGridSelector: string;
  store: UIStateStore;
  onSelect: (fps: number | null) => void;
}

class FrameRateSection {
  private readonly store: UIStateStore;
  private readonly chips: ChipGrid;
  private readonly onSelect: (fps: number | null) => void;

  constructor(options: FrameRateSectionOptions) {
    this.store = options.store;
    this.onSelect = options.onSelect;
    this.store.registerSlice({ frameRateCap: DEFAULT_FRAME_RATE_CAP });

    this.chips = new ChipGrid({
      selector: options.chipGridSelector,
      modifier: "chip--mode",
      columns: 3,
      onPick: this.pick,
    });
    this.chips.setChips(CHIPS);
    this.chips.setActive(DEFAULT_FRAME_RATE_CAP);
  }

  // Lights the chip AND pushes the rate, the same way TransformSection's does:
  // this is the RESET path, and a reset that moved the chip back to MAX without
  // uncapping the loop would leave the two disagreeing until the next click.
  public syncFromStore() {
    this.apply(this.store.getState().frameRateCap ?? DEFAULT_FRAME_RATE_CAP);
  }

  private pick = (id: string) => {
    this.apply(id as FrameRateCapKey);
  };

  private apply(cap: FrameRateCapKey) {
    this.chips.setActive(cap);
    this.store.setState({ frameRateCap: cap });
    this.onSelect(CAP_FPS[cap]);
  }
}

export default FrameRateSection;
