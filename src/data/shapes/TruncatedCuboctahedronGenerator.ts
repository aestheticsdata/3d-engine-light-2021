// Truncated cuboctahedron (tCO), also called the great rhombicuboctahedron or
// the omnitruncated cube. Its 26 faces sit on the 26 axes of the cube: an
// octagon on each face axis, a hexagon on each corner axis, a square on each
// edge axis. It is the dual of the kisrhombic dodecahedron in this folder — that
// solid is built by reciprocating the face planes derived here.
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

import MeshBuilder from "@data/builders/MeshBuilder";
import PolyhedronBuilder from "@data/builders/PolyhedronBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";

import type { Object3D } from "@data/types";

const CIRCUMRADIUS = 100;

// Warm ambers, one per face type. The fan triangles of a face must all share
// its colour, or the solid reads as 92 triangles instead of 26 faces. Lightest
// on the octagons so the cube underneath the truncation stays legible.
const OCTAGON_COLOR = "rgba(224, 170, 88, 1)";
const HEXAGON_COLOR = "rgba(186, 122, 55, 1)";
const SQUARE_COLOR = "rgba(138, 80, 40, 1)";

// The three magnitudes. Every vertex uses each of them exactly once, on some
// axis and with some sign, which is what "all permutations of (±1, ±(1+√2),
// ±(1+2√2))" means.
const MAGNITUDES = [1, 1 + Math.SQRT2, 1 + 2 * Math.SQRT2];

// The 6 ways to hand the three magnitudes to the three axes. Written out rather
// than generated: six rows are easier to check by eye than a recursion.
const ORDERINGS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

// Unlike the rhombic dodecahedron these coordinates are irrational, so the
// furthest-along-the-normal test needs a tolerance. A generous one is safe: the
// runner-up along any normal trails by more than 1.4 while the coordinates
// themselves are only about 4.6 long.
const REACH_TOLERANCE = 1e-6;

class TruncatedCuboctahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly polyhedron: PolyhedronBuilder;

  constructor() {
    this.builder = new MeshBuilder();
    this.polyhedron = new PolyhedronBuilder();
  }

  public build(): Object3D {
    const vertices = this.buildVertices();

    this.builder.addConvexPolyhedron({
      vertices,
      faces: this.polyhedron.facesFromNormals(vertices, this.buildFaceNormals(), REACH_TOLERANCE),
      radius: CIRCUMRADIUS,
      colorForFace: (vertexCount) => this.colorFor(vertexCount),
    });

    return this.builder.mesh;
  }

  // 6 orderings x 8 sign patterns = 48 vertices, all distinct because the three
  // magnitudes are distinct.
  private buildVertices(): number[][] {
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

    return vertices;
  }

  // The 26 face normals, in the order the colours expect: the cube's face axes
  // carry the octagons, its corner axes the hexagons, its edge axes the squares.
  private buildFaceNormals(): number[][] {
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

    return normals;
  }

  private colorFor(vertexCount: number): string {
    if (vertexCount === 8) {
      return OCTAGON_COLOR;
    }

    return vertexCount === 6 ? HEXAGON_COLOR : SQUARE_COLOR;
  }
}

export default TruncatedCuboctahedronGenerator;
