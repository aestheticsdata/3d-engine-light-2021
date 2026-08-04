// The keyboard bindings, as data.
//
// Nothing dispatches them yet. There is no global key handler at all — the only
// keydown listeners in the tree are ShapePicker's list navigation and TabGroup's
// roving focus, both scoped to one widget — so today this table has exactly one
// consumer, the panel that documents it. It
// is a table rather than eight strings in that panel's markup because it will
// have a second consumer: the de-mock ticket "Keyboard shortcut handler"
// imports the same array and dispatches on `keys`. Neither side may hardcode a
// key, which is the only way the printed hint and the live binding cannot drift.
//
// Inert data with no behaviour, so it stays a table rather than becoming a class
// (decisions.md D1a).

import data from "@data/data";

export interface ShortcutBinding {
  // What the chip prints. Not always a key name — the shape binding prints a
  // range.
  keyLabel: string;
  // What the future handler matches against, one entry per physical key.
  keys: string[];
  action: string;
  // Why it is not live. `pendingHandler` means the action exists and only the
  // keydown listener is missing; `pendingFeature` means there is nothing to
  // call yet. Only the second earns the dimmed placeholder affordance — dimming
  // a binding whose feature works would say the feature is missing.
  status: "pendingHandler" | "pendingFeature";
  // The method or store slice the key will drive, named so the handler ticket
  // does not have to rediscover it.
  handler?: string;
}

// Every primitive in the registry, which is what the mobile card's pointer line
// counts: it sends the reader to the SHAPE tab, where all of them are reachable.
export const PRIMITIVE_COUNT = Object.keys(data).length;

// The number of primitives a *keystroke* can reach, which is a different number.
// The registry holds fourteen and the digit row holds nine, so the range stops
// at 9 rather than printing "1-14" and promising keys 10 through 14 that no
// keyboard has. Still derived, never a literal: a registry of six would print
// 1-6, and a fifteenth primitive changes nothing here.
export const SHAPE_KEY_COUNT = Math.min(9, PRIMITIVE_COUNT);

const shapeKeys = Array.from({ length: SHAPE_KEY_COUNT }, (_, index) => String(index + 1));

export const SHORTCUTS: readonly ShortcutBinding[] = [
  { keyLabel: "SPACE", keys: [" "], action: "pause", status: "pendingHandler", handler: "Main.togglePause" },
  {
    keyLabel: "W",
    keys: ["w"],
    action: "wireframe",
    status: "pendingHandler",
    handler: "RenderPipelinePanel.setWireframe",
  },
  // The only pending-*feature* binding in the list: the renderer draws no grid
  // at all, so there is nothing for a handler to call. It goes live with de-mock
  // E5 "WORLD: ground grid", not with the keyboard ticket.
  { keyLabel: "G", keys: ["g"], action: "grid", status: "pendingFeature" },
  {
    keyLabel: "C",
    keys: ["c"],
    action: "culling",
    status: "pendingHandler",
    handler: "RenderPipelinePanel.setCullBackfaces",
  },
  { keyLabel: "R", keys: ["r"], action: "reset", status: "pendingHandler", handler: "Main.resetControls" },
  { keyLabel: "S", keys: ["s"], action: "sky", status: "pendingHandler", handler: "UIStateStore.sky" },
  { keyLabel: "F", keys: ["f"], action: "floor", status: "pendingHandler", handler: "UIStateStore.floor" },
  {
    keyLabel: `1-${SHAPE_KEY_COUNT}`,
    keys: shapeKeys,
    action: "shape",
    status: "pendingHandler",
    handler: "ShapeTab.onPick",
  },
];

// The touch equivalent, for the branch that has no keyboard. All three are
// pending-feature — the canvas has no pointer, touch or wheel handler of any
// kind — and they ship with de-mock "Pointer orbit, pinch zoom, double-tap
// reset".
export interface GestureBinding {
  gesture: string;
  effect: string;
}

export const GESTURES: readonly GestureBinding[] = [
  { gesture: "DRAG", effect: "orbit" },
  { gesture: "PINCH", effect: "zoom" },
  { gesture: "DOUBLE TAP", effect: "reset" },
];
