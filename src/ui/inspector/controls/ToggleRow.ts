// One labelled ON/OFF segmented control: a row with a label on the left and
// the two-half switch on the right.
//
// The control paints both halves at all times and only swaps which one is
// lit — toggle.css's job — so this class owns no colour, just the markup,
// the role="switch" semantics and the click binding. A factory rather than
// static per-instance HTML because the RENDER tab alone needs five of these
// and the WORLD tab will need more, the same reason ChipGrid replaced a
// fixed option list.

export interface ToggleRowOptions {
  label: string;
  on: boolean;
  onToggle: (next: boolean) => void;
  placeholder?: { title: string; describedBy: string };
}

class ToggleRow {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly onToggle: (next: boolean) => void;
  private isOn: boolean;

  constructor(options: ToggleRowOptions) {
    this.onToggle = options.onToggle;
    this.isOn = options.on;

    this.root = document.createElement("div");
    this.root.className = "toggle-row";

    const label = document.createElement("span");
    label.className = "toggle-row__label";
    label.textContent = options.label;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "toggle";
    this.button.setAttribute("role", "switch");
    // The accessible name has to come from the option rather than the button's
    // own contents: the contents are the two painted state words "ON" and
    // "OFF", the same on every row, so an unlabelled switch would announce as
    // "ON OFF" regardless of which row it is.
    this.button.setAttribute("aria-label", options.label);

    const onHalf = document.createElement("span");
    onHalf.className = "toggle__half toggle__half--on";
    onHalf.textContent = "ON";

    const offHalf = document.createElement("span");
    offHalf.className = "toggle__half toggle__half--off";
    offHalf.textContent = "OFF";

    this.button.append(onHalf, offHalf);

    if (options.placeholder) {
      this.button.dataset.placeholder = "true";
      this.button.title = options.placeholder.title;
      this.button.setAttribute("aria-describedby", options.placeholder.describedBy);
    }

    this.root.append(label, this.button);

    // Bound to the row, not the button, at both breakpoints: the painted control
    // is far smaller than its row, and mobile needs the full 48px height as a
    // touch target. Binding unconditionally keeps one code path rather than a
    // second listener for desktop, where it only widens an already-generous
    // target. A click on the inner button bubbles up to this one listener, so
    // it still fires exactly once.
    this.root.addEventListener("click", () => {
      this.setOn(!this.isOn);
      this.onToggle(this.isOn);
    });

    this.paint();
  }

  public get element(): HTMLElement {
    return this.root;
  }

  public setOn(next: boolean) {
    this.isOn = next;
    this.paint();
  }

  private paint() {
    this.button.classList.toggle("is-on", this.isOn);
    this.button.setAttribute("aria-checked", String(this.isOn));
  }
}

export default ToggleRow;
