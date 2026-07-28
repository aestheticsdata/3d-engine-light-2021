import { PHI, addConvexPolyhedron, icosahedron, triangle } from "@data/builder";
import { Object3D } from "@data/types";

// kisRhombic triacontahedron (kR30), better known as the disdyakis
// triacontahedron — R30 with a pyramid raised on each of its 30 rhombic faces,
// and the dual of the truncated icosidodecahedron. The densest solid in this
// family, and the icosahedral counterpart of the kisrhombic dodecahedron.
//
// 62 vertices, 180 edges, 120 triangular faces.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Disdyakis_triacontahedron
//   https://mathworld.wolfram.com/DisdyakisTriacontahedron.html

const CIRCUMRADIUS = 100;

// Two tones alternating around each pyramid. Per-triangle colour is honest here
// in a way it is not for the rhombic solids: these 120 triangles are the real
// faces, not the fan artifacts of a polygon. The alternation is what makes the
// four sides of a pyramid legible as four faces, so the tones are kept far
// apart in lightness.
const FACE_COLORS = ["rgba(126, 166, 224, 1)", "rgba(44, 74, 138, 1)"];

const AXES = [0, 1, 2];

// Placing the three orbits — the same decision as kR12, and the same answer.
//
// Raising pyramids on a *rigid* R30 gives 120 congruent triangles at any apex
// height; icosahedral symmetry alone guarantees that much, so congruence does
// not pin the height down. What singles out the disdyakis triacontahedron from
// that family is the dual condition, and meeting it moves all three orbits, not
// just the apexes. So the solid is built as the reciprocal of tID rather than
// as a tuned pyramid height, and there is no fitted constant below.
//
// tID is Archimedean: with unit edges every vertex sits at one circumradius and
// every face is a regular polygon, so the distance from the centre to a p-gonal
// face is √(R² − r_p²), where r_p = 1/(2·sin(π/p)) is that polygon's own
// circumradius — φ for the decagon, 1 for the hexagon, 1/√2 for the square.
// Reciprocating a face plane at distance d gives a dual vertex at 1/d along the
// same axis, which is all three orbits at once.
const TID_CIRCUMRADIUS_SQUARED = (31 + 12 * Math.sqrt(5)) / 4;

const reciprocalOfFacePlane = (polygonCircumradius: number) =>
  1 / Math.sqrt(TID_CIRCUMRADIUS_SQUARED - polygonCircumradius ** 2);

// Decagons sit on the 5-fold axes, hexagons on the 3-fold, squares on the
// 2-fold — so those become R30's icosahedral corners, its dodecahedral corners,
// and the new apexes respectively.
const FIVE_FOLD_RADIUS = reciprocalOfFacePlane(PHI);
const THREE_FOLD_RADIUS = reciprocalOfFacePlane(1);
const TWO_FOLD_RADIUS = reciprocalOfFacePlane(1 / Math.SQRT2);

const alongDirection = (direction: number[], radius: number) => {
  const length = Math.hypot(...direction);

  return direction.map((component) => (component / length) * radius);
};

const sumOf = (vertexIndices: number[]) =>
  AXES.map((axis) =>
    vertexIndices.reduce(
      (sum, vertex) => sum + icosahedron.vertices[vertex][axis],
      0,
    ),
  );

// 12 five-fold corners, degree 10 — the busiest vertices of the solid.
const fiveFold = icosahedron.vertices.map((vertex) =>
  alongDirection(vertex, FIVE_FOLD_RADIUS),
);

// 20 three-fold corners, degree 6, one per icosahedron face.
const threeFold = icosahedron.faces.map((face) =>
  alongDirection(sumOf(face), THREE_FOLD_RADIUS),
);

// 30 apexes, degree 4, one over each R30 rhombus — that is, one per icosahedron
// edge, along the direction of its midpoint.
const apexes = icosahedron.edges.map((edge) =>
  alongDirection(sumOf(edge), TWO_FOLD_RADIUS),
);

const vertices = [...fiveFold, ...threeFold, ...apexes];
const THREE_FOLD_OFFSET = fiveFold.length;
const APEX_OFFSET = THREE_FOLD_OFFSET + threeFold.length;

const faces: number[][] = [];
const faceTones: number[] = [];

icosahedron.edges.forEach(([first, second], edge) => {
  const apex = APEX_OFFSET + edge;

  // The rhombus under this apex, exactly as R30 builds it: the edge's two
  // endpoints are its five-fold corners, and the two icosahedron faces meeting
  // along that edge give its three-fold corners.
  const corners = icosahedron.faces.reduce<number[]>(
    (indices, face, index) => {
      if (face.includes(first) && face.includes(second)) {
        indices.push(THREE_FOLD_OFFSET + index);
      }

      return indices;
    },
    [],
  );

  // Walking the rhombus alternates tip, corner, tip, corner, so every one of
  // its four edges runs from a tip to a corner — which makes the pyramid's four
  // triangles simply the four (tip, corner) pairs, with nothing to order by
  // hand. Consecutive pairs around that walk differ in exactly one slot, so the
  // parity of the two slots alternates the tone around the pyramid.
  [first, second].forEach((tip, tipSlot) => {
    corners.forEach((corner, cornerSlot) => {
      faces.push([apex, tip, corner]);
      faceTones.push((tipSlot + cornerSlot) % 2);
    });
  });
});

const points: number[][] = [];
const triangles: triangle[] = [];

addConvexPolyhedron({
  points,
  triangles,
  vertices,
  faces,
  radius: CIRCUMRADIUS,
  colorForFace: (_vertexCount, faceIndex) => FACE_COLORS[faceTones[faceIndex]],
});

const kisRhombicTriacontahedron: Object3D = { points, triangles };

export default kisRhombicTriacontahedron;
