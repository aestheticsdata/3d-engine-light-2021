// Whether a screen-space polygon can possibly touch the visible frame, tested
// against its own axis-aligned bounding box rather than its exact edges.
//
// A bounding-box test can only produce a false positive — a polygon whose box
// overlaps the frame but whose actual edges do not — never a false negative,
// and GroundFloor's polygons are already convex (Sutherland-Hodgman clipping
// a convex quad against one half-plane in GroundNearClip stays convex), so
// the box is exactly the shape's own extent. A false positive costs one
// canvas fill that would have run anyway; a false negative would be a hole in
// the floor.

export const isPolygonOnScreen = (
  points: readonly { x: number; y: number }[],
  width: number,
  height: number,
): boolean => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return maxX >= 0 && minX <= width && maxY >= 0 && minY <= height;
};
