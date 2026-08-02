// Cuboctahedron (CO) — the rectified cube. Conway builds it by "marrying" a
// cube and its dual octahedron so that corresponding edges cross at right
// angles; the intersection of the two is this solid. Equivalently, and much
// easier to write down: its vertices are the midpoints of a cube's 12 edges.
//
// 12 vertices, 24 edges, 14 faces — 8 triangles and 6 squares.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Cuboctahedron
//   https://mathworld.wolfram.com/Cuboctahedron.html

import MeshBuilder from "@data/builders/MeshBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";

import type { Object3D } from "@data/types";

// Not exposed through an options interface: the circumradius is what puts every
// solid in this family on screen at the same size as its siblings, and a caller
// that could change one could make two of them disagree.
const CIRCUMRADIUS = 100;

// The two blues of the Archimedean row on the book's page.
const SQUARE_COLOR = "rgba(72, 160, 205, 1)";
const TRIANGLE_COLOR = "rgba(38, 106, 150, 1)";

class CuboctahedronGenerator {
  private readonly builder: MeshBuilder;

  constructor() {
    this.builder = new MeshBuilder();
  }

  public build(): Object3D {
    const vertices = this.buildVertices();

    this.builder.addConvexPolyhedron({
      vertices,
      faces: this.buildFaces(vertices),
      radius: CIRCUMRADIUS,
      colorForFace: (vertexCount) => (vertexCount === 4 ? SQUARE_COLOR : TRIANGLE_COLOR),
    });

    return this.builder.mesh;
  }

  // The 12 permutations of (±1, ±1, 0).
  private buildVertices(): number[][] {
    const vertices: number[][] = [];

    AXES.forEach((zeroAxis) => {
      const [firstAxis, secondAxis] = AXES.filter((axis) => axis !== zeroAxis);

      SIGNS.forEach((firstSign) => {
        SIGNS.forEach((secondSign) => {
          const vertex = [0, 0, 0];
          vertex[firstAxis] = firstSign;
          vertex[secondAxis] = secondSign;
          vertices.push(vertex);
        });
      });
    });

    return vertices;
  }

  // Faces are given as unordered index sets; the builder sorts each one
  // cyclically and fixes the winding.
  private buildFaces(vertices: number[][]): number[][] {
    const faces: number[][] = [];

    // 6 squares, one per cube-face direction: the 4 vertices sharing that
    // coordinate. For x = +1 that is (1,1,0) (1,-1,0) (1,0,1) (1,0,-1).
    AXES.forEach((axis) => {
      SIGNS.forEach((sign) => {
        faces.push(this.indicesWhere(vertices, (vertex) => vertex[axis] === sign));
      });
    });

    // 8 triangles, one per octant: the 3 vertices whose nonzero coordinates all
    // agree with that octant. For (+,+,+) that is (1,1,0) (0,1,1) (1,0,1).
    SIGNS.forEach((signX) => {
      SIGNS.forEach((signY) => {
        SIGNS.forEach((signZ) => {
          const octant = [signX, signY, signZ];

          faces.push(
            this.indicesWhere(vertices, (vertex) =>
              vertex.every((value, axis) => value === 0 || value === octant[axis]),
            ),
          );
        });
      });
    });

    return faces;
  }

  private indicesWhere(vertices: number[][], predicate: (vertex: number[]) => boolean): number[] {
    return vertices.reduce<number[]>((indices, vertex, index) => {
      if (predicate(vertex)) {
        indices.push(index);
      }

      return indices;
    }, []);
  }
}

export default CuboctahedronGenerator;
