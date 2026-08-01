// The six range inputs, enumerated once.
//
// Attaching the listeners, writing the defaults and reading the values back used
// to be three methods that each spelled out all six selectors — eighteen
// mentions of six elements, so a seventh slider meant three edits in three
// places and a missed one was a control that half worked. One table, three
// passes over it.
//
// Tolerant of a missing element on every path, and that is inherited behaviour
// rather than caution: the console is one DOM tree serving two responsive
// branches, and the class this replaces returned silently when a selector
// resolved to nothing. A constructor that threw would turn a partially rendered
// skeleton into a boot failure. The one exception is the opacity slider, which
// the shell contract has always required — RenderPipelinePanel enforces that,
// not this class.

// The selectors, exported because the render pipeline resolves the opacity
// slider too — it owns `disabled` and the tooltip on that element while the bank
// owns its value. Two owners for two aspects of one node, but only one place
// that spells the id.
export const ZOOM_SLIDER = "#zoomSlider";
export const PITCH_SLIDER = "#pitchSlider";
export const YAW_SLIDER = "#yawSlider";
export const ROLL_SLIDER = "#rollSlider";
export const OPACITY_SLIDER = "#opacitySlider";
export const ROTATION_SPEED_SLIDER = "#rotationSpeedSlider";

export interface SliderBinding {
  selector: string;
  defaultValue: number;
  apply: (value: number) => void;
}

export interface SliderBankOptions {
  bindings: SliderBinding[];
}

class SliderBank {
  private readonly bindings: SliderBinding[];
  private readonly elements: Map<string, HTMLInputElement>;

  constructor(options: SliderBankOptions) {
    this.bindings = options.bindings;
    this.elements = new Map();

    this.bindings.forEach((binding) => {
      const element = document.querySelector<HTMLInputElement>(
        binding.selector,
      );

      if (element) {
        this.elements.set(binding.selector, element);
      }
    });
  }

  // A range fires `input` while the thumb moves and `change` only when it is
  // released, so the event name follows the element type: anything that is not a
  // range would otherwise drive the engine once, on mouse-up.
  //
  // The callback is wrapped in this arrow rather than handed to
  // addEventListener directly, so a binding's `apply` never has to know it was
  // called from an event.
  public attach() {
    this.bindings.forEach((binding) => {
      const element = this.elements.get(binding.selector);

      if (!element) {
        return;
      }

      const eventName = element.type === "range" ? "input" : "change";
      element.addEventListener(eventName, (event) => {
        binding.apply(
          parseInt((event.currentTarget as HTMLInputElement).value, 10),
        );
      });
    });
  }

  // Writes the value and nothing else. Dispatching a synthetic `input` here
  // would look tidier and would be wrong twice over: at boot the defaults are
  // written before attach(), so the events would fire handlers that are not
  // listening yet, and on RESET they are written while the handlers ARE
  // listening and syncFromDom() already pushes every value — so each one would
  // run twice.
  public applyDefaults() {
    this.bindings.forEach((binding) => {
      const element = this.elements.get(binding.selector);

      if (element) {
        element.value = String(binding.defaultValue);
      }
    });
  }

  // Reads every slider and hands each value to its own binding, which is what
  // makes the DOM the single source of truth after a RESET.
  //
  // A missing element falls back to the binding's default instead of the null
  // the old read-back propagated. The two are the same value: every default here
  // is the same number the collaborator on the other end of `apply` already
  // holds, so pushing it is what the null branch used to achieve by doing
  // nothing.
  public syncFromDom() {
    this.bindings.forEach((binding) => {
      const element = this.elements.get(binding.selector);
      const value = element
        ? parseInt(element.value, 10)
        : binding.defaultValue;

      binding.apply(value);
    });
  }
}

export default SliderBank;
