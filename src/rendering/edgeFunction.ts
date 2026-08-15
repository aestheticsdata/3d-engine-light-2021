// Pineda edge-function rasterisation math for the depth-buffered rasteriser
// (E3b/COS-242) — screen-space only, in the exact winding
// Triangle.isFrontFacing already commits to: (b-a) x (c-a) > 0 is
// front-facing, so signedArea2(A,B,C) is that same cross product and every
// front-facing triangle's three edge weights are non-negative for every point
// inside it. Pure and stateless beside the class that calls it, the same pair
// nearPlaneClip.ts/Triangle.ts already make — Rasterizer.ts is the hot loop
// that cannot be asserted against directly; this arithmetic is what
// `pnpm test` actually checks.
//
// Mesh.renderMesh only ever hands the rasteriser triangles that already
// passed Triangle.isFrontFacing, so every triangle this module ever sees has
// positive area — there is no second branch here for the opposite winding to
// get wrong.

export interface ScreenBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Null when the triangle's bounding box has no candidate pixel at all —
// fully outside the buffer, or collapsed to less than one pixel once
// clamped. maxX/maxY are inclusive, which is what lets a caller loop
// `for (y = minY; y <= maxY; y++)` with no second bounds check per pixel.
export const screenBounds = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
): ScreenBounds | null => {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));

  if (minX > maxX || minY > maxY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
};

// A*x + B*y + C: zero along the edge from (ax,ay) to (bx,by), and its sign
// off that line is what both signedArea2 and edgeWeights below read.
export const edgeFunction = (ax: number, ay: number, bx: number, by: number, px: number, py: number): number =>
  (bx - ax) * (py - ay) - (by - ay) * (px - ax);

// Twice the triangle's own signed screen area — the same cross product
// Triangle.isFrontFacing already takes the sign of and Triangle.screenArea
// already halves, so a triangle Mesh.renderMesh handed the rasteriser is
// always positive here. Zero only for a degenerate, zero-area triangle,
// which the caller must guard before dividing by it.
export const signedArea2 = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number =>
  edgeFunction(ax, ay, bx, by, cx, cy);

// THE THREE WEIGHTS. Everything from here to interpolate() below is one idea:
// the barycentric weights at a pixel, unnormalised — in the same units as
// signedArea2, so a caller divides once per interpolated attribute rather than
// normalising all three up front for values it may not need (a flat-shaded
// triangle interpolates nothing but 1/d). w0 pairs with vertex A: it is the
// sub-triangle (B, C, P) opposite A, whose area is proportional to A's own
// barycentric coordinate, and w1/w2 follow the same rotation for B and C.
//
// They are computed and passed as three separate scalars rather than built into
// a record, and that is a measurement rather than a preference (E3f/3DE-116).
// The record form allocated one object per candidate pixel, and the loop that
// reads it visits on the order of a million pixels a frame at a full-window
// render target — an allocation rate no escape analysis was reliably removing.

// The half of an edge weight that does not depend on x, evaluated once per
// scanline instead of once per pixel (E3f/3DE-116).
//
// edgeFunction's expression is `(bx-ax)*(py-ay) - (by-ay)*(px-ax)`. Its first
// product is constant along a row, so edgeRowTerm IS that product and
// edgeWeightAt is the rest. Split, not rewritten: the same operands meet in the
// same operations in the same order, so the result is bit-identical to calling
// edgeFunction per pixel rather than merely close to it — which is what lets a
// pass over the pixel loop claim no visual change at all. edgeFunction stays the
// definition these two answer to, and the equivalence is pinned by a test rather
// than by this comment.
//
// `edgeDx`/`edgeDy` are the edge's own runs, `originX`/`originY` its first
// vertex — for w0 the edge is B→C and the origin is B, and w1/w2 rotate.
export const edgeRowTerm = (edgeDx: number, py: number, originY: number): number => edgeDx * (py - originY);

export const edgeWeightAt = (rowTerm: number, edgeDy: number, px: number, originX: number): number =>
  rowTerm - edgeDy * (px - originX);

// Inside-or-on-edge. Every triangle here is front-facing (positive area), so
// "inside" is simply all three weights non-negative — there is no second
// sign convention to also test.
export const isInside = (w0: number, w1: number, w2: number): boolean => w0 >= 0 && w1 >= 0 && w2 >= 0;

