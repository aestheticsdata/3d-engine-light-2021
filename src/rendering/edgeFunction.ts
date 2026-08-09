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

// The three barycentric weights at one point, unnormalised — in the same
// units as signedArea2, so a caller divides once per interpolated attribute
// rather than normalising all three weights up front for values it may not
// need (a flat-shaded triangle interpolates nothing but 1/d).
export interface EdgeWeights {
  w0: number;
  w1: number;
  w2: number;
}

// w0 pairs with vertex A: it is the sub-triangle (B, C, P) opposite A, whose
// area is proportional to A's own barycentric coordinate. w1/w2 follow the
// same rotation for B and C.
export const edgeWeights = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  px: number,
  py: number,
): EdgeWeights => ({
  w0: edgeFunction(bx, by, cx, cy, px, py),
  w1: edgeFunction(cx, cy, ax, ay, px, py),
  w2: edgeFunction(ax, ay, bx, by, px, py),
});

// Inside-or-on-edge. Every triangle here is front-facing (positive area), so
// "inside" is simply all three weights non-negative — there is no second
// sign convention to also test.
export const isInside = (weights: EdgeWeights): boolean => weights.w0 >= 0 && weights.w1 >= 0 && weights.w2 >= 0;

// Affine barycentric interpolation of one scalar attribute across the
// triangle — screen-space linear, which is exactly what both an exact 1/d
// and an affine-mapped UV (the same approximation AffineTextureMapper's own
// matrix solve already makes) ask for. weights/area come from edgeWeights and
// signedArea2 above; the caller supplies each vertex's own value of the
// attribute being interpolated, in the same A/B/C order edgeWeights used.
export const interpolate = (weights: EdgeWeights, area: number, va: number, vb: number, vc: number): number =>
  (weights.w0 * va + weights.w1 * vb + weights.w2 * vc) / area;

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
export const edgeCoverage = (weights: EdgeWeights, reciprocals: EdgeReciprocals): number => {
  const distance = Math.min(weights.w0 * reciprocals.r0, weights.w1 * reciprocals.r1, weights.w2 * reciprocals.r2);

  return Math.min(1, Math.max(0, distance + 0.5));
};
