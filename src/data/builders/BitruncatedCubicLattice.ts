// The bitruncated cubic honeycomb — the Kelvin foam — as shared scaffolding.
//
// Two of the skew apeirohedra in this repo are sub-complexes of one honeycomb.
// muCO keeps all six squares of every truncated octahedron and half of its eight
// hexagons; muO keeps all eight hexagons and none of the squares. The lattice
// underneath them, the cell geometry and the two face tables are the same object
// twice, so they live here rather than being spelled out in each generator.
//
// It is a class for the same reason Icosahedron is: the tables are built when a
// shape that needs them is built, not when a module is imported for a type.
//
// THE FRAME, in integers. Cells sit at 4*(i, j, k) and at 4*(i, j, k) + (2, 2, 2)
// — the body-centred cubic lattice with a cube pitch of 4 — and each cell's 24
// vertices are the signed permutations of (0, +-1, +-2). Edge length is therefore
// sqrt(2), which the final scaling makes irrelevant. Nothing here is a half, and
// nothing is irrational.
//
// WHAT IT DELIBERATELY DOES NOT OWN: which faces a sponge keeps, and which of the
// two labyrinths a cell opens into. Neither is a property of the honeycomb, and
// the second one is not even shared between the two sponges built on it — see
// below, because assuming it was is the mistake this file exists to make
// impossible.
//
// THE TWO LABYRINTHS ARE NOT THE LATTICE'S TO DECIDE. SkewApeirohedronBuilder
// orients a face from the `sideA` flag of the cell that offered it, which is only
// sound when the two cells sharing a kept face always disagree — a genuine
// 2-colouring. Which colouring that is depends on which faces were DELETED, so it
// changes from sponge to sponge on the same lattice. Counted over a block with a
// real interior:
//
//   every shared SQUARE joins two cells of the SAME sublattice (600 of 600)
//   every shared HEXAGON joins one plain cell to one body-centred cell (729 of 729)
//
// So muO, which deletes every square, has the two sublattices themselves as its
// labyrinths, and `bodyCentred` is its colouring. muCO, which deletes only
// hexagons, joins the sublattices together and needs the parity of (i + j + k)
// instead. Each rule is invalid for the other sponge — muCO's parity gets 172 of
// muO's 343 shared hexagons wrong, and muO's sublattice rule gets 288 of muCO's
// 459 shared faces wrong — which is why `index` and `bodyCentred` are both handed
// out and neither is interpreted here.
//
// References:
//   https://en.wikipedia.org/wiki/Bitruncated_cubic_honeycomb
//   https://en.wikipedia.org/wiki/Skew_apeirohedron

import { AXES, SIGNS } from "@data/builders/symmetry";

// One truncated octahedron of the honeycomb. The index and the sublattice are
// both carried because the two sponges colour their labyrinths by different ones
// of them, and neither is recoverable from `centre` without undoing the pitch.
export interface BitruncatedCubicCell {
  centre: number[];
  index: number[];
  bodyCentred: boolean;
}

// One hexagonal face, as offsets from the cell centre, with the direction that
// names it: the neighbour across it is at twice that direction.
export interface BitruncatedCubicHexagon {
  direction: number[];
  // The three signs multiplied together, which splits the eight directions into
  // the cube's two inscribed tetrahedra. muCO's half of the hexagons is exactly
  // one of those two, so this is the field its predicate reads.
  signProduct: number;
  ring: number[][];
}

const CELL_PITCH = 4;
const BODY_CENTRE_OFFSET = 2;

// One hexagonal face of a truncated octahedron, as offsets from its centre,
// walked in order around the ring. Every consecutive pair differs by sqrt(2), and
// all six sum to 3, which is the plane the face lies in.
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

const SQUARE_DISTANCE = 2;

class BitruncatedCubicLattice {
  private readonly cellTable: BitruncatedCubicCell[];
  private readonly squareTable: number[][][];
  private readonly hexagonTable: BitruncatedCubicHexagon[];

  constructor(cellsPerAxis: number) {
    this.squareTable = this.buildSquares();
    this.hexagonTable = this.buildHexagons();
    this.cellTable = this.buildCells(cellsPerAxis);
  }

  // Both sublattices over the same index range: the plain cubic cells and the
  // body-centred ones that sit in the gaps between them.
  public get cells(): BitruncatedCubicCell[] {
    return this.cellTable;
  }

  // All six, in axis-then-sign order.
  public get squares(): number[][][] {
    return this.squareTable;
  }

  // All eight, in the order the three sign loops walk them.
  public get hexagons(): BitruncatedCubicHexagon[] {
    return this.hexagonTable;
  }

  private buildCells(cellsPerAxis: number): BitruncatedCubicCell[] {
    const cells: BitruncatedCubicCell[] = [];

    for (let i = 0; i < cellsPerAxis; i += 1) {
      for (let j = 0; j < cellsPerAxis; j += 1) {
        for (let k = 0; k < cellsPerAxis; k += 1) {
          const index = [i, j, k];
          const base = index.map((axis) => axis * CELL_PITCH);

          cells.push({ centre: base, index, bodyCentred: false });
          cells.push({
            centre: base.map((axis) => axis + BODY_CENTRE_OFFSET),
            index,
            bodyCentred: true,
          });
        }
      }
    }

    return cells;
  }

  private buildSquares(): number[][][] {
    const squares: number[][][] = [];

    AXES.forEach((axis) => {
      const [first, second] = [(axis + 1) % 3, (axis + 2) % 3];

      SIGNS.forEach((sign) => {
        squares.push(
          SQUARE_RING.map((offset) => {
            const point = [0, 0, 0];
            point[axis] = SQUARE_DISTANCE * sign;
            point[first] = offset[0];
            point[second] = offset[1];

            return point;
          }),
        );
      });
    });

    return squares;
  }

  private buildHexagons(): BitruncatedCubicHexagon[] {
    const hexagons: BitruncatedCubicHexagon[] = [];

    SIGNS.forEach((signX) => {
      SIGNS.forEach((signY) => {
        SIGNS.forEach((signZ) => {
          const direction = [signX, signY, signZ];

          hexagons.push({
            direction,
            signProduct: signX * signY * signZ,
            ring: HEXAGON_RING.map((offset) => AXES.map((axis) => direction[axis] * offset[axis])),
          });
        });
      });
    });

    return hexagons;
  }
}

export default BitruncatedCubicLattice;
