// The console's one window-level key handler, dispatching through the same
// registry the toolbar's buttons do.
//
// It reads SHORTCUTS rather than key strings of its own, and that is the whole
// point of the table existing: the chip strip in the right panel renders from
// the same array, so a chip cannot print a key this does not bind and this
// cannot bind a key no chip documents. Neither side may hardcode one.
//
// Three other keydown listeners live in the tree and are none of this class's
// business — TabGroup's roving focus, ViewportExpander's escape out of theatre
// mode, ShapePicker's list navigation. Each is scoped to one widget and to a
// focused element. This one is global, which is precisely why it has to stand
// down whenever any of them could be the intended recipient.

import { SHORTCUTS } from "@ui/shortcuts";

import type ActionRegistry from "@ui/ActionRegistry";

// What a keystroke belongs to when it is not a shortcut. `button` is in the list
// for a specific bug rather than for symmetry: SPACE with the PAUSE button
// focused activates it natively, so without this the loop would toggle twice on
// one press. The contenteditable pair is spelled both ways because the attribute
// is true when empty and when it says "true", and matches neither selector when
// it says "false".
const EDITABLE = 'input, select, textarea, button, [contenteditable=""], [contenteditable="true"]';

class KeyboardShortcuts {
  private readonly actions: ActionRegistry;
  private listening: boolean;

  constructor(actions: ActionRegistry) {
    this.actions = actions;
    this.listening = false;
  }

  public listen() {
    if (this.listening) {
      return;
    }

    window.addEventListener("keydown", this.onKeyDown);
    this.listening = true;
  }

  public dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    this.listening = false;
  }

  // An arrow property, and R9's sanctioned case: it is handed to
  // addEventListener as a value and needs its own `this` back. It also has to be
  // the same reference at removeEventListener, which a bound method built in
  // listen() would not be.
  private onKeyDown = (event: KeyboardEvent) => {
    // Auto-repeat would fire a toggle dozens of times for one held key, and a
    // modifier means the keystroke belongs to the browser or the OS — Cmd-R is
    // a reload, not a scene reset.
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(EDITABLE)) {
      return;
    }

    const key = event.key.toLowerCase();
    // Gated on `live` rather than on a list of keys to skip: a binding becomes
    // active the moment its own ticket flips that field, with no edit here.
    const binding = SHORTCUTS.find((candidate) => candidate.status === "live" && candidate.keys.includes(key));

    if (!binding?.handler) {
      return;
    }

    // Once a binding has claimed the key, the browser must not also have it.
    // SPACE is the one that shows: it scrolls the page, and the viewport is
    // tall enough for that to be obvious.
    event.preventDefault();

    // Keyed off the action id rather than off the key or the printed label, so
    // the one binding that carries an argument is identified by the contract
    // both sides share.
    if (binding.handler === "selectPrimitive") {
      this.actions.run("selectPrimitive", Number(key) - 1);

      return;
    }

    this.actions.run(binding.handler);
  };
}

export default KeyboardShortcuts;
