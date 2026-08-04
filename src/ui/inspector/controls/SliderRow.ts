// One labelled range input with a formatted read-out.
//
// One markup shape serves both branches: a head line carrying the label and the
// value, then the input. On desktop slider.css lays that out as a row — label
// column, track, value column — and on mobile it restacks the head above a
// full-width track. Neither arrangement needs a second DOM, which is why the
// head element exists on desktop too even though it looks like a wrapper doing
// nothing there.
//
// The row owns its formatting because the number beside a slider is part of the
// control, not telemetry: SPIN reads `1.0/s`, SCALE reads `1.00x`, the rates
// read a bare signed integer. Callers pass a format hook rather than a unit
// string, since two of the five divide before they print.

export interface SliderRowOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  format: (value: number) => string;
  onInput: (value: number) => void;
  // Set when the control has no engine behind it. The row still moves and still
  // stores its value; it simply changes nothing on the canvas.
  placeholder?: { title: string; describedBy: string };
  // The opacity row hands its own id over, because RenderPipelinePanel resolves
  // that element by id to own `disabled` and the follow-cursor tooltip.
  inputId?: string;
}

class SliderRow {
  private readonly root: HTMLLabelElement;
  private readonly input: HTMLInputElement;
  private readonly valueNode: HTMLElement;
  private readonly labelNode: HTMLElement;
  private readonly format: (value: number) => string;

  constructor(options: SliderRowOptions) {
    this.format = options.format;

    this.root = document.createElement("label");
    this.root.className = "slider-row";

    const head = document.createElement("span");
    head.className = "slider-row__head";

    this.labelNode = document.createElement("span");
    this.labelNode.className = "slider-row__label";
    this.labelNode.textContent = options.label;

    this.valueNode = document.createElement("span");
    this.valueNode.className = "slider-row__value";

    this.input = document.createElement("input");
    this.input.type = "range";
    this.input.min = String(options.min);
    this.input.max = String(options.max);
    this.input.value = String(options.value);

    if (options.inputId) {
      this.input.id = options.inputId;
      this.root.htmlFor = options.inputId;
    }

    if (options.placeholder) {
      this.input.dataset.placeholder = "true";
      this.input.title = options.placeholder.title;
      this.input.setAttribute("aria-describedby", options.placeholder.describedBy);
    }

    head.append(this.labelNode, this.valueNode);
    this.root.append(head, this.input);

    // `input`, not `change`: a range fires `change` only on release, which would
    // make the read-out lag the thumb by the length of the drag.
    this.input.addEventListener("input", () => {
      const value = Number.parseInt(this.input.value, 10);
      this.writeValue(value);
      options.onInput(value);
    });

    this.writeValue(options.value);
  }

  public get element(): HTMLElement {
    return this.root;
  }

  public get inputElement(): HTMLInputElement {
    return this.input;
  }

  // Used by RESET, which writes the store's defaults back through the rows
  // rather than rebuilding them.
  public setValue(value: number) {
    this.input.value = String(value);
    this.writeValue(value);
  }

  // slider.css already paints the disabled track and thumb. What it cannot
  // reach is the row's own label and value, which otherwise stay at full
  // contrast beside a control that cannot be moved.
  public setDisabled(disabled: boolean) {
    this.input.disabled = disabled;
    this.input.setAttribute("aria-disabled", String(disabled));
    this.root.classList.toggle("is-disabled", disabled);
  }

  private writeValue(value: number) {
    this.valueNode.textContent = this.format(value);
  }
}

export default SliderRow;
