// NORMALS mode's whole encoding (E3c/COS-243): a face's outward unit normal,
// written into a colour as rgb = N̂ · 0.5 + 0.5.
//
// The raw cross product Nraw = (b - a) x (c - a) is the same one
// Lighting.computeTerms takes, and it points AWAY from the eye for a visible
// face — its z is the cross product Triangle.isFrontFacing() takes the sign of,
// and a front-facing triangle has it positive while the eye sits at negative z.
// The outward normal is therefore -Nraw, and the negation rides in the divide
// rather than costing three more multiplies, exactly as it does there.
//
// Two of the three display axes are then flipped, and the ticket only asked for
// one of them. Screen y is down, so an upward-facing normal would come out with
// a low green channel against every reference image ever printed. Screen z runs
// the same way: Camera.depthAt(z) is z + distance, so +z is INTO the screen,
// while the convention every normal map is authored to has +z pointing at the
// viewer. Flipping y and leaving z alone would swap one inversion for another —
// a face turned toward the camera would come out darker blue than one turned
// away. x needs nothing: convert3D2D writes centerX + x * scale, so +x is
// already screen-right.
//
// A degenerate face — SphereGenerator emits thirteen coincident points at each
// pole, so this is real rather than defensive — encodes as the zero normal,
// which is the mid grey every channel's own 0.5 lands on.

import type { RGBA } from "@rendering/cssColor";

// The same floor Lighting uses, and for the same faces.
const DEGENERATE = 1e-9;
const CHANNEL_MAX = 255;

const channel = (component: number): number => Math.round((component * 0.5 + 0.5) * CHANNEL_MAX);

// Nine positional arguments rather than three points or an options object: this
// runs once per drawn triangle per frame in NORMALS mode, and Lighting.fillFor
// records the same reading of R4 — the line in this codebase falls between
// per-mesh calls, which get an options object, and per-triangle calls, which do
// not.
export const normalRgba = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): RGBA => {
  const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
  const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const length = Math.hypot(nx, ny, nz);

  if (length < DEGENERATE) {
    return [channel(0), channel(0), channel(0), 1];
  }

  const inverse = -1 / length;

  return [channel(nx * inverse), channel(-ny * inverse), channel(-nz * inverse), 1];
};
