import { addConvexPolyhedron, triangle } from "@data/builder";
import { Object3D } from "@data/types";

// Truncated cuboctahedron (tCO), also called the great rhombicuboctahedron or
// the omnitruncated cube. Its 26 faces sit on the 26 axes of the cube: an
// octagon on each face axis, a hexagon on each corner axis, a square on each
// edge axis. It is the dual of the kisrhombic dodecahedron already in this
// folder — that solid was built by reciprocating the face planes derived here.
//
// 48 vertices, 72 edges, 26 faces — 12 squares, 8 hexagons, 6 octagons.
//
// A note the book makes: literally truncating CO leaves unequal edges, so that
// construction is not strictly Archimedean. These are the adjusted uniform
// coordinates, where every edge has the same length.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Truncated_cuboctahedron
//   https://mathworld.wolfram.com/TruncatedCuboctahedron.html

const CIRCUMRADIUS = 100;

// Warm ambers, one per face type. The fan triangles of a face must all share
// its colour, or the solid reads as 92 triangles instead of 26 faces. Lightest
// on the octagons so the cube underneath the truncation stays legible.
const OCTAGON_COLOR = "rgba(224, 170, 88, 1)";
const HEXAGON_COLOR = "rgba(186, 122, 55, 1)";
const SQUARE_COLOR = "rgba(138, 80, 40, 1)";

const SQRT2 = Math.SQRT2;

// The three magnitudes. Every vertex uses each of them exactly once, on some
// axis and with some sign, which is what "all permutations of (±1, ±(1+√2),
// ±(1+2√2))" means.
const MAGNITUDES = [1, 1 + SQRT2, 1 + 2 * SQRT2];

const AXES = [0, 1, 2];
const SIGNS = [1, -1];

// The 6 ways to hand the three magnitudes to the three axes. Written out
// rather than generated: six rows are easier to check by eye than a recursion.
const ORDERINGS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

// 6 orderings x 8 sign patterns = 48 vertices, all distinct because the three
// magnitudes are distinct.
const vertices: number[][] = [];
ORDERINGS.forEach((ordering) => {
  SIGNS.forEach((signX) => {
    SIGNS.forEach((signY) => {
      SIGNS.forEach((signZ) => {
        const signs = [signX, signY, signZ];
        vertices.push(ordering.map((slot, axis) => signs[axis] * MAGNITUDES[slot]));
      });
    });
  });
});

// The 26 face normals, in the order the colours below expect: the cube's face
// axes carry the octagons, its corner axes the hexagons, its edge axes the
// squares.
const normals: number[][] = [];

AXES.forEach((axis) => {
  SIGNS.forEach((sign) => {
    const normal = [0, 0, 0];
    normal[axis] = sign;
    normals.push(normal);
  });
});

SIGNS.forEach((signX) => {
  SIGNS.forEach((signY) => {
    SIGNS.forEach((signZ) => {
      normals.push([signX, signY, signZ]);
    });
  });
});

AXES.forEach((zeroAxis) => {
  const [firstAxis, secondAxis] = AXES.filter((axis) => axis !== zeroAxis);

  SIGNS.forEach((firstSign) => {
    SIGNS.forEach((secondSign) => {
      const normal = [0, 0, 0];
      normal[firstAxis] = firstSign;
      normal[secondAxis] = secondSign;
      normals.push(normal);
    });
  });
});

const dot = (vertex: number[], normal: number[]) =>
  vertex[0] * normal[0] + vertex[1] * normal[1] + vertex[2] * normal[2];

// Same trick as the rhombic dodecahedron: a face is the set of vertices that
// reach furthest along its normal. Unlike that solid these coordinates are
// irrational, so the comparison needs a tolerance — a generous one is safe
// here, because the runner-up along any normal trails by more than 1.4 while
// the coordinates themselves are only about 4.6 long.
//
// The builder takes each face as an unordered set, sorting it cyclically and
// fixing the winding, so no vertex order has to be worked out by hand.
const REACH_TOLERANCE = 1e-6;

const faces = normals.map((normal) => {
  const reach = Math.max(...vertices.map((vertex) => dot(vertex, normal)));

  return vertices.reduce<number[]>((indices, vertex, index) => {
    if (dot(vertex, normal) > reach - REACH_TOLERANCE) {
      indices.push(index);
    }

    return indices;
  }, []);
});

const points: number[][] = [];
const triangles: triangle[] = [];

addConvexPolyhedron({
  points,
  triangles,
  vertices,
  faces,
  radius: CIRCUMRADIUS,
  colorForFace: (vertexCount) => {
    if (vertexCount === 8) {
      return OCTAGON_COLOR;
    }

    return vertexCount === 6 ? HEXAGON_COLOR : SQUARE_COLOR;
  },
});

const truncatedCuboctahedron: Object3D = { points, triangles };

export default truncatedCuboctahedron;
