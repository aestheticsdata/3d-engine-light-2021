import MeshBuilder from "@data/builders/MeshBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";
import { Object3D } from "@data/types";

// Rewired, not converted. T21 deleted the module this file used to call into,
// so its two call sites move to MeshBuilder and its copies of AXES and SIGNS
// move to the shared table — nothing else. The conversion to a generator class,
// and the checked lookup that replaces `directionIndex`'s `as number`, belong to
// COS-368, which owns this file whole.

// kisRhombic dodecahedron (kR12), better known as the disdyakis dodecahedron —
// R12 with a pyramid raised on each of its 12 rhombic faces, which is exactly
// what Conway's `kis` operator does. It is also the dual of the truncated
// cuboctahedron, and that is how it is built here.
//
// 26 vertices, 72 edges, 48 triangular faces.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Disdyakis_dodecahedron
//   https://mathworld.wolfram.com/DisdyakisDodecahedron.html

const CIRCUMRADIUS = 100;

// A light and a dark green, alternating around each pyramid. Per-triangle
// colour is honest here in a way it is not elsewhere in this family: these 48
// triangles are the real faces of the solid, not the fan artifacts of a
// polygon. The alternation is what makes the four sides of a pyramid legible
// as four faces instead of one blurred cone, so the two tones are kept far
// apart in lightness rather than being neighbouring shades.
const FACE_COLORS = ["rgba(126, 196, 122, 1)", "rgba(54, 106, 62, 1)"];

const SQRT2 = Math.SQRT2;

// The truncated cuboctahedron's vertices are every signed permutation of these
// three values. Everything below is derived from them; there is no tuned
// constant anywhere in this file.
const SHORT = 1;
const MID = 1 + SQRT2;
const LONG = 1 + 2 * SQRT2;

// tCO's three kinds of face, each written as a plane n·x = m with n the integer
// normal. Each m is simply the largest n·x over tCO's vertex set: for n =
// (1, 1, 0) the winners are the four vertices that put MID and LONG on x and y.
const OCTAGON_PLANE = LONG; //                  n = (1, 0, 0)
const HEXAGON_PLANE = SHORT + MID + LONG; //    n = (1, 1, 1)
const SQUARE_PLANE = MID + LONG; //             n = (1, 1, 0)

const vertices: number[][] = [];
const indexByDirection = new Map<string, number>();

// Polar reciprocation about the midsphere, in one line: a face plane n·x = m of
// tCO becomes the vertex n/m of the dual. That single rule places all 26
// vertices and, crucially, fixes the apex height without a judgement call.
//
// It is worth being precise about what that costs. Raising pyramids on a
// *rigid* R12 already gives 48 congruent triangles at any apex height —
// octahedral symmetry alone guarantees that much. What singles out the
// disdyakis dodecahedron from that whole family is the dual condition, and
// meeting it also pulls the six octahedral tips in slightly: they land at
// (SHORT + MID + LONG) / LONG ≈ 1.892 times the cube coordinate, where a
// literal R12 would put them at exactly 2. Building the dual gets the apex
// height and that adjustment together; tuning an apex height over a frozen R12
// cannot reach this solid at all.
const addDualVertex = (normal: number[], planeOffset: number) => {
  indexByDirection.set(normal.join(","), vertices.length);
  vertices.push(normal.map((component) => component / planeOffset));
};

const directionIndex = (direction: number[]) =>
  indexByDirection.get(direction.join(",")) as number;

// 8 cube corners, dual to tCO's hexagons. Degree 6 here: three R12 edges plus
// one new edge to each of the three pyramids that meet on them.
SIGNS.forEach((signX) => {
  SIGNS.forEach((signY) => {
    SIGNS.forEach((signZ) => {
      addDualVertex([signX, signY, signZ], HEXAGON_PLANE);
    });
  });
});

// 6 octahedral tips, dual to tCO's octagons. Degree 8, the busiest vertices.
AXES.forEach((axis) => {
  SIGNS.forEach((sign) => {
    const direction = [0, 0, 0];
    direction[axis] = sign;
    addDualVertex(direction, OCTAGON_PLANE);
  });
});

const faces: number[][] = [];
const faceTones: number[] = [];

// 12 apexes, dual to tCO's squares, one per R12 rhombus and therefore one per
// cuboctahedron vertex direction — the signed permutations of (1, 1, 0).
AXES.forEach((zeroAxis) => {
  const [firstAxis, secondAxis] = AXES.filter((axis) => axis !== zeroAxis);

  SIGNS.forEach((firstSign) => {
    SIGNS.forEach((secondSign) => {
      const normal = [0, 0, 0];
      normal[firstAxis] = firstSign;
      normal[secondAxis] = secondSign;

      addDualVertex(normal, SQUARE_PLANE);
      const apex = directionIndex(normal);

      // The rhombus this pyramid stands on. Its two tips sit on the apex's two
      // live axes; its two corners agree with the apex on those axes and
      // differ only in the sign of the axis the apex ignores. Cyclically the
      // rhombus alternates corner, tip, corner, tip.
      const tips = [firstAxis, secondAxis].map((axis) => {
        const direction = [0, 0, 0];
        direction[axis] = normal[axis];

        return directionIndex(direction);
      });

      const corners = SIGNS.map((zeroSign) => {
        const direction = [...normal];
        direction[zeroAxis] = zeroSign;

        return directionIndex(direction);
      });

      // Because of that alternation every one of the rhombus's four edges runs
      // from a corner to a tip, so the pyramid's four triangles are just the
      // four (corner, tip) pairs — no ordering to get right by hand. Walking
      // the rhombus visits those pairs as 00, 10, 11, 01, so the parity of the
      // two slots alternates the tone around the pyramid.
      corners.forEach((corner, cornerSlot) => {
        tips.forEach((tip, tipSlot) => {
          faces.push([apex, corner, tip]);
          faceTones.push((cornerSlot + tipSlot) % 2);
        });
      });
    });
  });
});

const builder = new MeshBuilder();

builder.addConvexPolyhedron({
  vertices,
  faces,
  radius: CIRCUMRADIUS,
  colorForFace: (_vertexCount, faceIndex) => FACE_COLORS[faceTones[faceIndex]],
});

const kisRhombicDodecahedron: Object3D = builder.mesh;

export default kisRhombicDodecahedron;
