import { addConvexPolyhedron, triangle } from "@data/builder";
import { Object3D } from "@data/types";

// Rhombic dodecahedron (R12) — the *son* of the cube–octahedron marriage: the
// convex hull of a cube and its dual octahedron, and the dual of the
// cuboctahedron. Where CO has a vertex, R12 has a face, which is why the two
// solids are built from the same 12 directions.
//
// 14 vertices, 24 edges, 12 rhombic faces.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Rhombic_dodecahedron
//   https://mathworld.wolfram.com/RhombicDodecahedron.html

const CIRCUMRADIUS = 100;

// Three tones of one hue, keyed to the axis each face's normal ignores. All 12
// faces are the same rhombus, so a single colour would flatten the solid; this
// splits them into the three groups of four that share an axis, which is the
// structure worth seeing. Both triangles of a rhombus always match, because the
// builder colours per face rather than per triangle.
const FACE_COLORS = [
  "rgba(139, 106, 196, 1)",
  "rgba(108, 79, 163, 1)",
  "rgba(78, 54, 124, 1)",
];

const AXES = [0, 1, 2];
const SIGNS = [1, -1];

// Two orbits. The cube's 8 corners are 3-valent, the octahedron's 6 are
// 4-valent. The factor 2 on the octahedron is not a free parameter: it is what
// makes corresponding edges of the two solids cross at right angles, and
// therefore what makes every face a planar rhombus. Change it and the faces
// buckle.
const vertices: number[][] = [];

SIGNS.forEach((signX) => {
  SIGNS.forEach((signY) => {
    SIGNS.forEach((signZ) => {
      vertices.push([signX, signY, signZ]);
    });
  });
});

AXES.forEach((axis) => {
  SIGNS.forEach((sign) => {
    const vertex = [0, 0, 0];
    vertex[axis] = 2 * sign;
    vertices.push(vertex);
  });
});

// One face per cuboctahedron vertex direction — the 12 permutations of
// (±1, ±1, 0). Keeping the zeroed axis alongside each normal is what lets the
// colouring group the faces later.
const normals: { normal: number[]; zeroAxis: number }[] = [];
AXES.forEach((zeroAxis) => {
  const [firstAxis, secondAxis] = AXES.filter((axis) => axis !== zeroAxis);

  SIGNS.forEach((firstSign) => {
    SIGNS.forEach((secondSign) => {
      const normal = [0, 0, 0];
      normal[firstAxis] = firstSign;
      normal[secondAxis] = secondSign;
      normals.push({ normal, zeroAxis });
    });
  });
});

const dot = (vertex: number[], normal: number[]) =>
  vertex[0] * normal[0] + vertex[1] * normal[1] + vertex[2] * normal[2];

// A face is the set of vertices furthest along its normal. Every coordinate
// here is an integer, so the maximum is exact and needs no tolerance. For
// (1, 1, 0) the winners are (1,1,1), (1,1,-1), (2,0,0) and (0,2,0) — two cube
// corners and two octahedron tips, all on the plane x + y = 2.
//
// The builder takes these as unordered sets: it sorts each one cyclically and
// fixes the winding, so there is nothing to get right by hand here.
const faces = normals.map(({ normal }) => {
  const reach = Math.max(...vertices.map((vertex) => dot(vertex, normal)));

  return vertices.reduce<number[]>((indices, vertex, index) => {
    if (dot(vertex, normal) === reach) {
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
  colorForFace: (_vertexCount, faceIndex) =>
    FACE_COLORS[normals[faceIndex].zeroAxis],
});

const rhombicDodecahedron: Object3D = { points, triangles };

export default rhombicDodecahedron;
