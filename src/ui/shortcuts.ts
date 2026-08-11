// The keyboard bindings, as data.
//
// Two consumers read this array and neither may hardcode a key: ShortcutsPanel
// prints the chips from it, and KeyboardShortcuts dispatches from it (E8a). That
// is the only arrangement in which the printed hint and the live binding cannot
// drift apart — a chip cannot promise a key nothing binds, and nothing can bind
// a key no chip prints.
//
// Inert data with no behaviour, so it stays a table rather than becoming a class
// (decisions.md D1a).

import data from "@data/data";

import type { ActionId } from "@ui/ActionRegistry";

export interface ShortcutBinding {
  // What the chip prints. Not always a key name — the shape binding prints a
  // range.
  keyLabel: string;
  // What the future handler matches against, one entry per physical key.
  keys: string[];
  action: string;
  // `live` means the key acts. `pendingFeature` means there is nothing to call
  // yet, and it is the only value that earns the dimmed placeholder affordance
  // — dimming a binding that works would say the feature is missing.
  //
  // E8a removed a third value, `pendingHandler`, which meant "the action exists
  // and only the listener is missing". That state cannot recur: there is a
  // listener now, and it reads this table, so any binding added here is either
  // dispatchable or has no feature behind it at all.
  status: "live" | "pendingFeature";
  // The action the key runs, typed rather than a documentation string: the
  // registry's own union is what stops this table naming something nothing
  // registered. Absent only while a binding is pendingFeature.
  handler?: ActionId;
}

// Every primitive in the registry, which is what the mobile card's pointer line
// counts: it sends the reader to the SHAPE tab, where all of them are reachable.
export const PRIMITIVE_COUNT = Object.keys(data).length;

// The number of primitives a *keystroke* can reach, which is a different number.
// The registry holds twenty and the digit row holds nine, so the range stops
// at 9 rather than printing "1-20" and promising keys 10 through 20 that no
// keyboard has. Still derived, never a literal: a registry of six would print
// 1-6, and a twenty-first primitive changes nothing here.
export const SHAPE_KEY_COUNT = Math.min(9, PRIMITIVE_COUNT);

const shapeKeys = Array.from({ length: SHAPE_KEY_COUNT }, (_, index) => String(index + 1));

export const SHORTCUTS: readonly ShortcutBinding[] = [
  { keyLabel: "SPACE", keys: [" "], action: "pause", status: "live", handler: "togglePause" },
  { keyLabel: "W", keys: ["w"], action: "wireframe", status: "live", handler: "toggleWireframe" },
  { keyLabel: "G", keys: ["g"], action: "grid", status: "live", handler: "toggleGrid" },
  { keyLabel: "C", keys: ["c"], action: "culling", status: "live", handler: "toggleBackfaceCulling" },
  { keyLabel: "R", keys: ["r"], action: "reset", status: "live", handler: "resetControls" },
  { keyLabel: "S", keys: ["s"], action: "sky", status: "live", handler: "toggleSky" },
  { keyLabel: "F", keys: ["f"], action: "floor", status: "live", handler: "toggleFloor" },
  {
    keyLabel: `1-${SHAPE_KEY_COUNT}`,
    keys: shapeKeys,
    action: "shape",
    status: "live",
    handler: "selectPrimitive",
  },
];

// The touch equivalent, for the branch that has no keyboard. All three gestures
// are live — PointerOrbit (E1b) is what dispatches them — so, unlike SHORTCUTS
// above, this table carries no per-row status: there is no pending state left
// to mark.
export interface GestureBinding {
  gesture: string;
  effect: string;
}

export const GESTURES: readonly GestureBinding[] = [
  { gesture: "DRAG", effect: "orbit" },
  { gesture: "PINCH", effect: "zoom" },
  { gesture: "DOUBLE TAP", effect: "reset" },
];
