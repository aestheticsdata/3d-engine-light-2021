import { addConvexPolyhedron, triangle } from "@data/builder";
import { Object3D } from "@data/types";

// Icosidodecahedron (ID) — the rectified dodecahedron, and the icosahedral
// counterpart of the cuboctahedron already in this folder: where CO's vertices
// are the midpoints of a cube's edges, ID's are the midpoints of an
// icosahedron's.
//
// 30 vertices, 60 edges, 32 faces — 20 triangles and 12 pentagons.
//
// It is built from the icosahedron rather than from a table of 30 coordinates,
// which makes the construction self-checking: the icosahedron's 30 edges have
// to produce 30 vertices, its 20 faces have to produce 20 triangles, and its
// 12 vertices have to produce 12 pentagons. Get any of the adjacency wrong and
// those counts stop matching.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Icosidodecahedron
//   https://mathworld.wolfram.com/Icosidodecahedron.html

const CIRCUMRADIUS = 100;

// Two roses, lighter on the larger faces so the pentagons read as the flats and
// the triangles as the bevels between them. The three fan triangles of a
// pentagon share its colour, or the solid reads as 60 triangles.
const PENTAGON_COLOR = "rgba(214, 112, 128, 1)";
const TRIANGLE_COLOR = "rgba(150, 60, 82, 1)";

const PHI = (1 + Math.sqrt(5)) / 2;

const AXES = [0, 1, 2];
const SIGNS = [1, -1];

// The 12 icosahedron vertices: the cyclic permutations of (0, ±1, ±φ). Only
// cyclic ones — taking all 6 permutations would give a cuboctahedron-like
// figure with 24 points instead.
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

// With these coordinates the icosahedron's edge is 2, and the next-closest pair
// of vertices is 4φ² ≈ 10.5 apart, so "squared distance is 4" separates edges
// from non-edges with an enormous margin.
const EDGE_LENGTH_SQUARED = 4;
const EDGE_TOLERANCE = 1e-6;

const edges: number[][] = [];
const edgeIndexByPair = new Map<string, number>();

const pairKey = (first: number, second: number) =>
  first < second ? `${first},${second}` : `${second},${first}`;

icosahedron.forEach((from, first) => {
  icosahedron.forEach((to, second) => {
    if (second <= first) {
      return;
    }

    if (
      Math.abs(distanceSquared(from, to) - EDGE_LENGTH_SQUARED) < EDGE_TOLERANCE
    ) {
      edgeIndexByPair.set(pairKey(first, second), edges.length);
      edges.push([first, second]);
    }
  });
});

const isEdge = (first: number, second: number) =>
  edgeIndexByPair.has(pairKey(first, second));

const edgeIndex = (first: number, second: number) =>
  edgeIndexByPair.get(pairKey(first, second)) as number;

// Step 2 of the recipe: the ID vertices *are* the icosahedron's edge midpoints.
const vertices = edges.map(([first, second]) => [
  (icosahedron[first][0] + icosahedron[second][0]) / 2,
  (icosahedron[first][1] + icosahedron[second][1]) / 2,
  (icosahedron[first][2] + icosahedron[second][2]) / 2,
]);

const faces: number[][] = [];

// Step 3: one triangle per icosahedron face. A face is a triple of mutually
// adjacent vertices — on the icosahedron every such triple is a face, so no
// filtering beyond that is needed. Requiring first < second < third counts each
// one exactly once.
icosahedron.forEach((_, first) => {
  icosahedron.forEach((__, second) => {
    if (second <= first || !isEdge(first, second)) {
      return;
    }

    icosahedron.forEach((___, third) => {
      if (third <= second || !isEdge(second, third) || !isEdge(first, third)) {
        return;
      }

      faces.push([
        edgeIndex(first, second),
        edgeIndex(second, third),
        edgeIndex(first, third),
      ]);
    });
  });
});

// Step 4: one pentagon per icosahedron vertex — its vertex figure, the five
// edge midpoints around it. The builder sorts them cyclically, so they can be
// collected in any order here.
icosahedron.forEach((_, vertex) => {
  faces.push(
    edges.reduce<number[]>((indices, [first, second], index) => {
      if (first === vertex || second === vertex) {
        indices.push(index);
      }

      return indices;
    }, []),
  );
});

const points: number[][] = [];
const triangles: triangle[] = [];

addConvexPolyhedron({
  points,
  triangles,
  vertices,
  faces,
  radius: CIRCUMRADIUS,
  colorForFace: (vertexCount) =>
    vertexCount === 5 ? PENTAGON_COLOR : TRIANGLE_COLOR,
});

const icosidodecahedron: Object3D = { points, triangles };

export default icosidodecahedron;
