// Sutherland-Hodgman against the single near plane, in camera space, before
// projection — the split half of the whole-triangle reject Camera.clips()
// still does for the far plane (COS-418/E2b splits near only; the far plane
// is inert by construction, see Camera.ts).
//
// Pure and stateless beside the class that calls it, the same pair
// fogCurve.ts/Fog.ts and lightDirection.ts/Lighting.ts already make: the walk
// is the half worth asserting, and pnpm test runs in node.

// x/y/z is the camera-space position Point3D already holds pre-projection;
// u/v is the same triangle's UV at that vertex. Interpolating both at the
// same t is what keeps a texture's mapping continuous across the cut.
export interface ClipVertex {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
}

// d = z + eyeDistance is the same depth Camera's near/far planes are
// expressed in (Camera.depthAt, private there — this is the one other place
// that needs it, so it is re-derived rather than exposed).
const depthOf = (vertex: ClipVertex, eyeDistance: number): number => vertex.z + eyeDistance;

const intersectNear = (from: ClipVertex, to: ClipVertex, near: number, eyeDistance: number): ClipVertex => {
  const t = (near - depthOf(from, eyeDistance)) / (depthOf(to, eyeDistance) - depthOf(from, eyeDistance));

  return {
    x: from.x + t * (to.x - from.x),
    y: from.y + t * (to.y - from.y),
    z: from.z + t * (to.z - from.z),
    u: from.u + t * (to.u - from.u),
    v: from.v + t * (to.v - from.v),
  };
};

// Walks the triangle's three edges in winding order, so the polygon this
// returns keeps it — a straddling triangle must come back facing the same
// way it went in, or the backface test downstream would flip on exactly the
// triangles this exists to fix. 0 vertices (nothing survives), 3 (untouched,
// or the one-in-front case's single new triangle) or 4 (the two-in-front
// quad) are the only possible outputs: a triangle clipped by one plane
// cannot grow past four sides. The caller fan-triangulates a 4-vertex result
// from index 0.
export const clipTriangleToNear = (
  vertices: readonly [ClipVertex, ClipVertex, ClipVertex],
  near: number,
  eyeDistance: number,
): ClipVertex[] => {
  const polygon: ClipVertex[] = [];

  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const currentIn = depthOf(current, eyeDistance) >= near;
    const nextIn = depthOf(next, eyeDistance) >= near;

    if (currentIn) {
      polygon.push(current);
    }

    if (currentIn !== nextIn) {
      polygon.push(intersectNear(current, next, near, eyeDistance));
    }
  }

  return polygon;
};
