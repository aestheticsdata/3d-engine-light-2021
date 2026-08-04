// The five view-preset chips and the angles each one lands on.
//
// Deliberately not the mockup's pairs — yaw [0, 180, 137, 90, 45] and pitch
// [0, 0, 78, 0, 30] (design L1498-L1501). 137/78 is not a top view in any
// convention, and the design's own labels are the specification those numbers
// failed to meet. These are the standard six minus BOTTOM, which the design does
// not draw.
//
// The sign convention falls out of the registry rather than a preference: the
// authored top of a shape is at negative y (pyramid.ts puts its apex at
// [0, -100, 0]) and the eye looks down +z, so a positive pitch tips the top
// towards the viewer. TOP is therefore +89, and ISO takes the same sign so it
// looks down at the shape rather than up at it.
//
// 89 rather than 90 because the rig clamps pitch there — a turntable has a roll
// axis of its own and nothing to gain from the pole flip. At 89 the gizmo's Y
// axis is already down to its floor, so the last degree buys nothing visible.

interface ViewAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

// `satisfies` rather than an annotation: the keys stay the five literals, which
// is what makes ViewPresetKey below the closed set the chip grid iterates and a
// typo in a caller a compile error.
const viewPresets = {
  FRNT: { pitch: 0, yaw: 0, roll: 0 },
  BACK: { pitch: 0, yaw: 180, roll: 0 },
  TOP: { pitch: 89, yaw: 0, roll: 0 },
  SIDE: { pitch: 0, yaw: 90, roll: 0 },
  ISO: { pitch: 30, yaw: 45, roll: 0 },
} satisfies Record<string, ViewAngles>;

export type ViewPresetKey = keyof typeof viewPresets;

export default viewPresets;
