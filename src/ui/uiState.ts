// The shared store for UI values that have no engine home yet.
//
// Shipped deliberately empty. Each widget ticket adds one slice for the values
// it owns — shading mode, texture, base colour, UV scale, scale, the four
// lighting values, fog, grid step, projection, sky / floor / grid / shadow,
// dropped frames — by extending UiState and setting its defaults below.
//
// THE CONTRACT: a slice is only complete when the toolbar's RESET path restores
// it. Adding a value here without adding it to RESET leaves the console with a
// control that RESET silently ignores, which is the bug this store exists to
// prevent.
//
// Consumers subscribe rather than keeping private copies — the quick toggles
// and the scene graph both read state the inspector owns, and a second copy is
// how the two ends of a toggle end up disagreeing.

export interface UiState {
  // Slices are added here by the ticket that owns each value.
}

type Listener = (state: Readonly<UiState>) => void;

const state: UiState = {};
const listeners = new Set<Listener>();

export const getState = (): Readonly<UiState> => state;

export const setState = (patch: Partial<UiState>) => {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
};

// Returns the unsubscribe function.
export const subscribe = (listener: Listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
