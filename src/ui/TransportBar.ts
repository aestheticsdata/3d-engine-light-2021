// The transport: the play/pause mounts, the RESET mounts and the REC dot.
//
// Each of those controls has two mounts — the desktop strip and the mobile
// header / RESET SCENE bar — because there is one DOM tree and no control can be
// in two parents at once. Binding by attribute rather than by id keeps that one
// handler and no second code path, which is also why this class holds node
// lists rather than elements.

import DOMScope from "@ui/DOMScope";

const TOGGLE_MOUNTS = "[data-transport='toggle']";
const RESET_MOUNTS = "[data-action='reset']";
const RUN_STATE_DOTS = ".readout__dot";

class TransportBar {
  private readonly toggleMounts: NodeListOf<HTMLElement>;
  private readonly resetMounts: NodeListOf<HTMLElement>;
  private readonly runStateDots: NodeListOf<HTMLElement>;

  constructor() {
    // Resolved and thrown away on purpose. #playPause is never read — the
    // transport binds by attribute, and both mounts carry the attribute — but a
    // missing one is a shell contract violation
    // (notes/ui-refonte/ui/03-shell.md:82), and dropping the check would turn a
    // broken skeleton into a console with no transport and no error.
    new DOMScope(document).require("#playPause", "Transport is missing.");

    this.toggleMounts = document.querySelectorAll<HTMLElement>(TOGGLE_MOUNTS);
    this.resetMounts = document.querySelectorAll<HTMLElement>(RESET_MOUNTS);
    this.runStateDots = document.querySelectorAll<HTMLElement>(RUN_STATE_DOTS);
  }

  public bindToggle(handler: () => void) {
    this.toggleMounts.forEach((node) => {
      node.addEventListener("click", handler);
    });
  }

  public bindReset(handler: () => void) {
    this.resetMounts.forEach((node) => {
      node.addEventListener("click", handler);
    });
  }

  public setRunState(isPlaying: boolean) {
    const label = isPlaying ? "PAUSE" : "RESUME";

    this.toggleMounts.forEach((node) => {
      node.textContent = label;
    });

    // The REC dot claims a running render loop; freeze and dim it when there
    // isn't one.
    this.runStateDots.forEach((node) => {
      node.classList.toggle("is-paused", !isPlaying);
    });
  }
}

export default TransportBar;
