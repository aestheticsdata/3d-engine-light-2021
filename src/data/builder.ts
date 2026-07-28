// builders.ts
//
// This file contains small geometry helpers used to generate meshes (points + triangles).
// We keep those helpers out of data.ts so that:
// - data.ts stays readable (it should describe objects, not implement algorithms)
// - geometry generation can be reused (cube, future planes, billboards, etc.)
// - math-heavy code is isolated, easier to test and evolve
//
// -----------------------------------------------------------------------------
// Why subdivision for textured quads?
// -----------------------------------------------------------------------------
// The renderer maps textures on triangles using a 2D canvas affine transform.
// Affine texture mapping is fast, but it is NOT perspective-correct.
// When a face rotates in 3D, perspective should "compress" parts of the texture
// differently across the surface. An affine transform cannot reproduce this,
// which causes visible texture warping/stretching.
//
// A pragmatic workaround is to subdivide each large quad into many small triangles.
// Each small triangle is still affinely mapped, but because triangles are small,
// the approximation error becomes tiny and the warping becomes visually negligible.
//
// -----------------------------------------------------------------------------
// Mathematical note: bilinear interpolation on a quad
// -----------------------------------------------------------------------------
// A quad surface is parameterized by (u, v) in [0..1]².
// We generate a grid (grid+1 by grid+1 vertices) by interpolating between edges.
//
// For a given v (vertical parameter):
//   left(v)  = lerp(p00, p01, v)
//   right(v) = lerp(p10, p11, v)
//
// Then for a given u (horizontal parameter):
//   p(u, v)  = lerp(left(v), right(v), u)
//
// This is bilinear interpolation, producing evenly distributed points on the quad.
// UVs are assigned linearly as (u, v), so texture coordinates match geometry.
//
// -----------------------------------------------------------------------------
// Winding order / back-face culling
// -----------------------------------------------------------------------------
// The engine uses back-face culling based on projected 2D winding.
// To keep faces visible, we must output triangles with a consistent winding.
// flipWinding allows reversing the winding if a face appears "inside-out".

// -----------------------------------------------------------------------------
// Convex polyhedra from a vertex list + a face list
// -----------------------------------------------------------------------------
// The Archimedean and Catalan solids all share the same shape of definition:
// a list of vertices, and a list of faces given as vertex indices. Everything
// around that — normalizing the scale, ordering each face's vertices,
// triangulating, and getting the winding right — is identical from one solid to
// the next, so it lives here once instead of in every shape file.
//
// Faces are passed as *sets*: the indices may be in any order. We sort them
// cyclically around the face center, which removes the most tedious and
// error-prone part of writing these solids by hand.
//
// Winding: the renderer culls a triangle when its projected 2D cross product is
// <= 0 (see Triangle.render). Because screen Y points down, the triangles that
// survive are the ones whose world-space (b-a) x (c-a) points *towards* the
// center of the solid. Both hand-authored primitives (cube, pyramid) follow
// that convention; we reproduce it by flipping any face loop whose normal comes
// out pointing away from the center.
//
// A face is fan-triangulated, so all of its triangles share one color. That is
// deliberate: these solids are about their polygonal faces, and coloring the
// fan triangles individually makes a cuboctahedron read as 20 triangles rather
// than as 6 squares and 8 triangles.
// -----------------------------------------------------------------------------

export type UV = [number, number];

export type triangle =
  | [number, number, number, string]
  | [number, number, number, string, UV, UV, UV];

type Vec3 = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerp3 = (p0: number[], p1: number[], t: number) => [
  lerp(p0[0], p1[0], t),
  lerp(p0[1], p1[1], t),
  lerp(p0[2], p1[2], t),
];

const pushPoint = (points: number[][], p: number[]) => {
  points.push(p);
  return points.length - 1;
};

