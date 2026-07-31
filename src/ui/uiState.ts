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
const defaults: Partial<UiState> = {};

export const getState = (): Readonly<UiState> => state;

const notify = () => {
  listeners.forEach((listener) => listener(state));
};

export const setState = (patch: Partial<UiState>) => {
  Object.assign(state, patch);
  notify();
};

// Declares a slice together with the values RESET must restore it to. Calling
// this at the declaration site is what makes RESET coverage automatic: a ticket
// that adds a slice gets it restored without anyone editing the reset handler,
// which is the failure mode this registry exists to prevent.
export const registerSlice = (slice: Partial<UiState>) => {
  Object.assign(defaults, slice);
  Object.assign(state, slice);
  notify();
};

// Restores every registered default and notifies once, so the whole console
// repaints in a single pass rather than once per slice.
export const resetAll = () => {
  Object.assign(state, defaults);
  notify();
};

// Returns the unsubscribe function.
export const subscribe = (listener: Listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
