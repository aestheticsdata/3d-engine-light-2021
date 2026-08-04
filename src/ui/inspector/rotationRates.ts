// The mapping between the TRANSFORM sliders the user sees and the rotation
// rates the engine actually applies.
//
// The engine's pitch and yaw are per-frame rotation rates measured as an offset
// from the canvas centre: neutral is 320 for pitch and 512 for yaw on a
// 1024x640 canvas, and neither is the midpoint of its 0..800 range. Roll is
// neutral at 0 inside -1000..1200, so it is off-centre the other way. A slider
// whose "no rotation" position is 40% along, and a different 40% per axis, is
// not a control anyone can use.
//
// So the UI works in a signed -100..100 with a real zero, and this module is
// the only place that knows how that lands on the engine. Each axis is two
// linear segments rather than one, because the neutral point is not the middle:
// mapping -100..100 straight onto 0..800 would put zero at 400, which spins.
//
// Nothing here changes the renderer. rotateMesh is untouched — de-mock E1 is
// what replaces rates with absolute angles, and it will delete this file rather
// than edit it.

export interface RateAxis {
  min: number;
  neutral: number;
  max: number;
}

// Engine-space, and each one is read off the markup's own range bounds plus the
// neutral the rotation maths implies.
export const PITCH_AXIS: RateAxis = { min: 0, neutral: 320, max: 800 };
export const YAW_AXIS: RateAxis = { min: 0, neutral: 512, max: 800 };
export const ROLL_AXIS: RateAxis = { min: -1000, neutral: 0, max: 1200 };

export const UI_RATE_MIN = -100;
export const UI_RATE_MAX = 100;

// SPIN is the one axis that is already linear from zero, so it needs no
// segments — only a scale. The engine's 0..2000 over the UI's 0..100.
export const SPIN_TO_ROTATION_SPEED = 20;

export const toEngineRate = (uiValue: number, axis: RateAxis): number => {
  const clamped = Math.min(UI_RATE_MAX, Math.max(UI_RATE_MIN, uiValue));

  if (clamped < 0) {
    return axis.neutral + ((axis.neutral - axis.min) * clamped) / UI_RATE_MAX;
  }

  return axis.neutral + ((axis.max - axis.neutral) * clamped) / UI_RATE_MAX;
};