export const addTexturedQuadSubdiv = (args: {
  points: number[][];
  triangles: triangle[];
  p00: number[];
  p10: number[];
  p11: number[];
  p01: number[];
  tex: string;
  grid?: number;
  flipWinding?: boolean;
}) => {
  const { points, triangles, p00, p10, p11, p01, tex } = args;
  const grid = args.grid ?? 12;
  const flip = args.flipWinding ?? false;

  const idx: number[][] = [];
  for (let y = 0; y <= grid; y++) {
    const ty = y / grid;
    const row: number[] = [];
    const left = lerp3(p00, p01, ty);
    const right = lerp3(p10, p11, ty);

    for (let x = 0; x <= grid; x++) {
      const tx = x / grid;
      row.push(pushPoint(points, lerp3(left, right, tx)));
    }
    idx.push(row);
  }

  const uv = (x: number, y: number): UV => [x / grid, y / grid];

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const a = idx[y][x];
      const b = idx[y][x + 1];
      const c = idx[y + 1][x + 1];
      const d = idx[y + 1][x];

      const uva = uv(x, y);
      const uvb = uv(x + 1, y);
      const uvc = uv(x + 1, y + 1);
      const uvd = uv(x, y + 1);

      if (!flip) {
        triangles.push([a, b, c, tex, uva, uvb, uvc]);
        triangles.push([a, c, d, tex, uva, uvc, uvd]);
      } else {
        triangles.push([a, c, b, tex, uva, uvc, uvb]);
        triangles.push([a, d, c, tex, uva, uvd, uvc]);
      }
    }
  }
};

const sub3 = (a: number[], b: number[]): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const length3 = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

const normalize3 = (v: Vec3): Vec3 => {
  const len = length3(v);
  if (len < 1e-9) {
    return [0, 0, 0];
  }

  return [v[0] / len, v[1] / len, v[2] / len];
};

const centroid3 = (pts: number[][]): Vec3 => {
  const sum = pts.reduce<Vec3>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0],
  );

  return [sum[0] / pts.length, sum[1] / pts.length, sum[2] / pts.length];
};

