// TRANSFORM: the five rows that orient and spin the shape.
//
// Four are real and one is not. PITCH / YAW / ROLL RATE and SPIN drive the
// engine through rotationRates.ts; SCALE has nothing behind it and says so.
//
// The rows are relabelled from the design's PITCH / YAW / ROLL, and the word
// RATE is the whole point: these are degrees applied per frame, not angles the
// shape is held at. Calling them angles would invite someone to expect the
// shape to return to a pose, which nothing in this renderer can do —
// Mesh.transformMesh mutates its points in place, so there is no identity to
// come back to. Absolute orientation is de-mock E1.

import SliderRow from "@ui/inspector/controls/SliderRow";
import {
  PITCH_AXIS,
  ROLL_AXIS,
  SPIN_TO_ROTATION_SPEED,
  toEngineRate,
  UI_RATE_MAX,
  UI_RATE_MIN,
  YAW_AXIS,
} from "@ui/inspector/rotationRates";

import type UIStateStore from "@ui/UIStateStore";

// Not 0, and this is the whole reason the console tumbles on load. The engine's
// pre-refonte defaults were pitch 400 / yaw 400 / roll 200 — deliberately
// off-centre so the shape turns at rest — and these are those same three values
// expressed in UI space through toEngineRate: 17 -> 401.6, -22 -> 399.4,
// 17 -> 204. A zero default is a real zero the user can return to, but as a
// starting pose it freezes every mesh face-on and the engine looks 2D.
export const DEFAULT_PITCH_RATE = 17;
export const DEFAULT_YAW_RATE = -22;
export const DEFAULT_ROLL_RATE = 17;
export const DEFAULT_SPIN = 10;
export const DEFAULT_SCALE = 100;

const SPIN_MIN = 0;
const SPIN_MAX = 100;
const SCALE_MIN = 10;
const SCALE_MAX = 300;
const SCALE_HINT_ID = "ph-shape-scale";

export interface TransformSectionOptions {
  root: HTMLElement;
  store: UIStateStore;
  onPitch: (engineValue: number) => void;
  onYaw: (engineValue: number) => void;
  onRoll: (engineValue: number) => void;
  onSpin: (rotationSpeed: number) => void;
}

class TransformSection {
  private readonly store: UIStateStore;
  private readonly apply: TransformSectionOptions;
  private readonly pitch: SliderRow;
  private readonly yaw: SliderRow;
  private readonly roll: SliderRow;
  private readonly spin: SliderRow;
  private readonly scale: SliderRow;

  constructor(options: TransformSectionOptions) {
    this.store = options.store;
    this.apply = options;
    // Registered here rather than in the store, which is what makes RESET
    // coverage automatic: resetAll() restores whatever was declared, so this
    // section is restored without the reset handler being edited.
    this.store.registerSlice({
      pitchRate: DEFAULT_PITCH_RATE,
      yawRate: DEFAULT_YAW_RATE,
      rollRate: DEFAULT_ROLL_RATE,
      spin: DEFAULT_SPIN,
      scale: DEFAULT_SCALE,
    });

    this.pitch = this.buildRate("PITCH RATE", DEFAULT_PITCH_RATE, (value) => {
      this.store.setState({ pitchRate: value });
      options.onPitch(toEngineRate(value, PITCH_AXIS));
    });
    this.yaw = this.buildRate("YAW RATE", DEFAULT_YAW_RATE, (value) => {
      this.store.setState({ yawRate: value });
      options.onYaw(toEngineRate(value, YAW_AXIS));
    });
    this.roll = this.buildRate("ROLL RATE", DEFAULT_ROLL_RATE, (value) => {
      this.store.setState({ rollRate: value });
      options.onRoll(toEngineRate(value, ROLL_AXIS));
    });

    this.spin = new SliderRow({
      label: "SPIN",
      min: SPIN_MIN,
      max: SPIN_MAX,
      value: DEFAULT_SPIN,
      // The design's own format, kept exactly (L1413). Not a physical rate —
      // it is a multiplier on the three above — but it is what the mockup
      // prints and it reads correctly as "ten times a second-ish".
      format: (value) => `${(value / 10).toFixed(1)}/s`,
      onInput: (value) => {
        this.store.setState({ spin: value });
        options.onSpin(value * SPIN_TO_ROTATION_SPEED);
      },
    });

    this.scale = new SliderRow({
      label: "SCALE",
      min: SCALE_MIN,
      max: SCALE_MAX,
      value: DEFAULT_SCALE,
      format: (value) => `${(value / 100).toFixed(2)}×`,
      onInput: (value) => this.store.setState({ scale: value }),
      placeholder: { title: "Mesh scale is not wired to the engine yet (de-mock E4).", describedBy: SCALE_HINT_ID },
    });

    options.root.append(
      this.pitch.element,
      this.yaw.element,
      this.roll.element,
      this.spin.element,
      this.scale.element,
      this.buildHint(),
    );
  }

  // Pushes the store's values back into the inputs. RESET restores the slice
  // and then calls this, so the rows follow the store rather than each holding
  // a second copy of the same number.
  // Writes the store's values into the rows AND pushes them to the engine. Both
  // halves matter: this is the RESET path, and a reset that moved the sliders
  // without moving the camera would leave the two disagreeing until the next
  // drag.
  public syncFromStore() {
    const state = this.store.getState();
    const pitchRate = state.pitchRate ?? DEFAULT_PITCH_RATE;
    const yawRate = state.yawRate ?? DEFAULT_YAW_RATE;
    const rollRate = state.rollRate ?? DEFAULT_ROLL_RATE;
    const spin = state.spin ?? DEFAULT_SPIN;

    this.pitch.setValue(pitchRate);
    this.yaw.setValue(yawRate);
    this.roll.setValue(rollRate);
    this.spin.setValue(spin);
    this.scale.setValue(state.scale ?? DEFAULT_SCALE);

    this.apply.onPitch(toEngineRate(pitchRate, PITCH_AXIS));
    this.apply.onYaw(toEngineRate(yawRate, YAW_AXIS));
    this.apply.onRoll(toEngineRate(rollRate, ROLL_AXIS));
    this.apply.onSpin(spin * SPIN_TO_ROTATION_SPEED);
  }

  private buildRate(label: string, value: number, onInput: (value: number) => void): SliderRow {
    return new SliderRow({
      label,
      min: UI_RATE_MIN,
      max: UI_RATE_MAX,
      value,
      // A bare signed integer, and no degree suffix. The number is not degrees
      // of anything the user can see — printing ° would be a lie the design
      // does not tell either.
      format: (value) => String(value),
      onInput,
    });
  }

  private buildHint(): HTMLElement {
    const hint = document.createElement("span");

    hint.className = "placeholder-hint";
    hint.id = SCALE_HINT_ID;
    hint.textContent = "Mesh scale is not wired to the engine yet (de-mock E4).";

    return hint;
  }
}

export default TransformSection;
