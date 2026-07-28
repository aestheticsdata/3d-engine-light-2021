import { addConvexPolyhedron, triangle } from "@data/builder";
import { Object3D } from "@data/types";

// Rhombic triacontahedron (R30) — the son of the dodecahedron-icosahedron
// marriage, and the icosahedral twin of the rhombic dodecahedron already in
// this folder: the convex hull of a dodecahedron and its dual icosahedron, and
// the dual of ID. Where ID has a vertex, R30 has a face.
//
// 32 vertices, 60 edges, 30 golden rhombi (diagonal ratio φ).
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Rhombic_triacontahedron
//   https://mathworld.wolfram.com/RhombicTriacontahedron.html

const CIRCUMRADIUS = 100;

// Five tones, one per cube inscribed in the dodecahedron — see the grouping
// below. All 30 faces are the same rhombus, so a single colour would flatten
// the solid; this splits them the way its symmetry already does. Both triangles
// of a rhombus always match, because the builder colours per face.
const FACE_COLORS = [
  "rgba(122, 206, 198, 1)",
  "rgba(90, 176, 172, 1)",
  "rgba(62, 144, 146, 1)",
  "rgba(42, 112, 118, 1)",
  "rgba(28, 82, 92, 1)",
];

const PHI = (1 + Math.sqrt(5)) / 2;

const AXES = [0, 1, 2];
const SIGNS = [1, -1];

// The 12 icosahedron vertices: the cyclic permutations of (0, ±1, ±φ), same
// scaffolding the icosidodecahedron is built on.
const icosahedron: number[][] = [];
AXES.forEach((shift) => {
  SIGNS.forEach((shortSign) => {
    SIGNS.forEach((longSign) => {
      const vertex = [0, 0, 0];
      vertex[(shift + 1) % 3] = shortSign;
      vertex[(shift + 2) % 3] = longSign * PHI;
      icosahedron.push(vertex);
    });
  });
});

const distanceSquared = (a: number[], b: number[]) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Edge length 2 with these coordinates; the next-closest pair is 4φ² ≈ 10.5
// away, so this separates edges from non-edges with a wide margin.
const EDGE_LENGTH_SQUARED = 4;
const EDGE_TOLERANCE = 1e-6;

const pairKey = (first: number, second: number) =>
  first < second ? `${first},${second}` : `${second},${first}`;

const edges: number[][] = [];
const isEdge = (first: number, second: number) =>
  Math.abs(
    distanceSquared(icosahedron[first], icosahedron[second]) -
      EDGE_LENGTH_SQUARED,
  ) < EDGE_TOLERANCE;

icosahedron.forEach((_, first) => {
  icosahedron.forEach((__, second) => {
    if (second > first && isEdge(first, second)) {
      edges.push([first, second]);
    }
  });
});

// The icosahedron's 20 faces, as triples of mutually adjacent vertices.
const icosahedronFaces: number[][] = [];
icosahedron.forEach((_, first) => {
  icosahedron.forEach((__, second) => {
    if (second <= first || !isEdge(first, second)) {
      return;
    }

    icosahedron.forEach((___, third) => {
      if (third > second && isEdge(second, third) && isEdge(first, third)) {
        icosahedronFaces.push([first, second, third]);
      }
    });
  });
});

// The dual dodecahedron, one vertex per icosahedron face — and this is the
// ratio the whole solid turns on.
//
// The face centre itself does *not* work. Take the rhombus whose normal is
// (0, 0, 1): its two icosahedral corners are (0, ±1, φ), and its two
// dodecahedral corners are the centres of the two faces along that edge,
// mirrored in x. Reflection in x and in y are both symmetries of those four
// points, so the only plane that can hold them is z = constant — which forces
// the dodecahedral corners up to z = φ as well. Face centres sit at
// (2φ + 1)/3, so they must be scaled by 3φ / (2φ + 1), and since 2φ + 1 = φ³
// that is just 3/φ².
//
// Folding the ÷3 of the centroid into it, a dodecahedron vertex is the plain
// sum of its face's three icosahedron vertices over φ². The check that it is
// right is not this argument but the numbers it produces: the resulting
// dodecahedron lands at circumradius √3, its standard value, and every face
// comes out a planar golden rhombus.
const dodecahedron = icosahedronFaces.map((face) =>
  AXES.map(
    (axis) =>
      face.reduce((sum, vertex) => sum + icosahedron[vertex][axis], 0) /
      PHI ** 2,
  ),
);

// The two orbits, in one list: the 12 icosahedral corners keep their indices,
// the 20 dodecahedral ones follow.
const vertices = [...icosahedron, ...dodecahedron];
const DODECAHEDRON_OFFSET = icosahedron.length;

// One rhombus per icosahedron edge: the edge's two endpoints supply the
// icosahedral corners, and the two faces meeting along it supply the
// dodecahedral ones. Opposite corners of the rhombus, as the ticket describes,
// though the builder sorts them cyclically anyway.
const faces = edges.map(([first, second]) => {
  const adjacent = icosahedronFaces.reduce<number[]>((indices, face, index) => {
    if (face.includes(first) && face.includes(second)) {
      indices.push(DODECAHEDRON_OFFSET + index);
    }

    return indices;
  }, []);

  return [first, second, ...adjacent];
});

// Colouring. Each face's normal points along its edge's midpoint, and those 30
// directions are 15 axes taken twice. Those 15 axes fall into 5 mutually
// orthogonal triples — the five cubes inscribed in a dodecahedron, the classic
// picture of why the icosahedral group contains A₅. Every axis is perpendicular
// to exactly two others, so collecting the triples is a simple sweep.
const faceAxes = edges.map(([first, second]) => {
  const direction = AXES.map(
    (axis) => icosahedron[first][axis] + icosahedron[second][axis],
  );
  const length = Math.hypot(...direction);

  return direction.map((component) => component / length);
});

const ALIGNMENT_TOLERANCE = 1e-6;

const faceColorIndex: number[] = new Array(faces.length).fill(-1);
let cubeCount = 0;

faceAxes.forEach((axis, index) => {
  if (faceColorIndex[index] !== -1) {
    return;
  }

  // This face, its antipode, and the two other axes of the same cube with
  // their antipodes: six faces, one colour. Unit vectors, so an absolute dot of
  // 1 means the same axis and 0 means a cube-mate.
  faceAxes.forEach((other, otherIndex) => {
    if (faceColorIndex[otherIndex] !== -1) {
      return;
    }

    const alignment = Math.abs(dot(axis, other));
    if (alignment > 1 - ALIGNMENT_TOLERANCE || alignment < ALIGNMENT_TOLERANCE) {
      faceColorIndex[otherIndex] = cubeCount;
    }
  });

  cubeCount += 1;
});

const points: number[][] = [];
const triangles: triangle[] = [];

addConvexPolyhedron({
  points,
  triangles,
  vertices,
  faces,
  radius: CIRCUMRADIUS,
  colorForFace: (_vertexCount, faceIndex) =>
    FACE_COLORS[faceColorIndex[faceIndex]],
});

const rhombicTriacontahedron: Object3D = { points, triangles };

export default rhombicTriacontahedron;
