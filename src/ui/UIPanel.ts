// What a panel is, written down once so the panel tickets do not each invent it.
//
// A panel owns a region of the console, resolves its nodes through a DOMScope
// and repaints from UIStateStore. `paint` is the whole contract: the store
// notifies, the panel redraws from state, and nothing else is public.
//
// `readonly paint: () => void` is a property of function type, not a method
// signature, and the difference is load-bearing rather than stylistic. Panels
// hand this straight to `store.subscribe(this.paint)`; a method signature
// invites a regular method, which loses its `this` the moment it is passed as a
// value and fails at runtime with no compile error. The property form makes the
// arrow class property the only way to satisfy the interface — R9's one
// sanctioned use, for exactly this reason.
//
// The contract is satisfied structurally. This repo has never used `implements`
// and the epic keeps it that way (decisions.md D4): declare the shape here and
// let the compiler check it where a panel is consumed.

interface UIPanel {
  readonly paint: () => void;
}

export default UIPanel;