// Where one edge stops admitting pixels along the current scanline (E3f).
//
// An edge weight is affine in x, so `w >= 0` is a half-line whose endpoint is
// the x at which the weight reaches zero. That endpoint is itself affine in y —
// it is just the edge's own line — so the slope below is folded once per
// triangle and the endpoint costs a multiply and an add per row rather than the
// division it started as. Which side of the endpoint is admitted depends on the
// sign of the edge's dy, and the caller reads that off the same number it uses
// for the weights.
//
// Unlike edgeWeightAt this is NOT required to be exact, and it is the one place
// in the loop where that is true: the span only narrows the walk, and the caller
// rounds it outward by a whole pixel before using it, so an error in the last
// bits cannot reach a pixel. What decides whether a pixel is drawn is still the
// edge test, on the exact weights.
export const edgeSlope = (edgeDx: number, edgeDy: number): number => (edgeDy === 0 ? 0 : edgeDx / edgeDy);

export const edgeSpanBound = (originX: number, slope: number, py: number, originY: number): number =>
  originX + slope * (py - originY);

// How far ALONG A SCANLINE the feather reaches past the edge itself (E3f).
//
// EDGE ANTIALIAS keeps a pixel whose centre is up to half a pixel PERPENDICULARLY
// outside an edge. Perpendicular is the trap: the shallower the edge lies to the
// row, the further along that row the same half pixel stretches, without limit
// as the edge approaches horizontal. A flat one-pixel margin on the span is
// therefore correct only for a steep edge and loses the soft edge everywhere
// else — which is exactly what a pixel diff against the pre-E3f frames caught,
// on every shape, with EDGE ANTIALIAS on and only then.
//
// Built from the edge's dy and the reciprocal of its length, which is the one
// edgeReciprocals has already computed for this same triangle — the closed form
// in the slope is 0.5 * sqrt(1 + slope^2), and spending a second square root per
// edge to reach the same number was measurable on a mesh of many small triangles
// (the torus knot submits 8008 of them a frame).
//
// Infinity for a horizontal edge, and that is the safe direction rather than an
// oversight: such an edge constrains no x at all, and a caller that used this
// anyway would widen its span to the whole bounding box it started from.
export const edgeFeatherReach = (edgeDy: number, reciprocal: number): number => 0.5 / (Math.abs(edgeDy) * reciprocal);

// Affine barycentric interpolation of one scalar attribute across the
// triangle — screen-space linear, which is exactly what both an exact 1/d
// and an affine-mapped UV (the same approximation AffineTextureMapper's own
// matrix solve already makes) ask for. The weights and the area come from the
// two functions above and signedArea2; the caller supplies each vertex's own
// value of the attribute being interpolated, in the same A/B/C order.
export const interpolate = (
  w0: number,
  w1: number,
  w2: number,
  area: number,
  va: number,
  vb: number,
  vc: number,
): number => (w0 * va + w1 * vb + w2 * vc) / area;

// Math.hypot is the same number and roughly an order of magnitude slower — it
// rescales its arguments to survive an overflow that screen coordinates, bounded
// by the buffer, cannot reach.
const length = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy);

// EDGE ANTIALIAS's per-triangle half (E3d/COS-244). An edge weight is twice a
// sub-triangle's area, which is the perpendicular distance to that edge times
// the edge's own length, so recovering the distance means dividing the length
// back out. Reciprocals, folded once per triangle, because the alternative is
// three divisions on every boundary pixel of every triangle in the frame.
//
// r0/r1/r2 pair with w0/w1/w2, and therefore with the edge OPPOSITE each vertex:
// r0 belongs to BC, r1 to CA, r2 to AB.
export interface EdgeReciprocals {
  r0: number;
  r1: number;
  r2: number;
}

// Never a division by zero: a triangle with positive signedArea2 — the only kind
// Rasterizer gets this far with — cannot have an edge of zero length.
export const edgeReciprocals = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): EdgeReciprocals => ({
  r0: 1 / length(cx - bx, cy - by),
  r1: 1 / length(ax - cx, ay - cy),
  r2: 1 / length(bx - ax, by - ay),
});

// How much of the pixel at this point the triangle covers, from the point's
// perpendicular distance to the nearest of the three edges: a centre exactly on
// an edge is half covered, half a pixel inside it is whole, half a pixel outside
// it is not covered at all.
//
// Exact for a pixel one straight edge crosses, and an approximation at a corner,
// where two edges each take a bite out of the pixel and only the deeper one is
// counted. A corner is one pixel of a silhouette and the error there is far
// smaller than the staircase it replaces.
export const edgeCoverage = (w0: number, w1: number, w2: number, reciprocals: EdgeReciprocals): number => {
  const distance = Math.min(w0 * reciprocals.r0, w1 * reciprocals.r1, w2 * reciprocals.r2);

  return Math.min(1, Math.max(0, distance + 0.5));
};
