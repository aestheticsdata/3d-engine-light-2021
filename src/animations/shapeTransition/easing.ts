// Two pure functions, kept as functions.
//
// They moved out of shapeTransitionMachine.ts only because the states that call
// them moved; they are deliberately NOT a class. A stateless class here would
// buy no encapsulation, and these two are the house style's own cited example of
// a module-scope helper that should stay one.

export const easeInOutCubic = (progress: number): number =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

export const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;
