// DITHERING's whole encoding (E3d/COS-244): five bits per channel, with a 4 x 4
// ordered Bayer offset deciding which of the two neighbouring levels each pixel
// lands on.
//
// Quantising to 32 levels is the point rather than a compromise it makes. An
// ordered dither at eight bits is a sub-LSB nudge nobody can see, and a toggle
// that changes nothing is the kind of thing this epic exists to remove; at five
// bits the pass has something to hide, and hiding it is what the eye reads as a
// smooth ramp where a hard contour used to be. That contour is the Mach band —
// the eye finds an edge between two flat levels far more readily than it finds
// the same total step spread across a dithered gradient — so the pass trades a
// few visible contours for a great deal of invisible texture.
//
// Averaged over the sixteen cells of one tile the result is the input again, to
// within half the spacing of the sixteen thresholds — a thirty-second of a level,
// or a quarter of one 8-bit step. That is what leaves a gradient's slope intact
// and takes away only its terracing.
//
// A level reconstructs to a FLOAT channel value, not to a rounded byte, and that
// is what makes the pass idempotent: a value already on the lattice re-quantises
// to itself for all sixteen offsets and so acquires no pattern at all. Rounding
// the reconstruction would put the lattice a little off its own levels, and one
// pixel in sixteen would then flip a level on a colour that never moved.
// FrameBuffer's Uint8ClampedArray does that rounding once, at the write.

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER_SIZE = 4;
// The tile is a power of two, so wrapping a coordinate into it is an AND rather
// than a modulo. Both callers pass buffer coordinates, which are non-negative
// integers — the one precondition that makes the two equivalent.
const BAYER_MASK = BAYER_SIZE - 1;
const BAYER_CELLS = BAYER_SIZE * BAYER_SIZE;

const LEVELS = 32;
const TOP_LEVEL = LEVELS - 1;
const CHANNEL_MAX = 255;

// Each cell's threshold as a fraction of one level, half a step off zero so the
// sixteen sit symmetrically inside the level rather than starting at its floor.
// The half step is what keeps a value exactly on the lattice below every one of
// them, and therefore unmoved.
const BIAS = BAYER_4X4.map((cell) => (cell + 0.5) / BAYER_CELLS);

const LEVEL_VALUE = Array.from({ length: LEVELS }, (_, level) => (level * CHANNEL_MAX) / TOP_LEVEL);

// One lookup per pixel rather than per channel: the offset is a property of
// where the pixel is, not of which channel is being quantised.
export const ditherBias = (x: number, y: number): number => BIAS[(y & BAYER_MASK) * BAYER_SIZE + (x & BAYER_MASK)];

// Clamped rather than trusted: a GOURAUD multiply against a specular term can
// carry a channel past 255, and the buffer would clamp that on the way in
// anyway — doing it here keeps the level inside the table it indexes.
export const ditherChannel = (value: number, bias: number): number => {
  const level = Math.floor((value * TOP_LEVEL) / CHANNEL_MAX + bias);

  return LEVEL_VALUE[Math.min(TOP_LEVEL, Math.max(0, level))];
};
