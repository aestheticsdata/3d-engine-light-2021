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
// the Kelvin foam — and BitruncatedCubicLattice holds them, the frame they are
// written in and their two face tables, because muO is built on the same
// honeycomb. Every one of its edges carries exactly three faces, a square and
// two hexagons, so keeping the square and exactly one of the two hexagons is
// what leaves every edge with the two faces a surface needs. That is why the
// halving is forced rather than chosen, and the other half of the hexagons are
// the sponge's openings.
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
// That parity is muCO's alone and does NOT generalise to the other sponge on
// this lattice: it is a 2-colouring only because the deleted faces here are
// hexagons, which cross between the sublattices. muO deletes the squares
// instead, and its labyrinths are the two sublattices themselves. The rule
// therefore stays in the generator rather than moving into the lattice with
// everything else.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, pp. 336-337
//   https://en.wikipedia.org/wiki/Skew_apeirohedron
//   https://en.wikipedia.org/wiki/Bitruncated_cubic_honeycomb

import BitruncatedCubicLattice from "@data/builders/BitruncatedCubicLattice";
import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Cells of the plain cubic lattice per axis; the body-centred cells come with
// them, so the chunk holds twice this cubed truncated octahedra. Two matches
// the block the book's figure shows. Exposed so the density can be tuned
// without touching the generator, exactly as menger's level is.
const DEFAULT_CELLS_PER_AXIS = 2;

// The book's plate paints these in golds, and this is the deeper of the two.
// The inner tones are the same hues dropped in value: the openings show the far
// side of the surface, and shading it apart from the outer skin is what makes a
// tunnel read as a tunnel rather than as a hole in the silhouette.
const SQUARE_OUTER = "rgba(236, 172, 66, 1)";
const HEXAGON_OUTER = "rgba(202, 130, 40, 1)";
const SQUARE_INNER = "rgba(122, 78, 28, 1)";
const HEXAGON_INNER = "rgba(92, 55, 18, 1)";

export interface MucuboctahedronOptions {
  cellsPerAxis?: number;
}

class MucuboctahedronGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly lattice: BitruncatedCubicLattice;

  constructor(options: MucuboctahedronOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.lattice = new BitruncatedCubicLattice(options.cellsPerAxis ?? DEFAULT_CELLS_PER_AXIS);
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.sides, tone.inner),
    });
  }

  private buildCells(): SkewCell[] {
    return this.lattice.cells.map((cell) => ({
      centre: cell.centre,
      sideA: (cell.index[0] + cell.index[1] + cell.index[2]) % 2 === 0,
      faces: this.facesOf(cell.bodyCentred),
    }));
  }

  // The squares are never openings, so all six of them come through untouched;
  // four of the eight hexagons follow, and the other four are the openings.
  private facesOf(bodyCentred: boolean): number[][][] {
    const kept = bodyCentred ? 1 : -1;

    return [
      ...this.lattice.squares,
      ...this.lattice.hexagons.filter((hexagon) => hexagon.signProduct === kept).map((hexagon) => hexagon.ring),
    ];
  }

  private colorFor(sides: number, inner: boolean): string {
    if (sides === 4) {
      return inner ? SQUARE_INNER : SQUARE_OUTER;
    }

    return inner ? HEXAGON_INNER : HEXAGON_OUTER;
  }
}

export default MucuboctahedronGenerator;
