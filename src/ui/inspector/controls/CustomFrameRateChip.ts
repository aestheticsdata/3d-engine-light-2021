// The RENDER LOOP panel's fourth chip: a number input for an arbitrary fps
// cap, sitting beside 30/60/MAX rather than replacing any of them.
//
// A plain <input type="number"> wearing .chip rather than a bespoke control:
// FrameRateSection already resolves chip ids to fps and republishes through
// the same onSelect the three fixed chips use, so this only has to look like
// a chip and hand back a number — everything downstream is unchanged.
//
// Commits on Enter or blur, never per keystroke: re-capping mid-type (1, then
// 10, then 100 while typing "100") would settle the loop on a rate the user
// never asked for if they stopped watching before the last digit landed.

import DOMScope from "@ui/DOMScope";
import {
  MAX_CUSTOM_FRAME_RATE_FPS,
  MIN_CUSTOM_FRAME_RATE_FPS,
  parseCustomFrameRate,
} from "@ui/inspector/controls/customFrameRate";

export interface CustomFrameRateChipOptions {
  selector: string;
  onCommit: (fps: number | null) => void;
}

class CustomFrameRateChip {
  private readonly input: HTMLInputElement;
  private readonly onCommit: (fps: number | null) => void;

  constructor(options: CustomFrameRateChipOptions) {
    const scope = new DOMScope(document);
    const root = scope.require<HTMLElement>(options.selector, "Custom frame rate mount is missing.");

    this.onCommit = options.onCommit;
    this.input = this.buildInput();
    root.appendChild(this.input);
  }

  // Idempotent, matching ChipGrid.setActive: FrameRateSection calls this on
  // every store sync, not only on a genuine custom pick.
  public setActive(fps: number) {
    this.input.value = String(fps);
    this.input.classList.add("is-active");
  }

  public clear() {
    this.input.value = "";
    this.input.classList.remove("is-active");
  }

  private buildInput(): HTMLInputElement {
    const input = document.createElement("input");

    input.type = "number";
    input.className = "chip chip--mode chip--input";
    input.min = String(MIN_CUSTOM_FRAME_RATE_FPS);
    input.max = String(MAX_CUSTOM_FRAME_RATE_FPS);
    input.placeholder = "fps";
    input.setAttribute("aria-label", "Custom frame rate cap, in frames per second");

    const commit = () => this.onCommit(parseCustomFrameRate(input.value));

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      input.blur();
    });

    return input;
  }
}

export default CustomFrameRateChip;
