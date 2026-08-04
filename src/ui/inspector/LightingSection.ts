// LIGHTING: the four sliders for a light that does not exist yet.
//
// Triangle fills with the material's baked colour; no normal is ever
// computed, so all four values are placeholders that persist and format but
// change nothing about the frame until de-mock E3. The scene graph's
// KEY_LIGHT row reads this same slice, so hiding it and moving these
// sliders describe one fictional light, not two.

import DOMScope from "@ui/DOMScope";
import SliderRow from "@ui/inspector/controls/SliderRow";

import type UIStateStore from "@ui/UIStateStore";

export const DEFAULT_AZIMUTH = 135;
export const DEFAULT_ELEVATION = 42;
export const DEFAULT_AMBIENT = 30;
export const DEFAULT_SPECULAR = 55;

const HINT_ID = "ph-lighting";
const HINT_TEXT = "There is no light in this engine yet (de-mock E3).";

export interface LightingSectionOptions {
  root: string;
  store: UIStateStore;
}

class LightingSection {
  private readonly store: UIStateStore;
  private readonly azimuth: SliderRow;
  private readonly elevation: SliderRow;
  private readonly ambient: SliderRow;
  private readonly specular: SliderRow;

  constructor(options: LightingSectionOptions) {
    const root = new DOMScope(document).require<HTMLElement>(options.root, "LIGHTING section is missing.");
    const placeholder = { title: HINT_TEXT, describedBy: HINT_ID };

    this.store = options.store;
    // Four flat fields, not the nested lighting.{azimuth,…} object the ticket
    // asked for: registerSlice and resetAll both Object.assign the slice
    // (UIStateStore.ts), which is a shallow copy — a nested object would be
    // shared by reference between defaults and state, so the first slider drag
    // would mutate the defaults in place and RESET would restore the dragged
    // value instead of undoing it.
    this.store.registerSlice({
      lightAzimuth: DEFAULT_AZIMUTH,
      lightElevation: DEFAULT_ELEVATION,
      lightAmbient: DEFAULT_AMBIENT,
      lightSpecular: DEFAULT_SPECULAR,
    });

    this.azimuth = new SliderRow({
      label: "AZIMUTH",
      min: 0,
      max: 360,
      value: DEFAULT_AZIMUTH,
      placeholder,
      format: (value) => `${value}°`,
      onInput: (value) => this.store.setState({ lightAzimuth: value }),
    });
    this.elevation = new SliderRow({
      label: "ELEVATION",
      min: 0,
      max: 90,
      value: DEFAULT_ELEVATION,
      placeholder,
      format: (value) => `${value}°`,
      onInput: (value) => this.store.setState({ lightElevation: value }),
    });
    this.ambient = new SliderRow({
      label: "AMBIENT",
      min: 0,
      max: 100,
      value: DEFAULT_AMBIENT,
      placeholder,
      format: (value) => `${value}%`,
      onInput: (value) => this.store.setState({ lightAmbient: value }),
    });
    this.specular = new SliderRow({
      label: "SPECULAR",
      min: 0,
      max: 100,
      value: DEFAULT_SPECULAR,
      placeholder,
      format: (value) => `${value}%`,
      onInput: (value) => this.store.setState({ lightSpecular: value }),
    });

    root.append(
      this.azimuth.element,
      this.elevation.element,
      this.ambient.element,
      this.specular.element,
      this.buildHint(),
    );
  }

  public syncFromStore() {
    const state = this.store.getState();
    this.azimuth.setValue(state.lightAzimuth ?? DEFAULT_AZIMUTH);
    this.elevation.setValue(state.lightElevation ?? DEFAULT_ELEVATION);
    this.ambient.setValue(state.lightAmbient ?? DEFAULT_AMBIENT);
    this.specular.setValue(state.lightSpecular ?? DEFAULT_SPECULAR);
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");
    hint.className = "placeholder-hint";
    hint.id = HINT_ID;
    hint.textContent = HINT_TEXT;
    return hint;
  }
}

export default LightingSection;
