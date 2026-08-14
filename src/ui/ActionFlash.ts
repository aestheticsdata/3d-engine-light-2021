// A button that briefly says what just happened, then goes back to saying what
// it does.
//
// The console has no notification surface — no toast, no status line the design
// gives to transient messages — and E8b's three fallible actions need one:
// CAPTURE PNG can be handed a null blob, LOAD can be handed a file that is not a
// preset, and COPY CODE can have its clipboard write rejected outright. This is
// a rebuild addition rather than something the design draws, which is why it is
// recorded here: there is no button state in the mockup at all.
//
// Nodes are resolved by [data-action] rather than handed in, the same "one
// selector, every mount" shape FieldWriter and ActionRegistry already use. The
// four buttons have a single mount today; binding by action id is what stops
// that being a fact this class knows.

import type { ActionId } from "@ui/ActionRegistry";

// Long enough to read, short enough that the button is back to its own label
// before anyone reaches for it again.
const FLASH_DURATION_MS = 1200;

interface PendingFlash {
  label: string;
  timer: number;
}

class ActionFlash {
  // Keyed by node, holding the label to put BACK. Re-flashing a button whose
  // flash is still running must not record "FAILED" as the label to restore,
  // which is what a naive read of textContent at flash time would do.
  private readonly pending: Map<HTMLElement, PendingFlash>;

  constructor() {
    this.pending = new Map();
  }

  public flash(id: ActionId, message: string) {
    for (const node of document.querySelectorAll<HTMLElement>(`[data-action="${id}"]`)) {
      this.flashNode(node, message);
    }
  }

  public dispose() {
    for (const [node, entry] of this.pending) {
      clearTimeout(entry.timer);
      node.textContent = entry.label;
    }

    this.pending.clear();
  }

  private flashNode(node: HTMLElement, message: string) {
    const running = this.pending.get(node);
    // textContent, never innerHTML: COPY CODE's label is the escaped `</> COPY
    // CODE`, and restoring it through markup would parse those characters as a
    // tag the second time around.
    const label = running ? running.label : (node.textContent ?? "");

    if (running) {
      clearTimeout(running.timer);
    }

    node.textContent = message;
    this.pending.set(node, {
      label,
      timer: window.setTimeout(() => {
        node.textContent = label;
        this.pending.delete(node);
      }, FLASH_DURATION_MS),
    });
  }
}

export default ActionFlash;
