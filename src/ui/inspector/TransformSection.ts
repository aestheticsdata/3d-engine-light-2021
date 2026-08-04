// TRANSFORM: the five rows that orient and spin the shape.
//
// Four are real and one is not. PITCH / YAW / ROLL are absolute degrees written
// straight into the camera rig; SPIN is degrees per second on the same rig;
// SCALE has nothing behind it and says so.
//
// The three angle rows carry a `°` suffix, which supersedes the rule the UI epic
// shipped them under. That rule was right at the time: they were per-frame
// rotation *rates* mapped through a two-segment UI space, and printing degrees
// beside a rate would have invited someone to expect the shape to return to a
// pose. The rig makes them poses, so the suffix is now the honest label and the
// word RATE has gone from all three.

import SliderRow from "@ui/inspector/controls/SliderRow";

import type { EulerDegrees } from "@camera/CameraRig";
import type UIStateStore from "@ui/UIStateStore";

// Zero, and the console still moves at rest — SPIN is what turns it now. The
// old defaults were three off-centre rates (pitch 400, yaw 400, roll 200 in
// engine space) chosen so the shape would tumble on load; a turntable at 24 °/s
// does that with one axis and leaves all three angles at a real zero the user
// can return to.
export const DEFAULT_PITCH_DEGREES = 0;
export const DEFAULT_YAW_DEGREES = 0;
export const DEFAULT_ROLL_DEGREES = 0;
// A fifteen-second revolution. The rates it replaces worked out at roughly
// 87 / 122 / 48 °/s on three axes at once at 60fps, which is why the resting
// shot is visibly calmer than it was.
export const DEFAULT_SPIN_DEGREES_PER_SECOND = 24;
export const DEFAULT_SCALE = 100;

// Pitch stops short of the pole because the rig is a turntable: roll is its own
// axis, so there is nothing a ±90 pitch offers except a flip.
const PITCH_LIMIT = 89;
const YAW_LIMIT = 180;
const ROLL_LIMIT = 180;
const SPIN_MIN = 0;
const SPIN_MAX = 120;
const SCALE_MIN = 10;
const SCALE_MAX = 300;
const SCALE_HINT_ID = "ph-shape-scale";

export interface TransformSectionOptions {
  root: HTMLElement;
  store: UIStateStore;
  onPitch: (degrees: number) => void;
  onYaw: (degrees: number) => void;
  onRoll: (degrees: number) => void;
  onSpin: (degreesPerSecond: number) => void;
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
      pitch: DEFAULT_PITCH_DEGREES,
      yaw: DEFAULT_YAW_DEGREES,
      roll: DEFAULT_ROLL_DEGREES,
      spin: DEFAULT_SPIN_DEGREES_PER_SECOND,
      scale: DEFAULT_SCALE,
    });

    this.pitch = this.buildAngle("PITCH", PITCH_LIMIT, DEFAULT_PITCH_DEGREES, (value) => {
      this.store.setState({ pitch: value });
      options.onPitch(value);
    });
    this.yaw = this.buildAngle("YAW", YAW_LIMIT, DEFAULT_YAW_DEGREES, (value) => {
      this.store.setState({ yaw: value });
      options.onYaw(value);
    });
    this.roll = this.buildAngle("ROLL", ROLL_LIMIT, DEFAULT_ROLL_DEGREES, (value) => {
      this.store.setState({ roll: value });
      options.onRoll(value);
    });

    this.spin = new SliderRow({
      label: "SPIN",
      min: SPIN_MIN,
      max: SPIN_MAX,
      value: DEFAULT_SPIN_DEGREES_PER_SECOND,
      // Degrees per second, not the design's `/s` multiplier (L1413). The rig
      // accumulates against wall-clock time, so this row now names a real
      // physical rate and the shape completes a turn in the same time at any
      // frame rate the RENDER tab's cap can select.
      format: (value) => `${value}°/s`,
      onInput: (value) => {
        this.store.setState({ spin: value });
        options.onSpin(value);
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

  // The other direction: the rig moved on its own — a preset today, a drag once
  // E1b lands — and the three rows follow it. Deliberately does not call back
  // into the rig, which already holds these values; a round trip here is how a
  // preset ends up fighting the ease that is writing it.
  //
  // Rounded because the rows are integer-stepped: the thumb would snap while the
  // read-out printed the raw float, which is two surfaces disagreeing about one
  // number in a space of about four pixels.
  public setAngleUi(angles: EulerDegrees) {
    const pitch = Math.round(angles.pitch);
    const yaw = Math.round(angles.yaw);
    const roll = Math.round(angles.roll);

    this.pitch.setValue(pitch);
    this.yaw.setValue(yaw);
    this.roll.setValue(roll);
    this.store.setState({ pitch, yaw, roll });
  }

  // Writes the store's values into the rows AND pushes them to the rig. Both
  // halves matter: this is the RESET path, and a reset that moved the sliders
  // without moving the camera would leave the two disagreeing until the next
  // drag.
  public syncFromStore() {
    const state = this.store.getState();
    const pitch = state.pitch ?? DEFAULT_PITCH_DEGREES;
    const yaw = state.yaw ?? DEFAULT_YAW_DEGREES;
    const roll = state.roll ?? DEFAULT_ROLL_DEGREES;
    const spin = state.spin ?? DEFAULT_SPIN_DEGREES_PER_SECOND;

    this.pitch.setValue(pitch);
    this.yaw.setValue(yaw);
    this.roll.setValue(roll);
    this.spin.setValue(spin);
    this.scale.setValue(state.scale ?? DEFAULT_SCALE);

    this.apply.onPitch(pitch);
    this.apply.onYaw(yaw);
    this.apply.onRoll(roll);
    this.apply.onSpin(spin);
  }

  // Symmetric about zero, which is what a range input can express and the old
  // engine-space bounds could not: neutral was 320 of 0..800 for pitch, 512 for
  // yaw and 0 of -1000..1200 for roll, a different fraction of the track on each
  // of the three.
  private buildAngle(label: string, limit: number, value: number, onInput: (value: number) => void): SliderRow {
    return new SliderRow({
      label,
      min: -limit,
      max: limit,
      value,
      format: (degrees) => `${degrees}°`,
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
