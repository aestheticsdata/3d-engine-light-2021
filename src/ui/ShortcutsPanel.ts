// Documentation for controls that are not reachable yet, in the form each
// branch can act on: a strip of keyboard chips pinned to the bottom of the right
// panel on desktop, and a GESTURES card in the SCENE tab on mobile.
//
// The two are not the same content translated. A phone has no keyboard, so
// eight key hints there would be pure noise; what a touch user can act on is
// drag, pinch and double-tap, plus a line pointing at the tabs that hold the
// rest. The mockup has no mobile branch for this widget at all — the card is
// this ticket's own answer to that gap.
//
// Neither branch hardcodes a key or a gesture: both render from shortcuts.ts,
// which the de-mock keyboard ticket will read as well.

import DOMScope from "@ui/DOMScope";
import { GESTURES, PRIMITIVE_COUNT, SHORTCUTS } from "@ui/shortcuts";

import type { ShortcutBinding } from "@ui/shortcuts";

const HINT_ID = "ph-shortcut-grid";
const HINT_TEXT = "Grid is not drawn yet — ships with the ground-grid work.";

// The four bindings with no gesture equivalent, rewritten as a place to go
// rather than a key to press. The count is the registry's, not the digit row's:
// the line is about what the SHAPE tab holds, not about what a keystroke reaches.
const POINTER_LINE = `${PRIMITIVE_COUNT} primitives in the SHAPE tab · sky, floor, grid in the WORLD tab`;
const PENDING_NOTE = "Gestures ship with pointer camera control.";

export interface ShortcutsPanelOptions {
  chipsSelector: string;
  gesturesSelector: string;
}

class ShortcutsPanel {
  private readonly chipRoot: HTMLElement;
  private readonly gestureRoot: HTMLElement;

  constructor(options: ShortcutsPanelOptions) {
    const scope = new DOMScope(document);

    this.chipRoot = scope.require<HTMLElement>(options.chipsSelector, "Shortcuts strip is missing.");
    this.gestureRoot = scope.require<HTMLElement>(options.gesturesSelector, "GESTURES card body is missing.");

    this.paintChips();
    this.paintGestures();
  }

  private paintChips() {
    const title = document.createElement("span");
    title.className = "shortcuts__title";
    title.textContent = "SHORTCUTS";

    const row = document.createElement("div");
    row.className = "shortcuts__row";
    row.append(...SHORTCUTS.map((binding) => this.buildChip(binding)));

    this.chipRoot.append(title, row, this.buildHint());
  }

  // The design writes each chip as a single text node, so the 5px inner gap it
  // declares never renders. Splitting the key from the action is what makes the
  // gap real — and <kbd> is the element that says "this is a key" without a
  // second class doing it in prose.
  private buildChip(binding: ShortcutBinding): HTMLElement {
    const chip = document.createElement("span");
    chip.className = "pill shortcuts__chip";

    const key = document.createElement("kbd");
    key.className = "shortcuts__key";
    key.textContent = binding.keyLabel;

    const action = document.createElement("span");
    action.className = "shortcuts__action";
    action.textContent = binding.action;

    chip.append(key, action);

    // Only the pending-feature binding. The other seven have a working action
    // behind them and are waiting on a listener, which is not something to dim:
    // the affordance says "unbuilt", and saying it about a feature that works
    // would be the same lie in the other direction.
    if (binding.status === "pendingFeature") {
      chip.dataset.placeholder = "true";
      chip.title = HINT_TEXT;
      chip.setAttribute("aria-describedby", HINT_ID);
    }

    return chip;
  }

  private paintGestures() {
    const rows = GESTURES.map((binding) => {
      const row = document.createElement("div");
      row.className = "gestures__row";

      const gesture = document.createElement("span");
      gesture.className = "gestures__gesture";
      gesture.textContent = binding.gesture;

      const effect = document.createElement("span");
      effect.className = "gestures__effect";
      effect.textContent = binding.effect;

      row.append(gesture, effect);

      return row;
    });

    // One note for the whole card rather than a placeholder affordance per row:
    // all three gestures are pending for the same reason, and dimming each of
    // them would dim the card entire, which reads as disabled rather than as
    // documentation.
    this.gestureRoot.append(...rows, this.buildNote(POINTER_LINE), this.buildNote(PENDING_NOTE));
  }

  private buildNote(text: string): HTMLElement {
    const note = document.createElement("span");

    note.className = "gestures__note";
    note.textContent = text;

    return note;
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");

    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = HINT_TEXT;

    return hint;
  }
}

export default ShortcutsPanel;
