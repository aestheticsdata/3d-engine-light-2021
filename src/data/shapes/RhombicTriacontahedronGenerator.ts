// Rhombic triacontahedron (R30) — the son of the dodecahedron–icosahedron
// marriage, and the icosahedral twin of the rhombic dodecahedron in this folder:
// the convex hull of a dodecahedron and its dual icosahedron, and the dual of
// ID. Where ID has a vertex, R30 has a face.
//
// 32 vertices, 60 edges, 30 golden rhombi (diagonal ratio φ).
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Rhombic_triacontahedron
//   https://mathworld.wolfram.com/RhombicTriacontahedron.html

import Icosahedron, { PHI } from "@data/builders/Icosahedron";
import MeshBuilder from "@data/builders/MeshBuilder";
import Vec3Math from "@data/builders/Vec3Math";
import { AXES } from "@data/builders/symmetry";
import { Object3D } from "@data/types";

const CIRCUMRADIUS = 100;

// Five tones, one per cube inscribed in the dodecahedron — see the grouping
// below. All 30 faces are the same rhombus, so a single colour would flatten the
// solid; this splits them the way its symmetry already does. Both triangles of a
// rhombus always match, because the builder colours per face.
const FACE_COLORS = [
  "rgba(122, 206, 198, 1)",
  "rgba(90, 176, 172, 1)",
  "rgba(62, 144, 146, 1)",
  "rgba(42, 112, 118, 1)",
  "rgba(28, 82, 92, 1)",
];

// Unit vectors, so an absolute dot of 1 means the same axis and 0 means a
// cube-mate.
const ALIGNMENT_TOLERANCE = 1e-6;

const UNGROUPED = -1;

class RhombicTriacontahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly vec: Vec3Math;
  private readonly icosahedron: Icosahedron;

  constructor(icosahedron: Icosahedron = new Icosahedron()) {
    this.builder = new MeshBuilder();
    this.vec = new Vec3Math();
    this.icosahedron = icosahedron;
  }

  public build(): Object3D {
    // The two orbits, in one list: the 12 icosahedral corners keep their
    // indices, the 20 dodecahedral ones follow. The icosahedron's rows are
    // copied rather than aliased, so nothing downstream can write through them.
    const vertices = [
      ...this.icosahedron.vertices.map((vertex) => [...vertex]),
      ...this.buildDodecahedron(),
    ];
    const groups = this.groupFacesByCube();

    this.builder.addConvexPolyhedron({
      vertices,
      faces: this.buildFaces(),
      radius: CIRCUMRADIUS,
      colorForFace: (_vertexCount, faceIndex) =>
        FACE_COLORS[this.colorIndexAt(groups, faceIndex)],
    });

    return this.builder.mesh;
  }

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
  private buildDodecahedron(): number[][] {
    return this.icosahedron.faces.map((face) =>
      AXES.map(
        (axis) =>
          face.reduce(
            (sum, vertex) => sum + this.icosahedron.vertices[vertex][axis],
            0,
          ) /
          PHI ** 2,
      ),
    );
  }

  // One rhombus per icosahedron edge: the edge's two endpoints supply the
  // icosahedral corners, and the two faces meeting along it supply the
  // dodecahedral ones. Opposite corners of the rhombus, as it happens, though
  // the builder sorts them cyclically anyway.
  private buildFaces(): number[][] {
    const dodecahedronOffset = this.icosahedron.vertices.length;

    return this.icosahedron.edges.map(([first, second]) => {
      const adjacent = this.icosahedron.faces.reduce<number[]>(
        (indices, face, index) => {
          if (face.includes(first) && face.includes(second)) {
            indices.push(dodecahedronOffset + index);
          }

          return indices;
        },
        [],
      );

      return [first, second, ...adjacent];
    });
  }

  // Each face's normal points along its edge's midpoint, and those 30
  // directions are 15 axes taken twice. Those 15 axes fall into 5 mutually
  // orthogonal triples — the five cubes inscribed in a dodecahedron, the classic
  // picture of why the icosahedral group contains A₅. Every axis is
  // perpendicular to exactly two others, so collecting the triples is a sweep:
  // a face, its antipode, and the two other axes of the same cube with their
  // antipodes make six faces of one colour.
  private groupFacesByCube(): number[] {
    const axes = this.buildFaceAxes();
    const groups: number[] = new Array(axes.length).fill(UNGROUPED);
    let cubeCount = 0;

    axes.forEach((axis, index) => {
      if (groups[index] !== UNGROUPED) {
        return;
      }

      axes.forEach((other, otherIndex) => {
        if (groups[otherIndex] !== UNGROUPED) {
          return;
        }

        const alignment = Math.abs(this.vec.dot(axis, other));
        if (
          alignment > 1 - ALIGNMENT_TOLERANCE ||
          alignment < ALIGNMENT_TOLERANCE
        ) {
          groups[otherIndex] = cubeCount;
        }
      });

      cubeCount += 1;
    });

    return groups;
  }

  private buildFaceAxes(): number[][] {
    return this.icosahedron.edges.map(([first, second]) => {
      const direction = AXES.map(
        (axis) =>
          this.icosahedron.vertices[first][axis] +
          this.icosahedron.vertices[second][axis],
      );
      const length = Math.hypot(...direction);

      return direction.map((component) => component / length);
    });
  }

  // Guarded, because the sweep leaving a face ungrouped used to hand the colour
  // table an index of -1: `FACE_COLORS[-1]` is `undefined`, and an undefined
  // fillStyle paints nothing rather than throwing.
  private colorIndexAt(groups: number[], faceIndex: number): number {
    const index = groups[faceIndex];

    if (index === UNGROUPED) {
      throw new Error(`R30 face ${faceIndex} was not assigned to a cube.`);
    }

    return index;
  }
}

export default RhombicTriacontahedronGenerator;
