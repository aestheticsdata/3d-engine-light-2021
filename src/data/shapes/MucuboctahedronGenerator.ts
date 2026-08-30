// Mucuboctahedron (muCO), an infinite skew polyhedron — p. 337, "Their
// Archimedean Relatives". Vertex configuration 6.4.6.4: two squares and two
// hexagons alternating around every vertex.
//
// NOT A SOLID. It is a periodic sponge on the cubic lattice, so it has no
// circumradius and Euler's formula does not apply. A finite chunk is rendered,
// which is what the book's own figure shows.
//
// THE CONSTRUCTION, in Conway's own words (p. 336): "The faces are the squares
// of our truncated octahedra together with half their hexagons, namely those
// separating 0 and 1 or 2 and 3 but not 0 and 3 or 2 and 1."
//
// The truncated octahedra are the cells of the bitruncated cubic honeycomb —
// the Kelvin foam — one per point of a body-centred cubic lattice. Every one of
// its edges carries exactly three faces, a square and two hexagons, so keeping
// the square and exactly one of the two hexagons is what leaves every edge with
// the two faces a surface needs. That is why the halving is forced rather than
// chosen, and the other half of the hexagons are the sponge's openings.
//
// WHICH HALF, without needing Conway's 0/1/2/3 node labels: a hexagon joins a
// cell to its neighbour in direction s, one of the eight (+-1, +-1, +-1). Seen
// from a cell of the plain cubic lattice it is a face exactly when the three
// signs multiply to -1, and seen from a body-centred cell exactly when they
// multiply to +1. The two rules select the same set of faces, and that set is
// Conway's.
//
// THE TWO LABYRINTHS. The surface separates space into two interpenetrating
// halves rather than enclosing anything, and every face has one on each side —
// which is what SkewApeirohedronBuilder needs to wind them consistently. A cell
// belongs to one half or the other by the parity of its lattice index, and the
// neighbour across any kept face always has the opposite parity.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, pp. 336-337
//   https://en.wikipedia.org/wiki/Skew_apeirohedron
//   https://en.wikipedia.org/wiki/Bitruncated_cubic_honeycomb

import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Cells of the plain cubic lattice per axis; the body-centred cells come with
// them, so the chunk holds twice this cubed truncated octahedra. Two matches
// the block the book's figure shows. Exposed so the density can be tuned
// without touching the generator, exactly as menger's level is.
const DEFAULT_CELLS_PER_AXIS = 2;

// The lattice spacing in the integer frame the whole construction is written
// in: cells at 4*(i, j, k), body-centred cells at 4*(i, j, k) + (2, 2, 2), and
// each cell's 24 vertices at the signed permutations of (0, +-1, +-2). Edge
// length is therefore sqrt(2), which the final scaling makes irrelevant.
const CELL_PITCH = 4;
const BODY_CENTRE_OFFSET = 2;

// The book's plate paints these in golds, and this is the deeper of the two.
// The inner tones are the same hues dropped in value: the openings show the far
// side of the surface, and shading it apart from the outer skin is what makes a
// tunnel read as a tunnel rather than as a hole in the silhouette.
const SQUARE_OUTER = "rgba(236, 172, 66, 1)";
const HEXAGON_OUTER = "rgba(202, 130, 40, 1)";
const SQUARE_INNER = "rgba(122, 78, 28, 1)";
const HEXAGON_INNER = "rgba(92, 55, 18, 1)";

// One hexagonal face of a truncated octahedron, as offsets from its centre,
// walked in order around the ring. Every consecutive pair differs by sqrt(2),
// and all six sum to 3, which is the plane the face lies in.
const HEXAGON_RING = [
  [2, 1, 0],
  [1, 2, 0],
  [0, 2, 1],
  [0, 1, 2],
  [1, 0, 2],
  [2, 0, 1],
];

// A square face's four offsets in the two axes that are not its own, in ring
// order.
const SQUARE_RING = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export interface MucuboctahedronOptions {
  cellsPerAxis?: number;
}

class MucuboctahedronGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly cellsPerAxis: number;

  constructor(options: MucuboctahedronOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.cellsPerAxis = options.cellsPerAxis ?? DEFAULT_CELLS_PER_AXIS;
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.sides, tone.inner),
    });
  }

  // Both lattices over the same index range: the plain cubic cells and the
  // body-centred ones that sit in the gaps between them.
  private buildCells(): SkewCell[] {
    const cells: SkewCell[] = [];

    for (let i = 0; i < this.cellsPerAxis; i += 1) {
      for (let j = 0; j < this.cellsPerAxis; j += 1) {
        for (let k = 0; k < this.cellsPerAxis; k += 1) {
          const base = [i * CELL_PITCH, j * CELL_PITCH, k * CELL_PITCH];
          const sideA = (i + j + k) % 2 === 0;

          cells.push({ centre: base, sideA, faces: this.facesOf(false) });
          cells.push({
            centre: base.map((axis) => axis + BODY_CENTRE_OFFSET),
            sideA,
            faces: this.facesOf(true),
          });
        }
      }
    }

    return cells;
  }

  // Offsets from the cell centre, so the two cell types are each built once
  // rather than per lattice position.
  private facesOf(bodyCentred: boolean): number[][][] {
    return [...this.squares(), ...this.hexagons(bodyCentred)];
  }

  // All six, always: the squares are never openings.
  private squares(): number[][][] {
    const squares: number[][][] = [];

    AXES.forEach((axis) => {
      const [first, second] = [(axis + 1) % 3, (axis + 2) % 3];

      SIGNS.forEach((sign) => {
        squares.push(
          SQUARE_RING.map((offset) => {
            const point = [0, 0, 0];
            point[axis] = 2 * sign;
            point[first] = offset[0];
            point[second] = offset[1];

            return point;
          }),
        );
      });
    });

    return squares;
  }

  // Four of the eight. The other four are the openings.
  private hexagons(bodyCentred: boolean): number[][][] {
    const kept = bodyCentred ? 1 : -1;
    const hexagons: number[][][] = [];

    SIGNS.forEach((signX) => {
      SIGNS.forEach((signY) => {
        SIGNS.forEach((signZ) => {
          if (signX * signY * signZ !== kept) {
            return;
          }

          const signs = [signX, signY, signZ];
          hexagons.push(HEXAGON_RING.map((offset) => AXES.map((axis) => signs[axis] * offset[axis])));
        });
      });
    });

    return hexagons;
  }

  private colorFor(sides: number, inner: boolean): string {
    if (sides === 4) {
      return inner ? SQUARE_INNER : SQUARE_OUTER;
    }

    return inner ? HEXAGON_INNER : HEXAGON_OUTER;
  }
}

export default MucuboctahedronGenerator;
