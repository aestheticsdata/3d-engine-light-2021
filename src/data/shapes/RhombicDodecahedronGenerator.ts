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

import MeshBuilder from "@data/builders/MeshBuilder";
import PolyhedronBuilder from "@data/builders/PolyhedronBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";
import { Object3D } from "@data/types";

const CIRCUMRADIUS = 100;

// Every coordinate here is an integer, so the furthest-along-the-normal test is
// exact and the tolerance is zero. Passed explicitly rather than defaulted, so
// this file and the truncated cuboctahedron beside it visibly disagree about it
// on purpose: admitting a near-miss here would pull a fifth vertex into a
// four-vertex face and the cyclic sort would triangulate a buckled rhombus.
const REACH_TOLERANCE = 0;

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

// The normal and the axis it zeroes travel together in one record. They were two
// arrays rejoined by index, which is one careless `push` away from colouring
// every face wrong.
interface FaceNormal {
  normal: number[];
  zeroAxis: number;
}

class RhombicDodecahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly polyhedron: PolyhedronBuilder;

  constructor() {
    this.builder = new MeshBuilder();
    this.polyhedron = new PolyhedronBuilder();
  }

  public build(): Object3D {
    const vertices = this.buildVertices();
    const normals = this.buildFaceNormals();

    this.builder.addConvexPolyhedron({
      vertices,
      faces: this.polyhedron.facesFromNormals(
        vertices,
        normals.map((entry) => entry.normal),
        REACH_TOLERANCE,
      ),
      radius: CIRCUMRADIUS,
      colorForFace: (_vertexCount, faceIndex) =>
        FACE_COLORS[normals[faceIndex].zeroAxis],
    });

    return this.builder.mesh;
  }

  // Two orbits. The cube's 8 corners are 3-valent, the octahedron's 6 are
  // 4-valent. The factor 2 on the octahedron is not a free parameter: it is what
  // makes corresponding edges of the two solids cross at right angles, and
  // therefore what makes every face a planar rhombus. Change it and the faces
  // buckle.
  private buildVertices(): number[][] {
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

    return vertices;
  }

  // One face per cuboctahedron vertex direction — the 12 permutations of
  // (±1, ±1, 0). For (1, 1, 0) the winners are (1,1,1), (1,1,-1), (2,0,0) and
  // (0,2,0) — two cube corners and two octahedron tips, all on x + y = 2.
  private buildFaceNormals(): FaceNormal[] {
    const normals: FaceNormal[] = [];

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

    return normals;
  }
}

export default RhombicDodecahedronGenerator;