// The solid is centered on the origin by the time this runs, so a face's
// outward direction is simply the direction of its own center.
const orderFaceVertices = (face: number[], vertices: number[][]): number[] => {
  const pts = face.map((index) => vertices[index]);
  const faceCenter = centroid3(pts);

  // Any two non-collinear spokes from the face center span the face plane.
  let normal: Vec3 = [0, 0, 0];
  for (let i = 1; i < pts.length; i += 1) {
    normal = cross3(sub3(pts[0], faceCenter), sub3(pts[i], faceCenter));
    if (length3(normal) > 1e-6) {
      break;
    }
  }

  const flipped: Vec3 = [-normal[0], -normal[1], -normal[2]];
  const outward = normalize3(dot3(normal, faceCenter) < 0 ? flipped : normal);

  // 2D frame inside the face plane, used only to sort the vertices by angle.
  const u = normalize3(sub3(pts[0], faceCenter));
  const w = cross3(outward, u);

  const ordered = face
    .map((index, i) => {
      const spoke = sub3(pts[i], faceCenter);

      return { index, angle: Math.atan2(dot3(spoke, w), dot3(spoke, u)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map((entry) => entry.index);

  // Engine convention: (b-a) x (c-a) must point back towards the center.
  const a = vertices[ordered[0]];
  const b = vertices[ordered[1]];
  const c = vertices[ordered[2]];
  if (dot3(cross3(sub3(b, a), sub3(c, a)), outward) > 0) {
    ordered.reverse();
  }

  return ordered;
};

export const addConvexPolyhedron = (args: {
  points: number[][];
  triangles: triangle[];
  vertices: number[][];
  faces: number[][];
  colorForFace: (vertexCount: number, faceIndex: number) => string;
  radius?: number;
}) => {
  const { points, triangles, vertices, faces, colorForFace } = args;
  const radius = args.radius ?? 100;

  const center = centroid3(vertices);
  const maxDistance = Math.max(
    ...vertices.map((v) => length3(sub3(v, center))),
  );
  const scale = radius / maxDistance;

  // Recentre on the origin and normalize to the requested circumradius, so
  // every solid in the family shows up at the same size as the other shapes.
  const scaled = vertices.map((v) => [
    (v[0] - center[0]) * scale,
    (v[1] - center[1]) * scale,
    (v[2] - center[2]) * scale,
  ]);

  const baseIndex = points.length;
  scaled.forEach((v) => points.push(v));

  faces.forEach((face, faceIndex) => {
    const ordered = orderFaceVertices(face, scaled);
    const color = colorForFace(face.length, faceIndex);

    for (let i = 1; i < ordered.length - 1; i += 1) {
      triangles.push([
        baseIndex + ordered[0],
        baseIndex + ordered[i],
        baseIndex + ordered[i + 1],
        color,
      ]);
    }
  });
};

// -----------------------------------------------------------------------------
// The icosahedron, as shared scaffolding
// -----------------------------------------------------------------------------
// Several solids in this folder are defined not by coordinates of their own but
// by an icosahedron's: ID takes its edge midpoints, R30 pairs its vertices with
// its face centres, kR30 raises pyramids on that. They all need the same 12
// points with the same adjacency, so it is derived here once.
//
// Adjacency is recovered rather than tabulated, which is what makes those
// solids self-checking: 12 vertices have to yield 30 edges and 20 faces, and a
// mistake anywhere shows up as a wrong count rather than as a subtly wrong
// picture.
// -----------------------------------------------------------------------------

export const PHI = (1 + Math.sqrt(5)) / 2;

// Edge length is 2 with these coordinates, and the next-closest pair of
// vertices is 4φ² ≈ 10.5 away, so this separates edges from non-edges with an
// enormous margin.
const ICOSAHEDRON_EDGE_LENGTH_SQUARED = 4;
const ICOSAHEDRON_EDGE_TOLERANCE = 1e-6;

// The 12 vertices: the *cyclic* permutations of (0, ±1, ±φ). Only the cyclic
// ones — taking all six would give 24 points and a different solid entirely.
const icosahedronVertices: number[][] = [];
[0, 1, 2].forEach((shift) => {
  [1, -1].forEach((shortSign) => {
    [1, -1].forEach((longSign) => {
      const vertex = [0, 0, 0];
      vertex[(shift + 1) % 3] = shortSign;
      vertex[(shift + 2) % 3] = longSign * PHI;
      icosahedronVertices.push(vertex);
    });
  });
});

const icosahedronAdjacent = (first: number, second: number) => {
  const a = icosahedronVertices[first];
  const b = icosahedronVertices[second];
  const squared = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  return (
    Math.abs(squared - ICOSAHEDRON_EDGE_LENGTH_SQUARED) <
    ICOSAHEDRON_EDGE_TOLERANCE
  );
};

const icosahedronEdges: number[][] = [];
const icosahedronEdgeIndices = new Map<string, number>();

icosahedronVertices.forEach((_, first) => {
  icosahedronVertices.forEach((__, second) => {
    if (second > first && icosahedronAdjacent(first, second)) {
      icosahedronEdgeIndices.set(`${first},${second}`, icosahedronEdges.length);
      icosahedronEdges.push([first, second]);
    }
  });
});

// A face is a triple of mutually adjacent vertices. On the icosahedron every
// such triple is a face, so no further filtering is needed; requiring
// first < second < third counts each one exactly once.
const icosahedronFaces: number[][] = [];
icosahedronVertices.forEach((_, first) => {
  icosahedronVertices.forEach((__, second) => {
    if (second <= first || !icosahedronAdjacent(first, second)) {
      return;
    }

    icosahedronVertices.forEach((___, third) => {
      if (
        third > second &&
        icosahedronAdjacent(second, third) &&
        icosahedronAdjacent(first, third)
      ) {
        icosahedronFaces.push([first, second, third]);
      }
    });
  });
});

export const icosahedron = {
  vertices: icosahedronVertices,
  edges: icosahedronEdges,
  faces: icosahedronFaces,
  // Index of the edge joining two vertices, for turning a face's vertices into
  // the edges around it.
  edgeIndex: (first: number, second: number) =>
    icosahedronEdgeIndices.get(
      first < second ? `${first},${second}` : `${second},${first}`,
    ) as number,
};
