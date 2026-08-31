// Mutetrahedron (muT), an infinite skew polyhedron and the last of the three
// regular ones — Coxeter's {6,6|3}, the one he added to Petrie's two and proved
// completed them. Six hexagons around every vertex, and TRIANGULAR holes, which
// is what sets it apart from muC and muO at a glance.
//
// COMPLETE IS RELATIVE TO A DEFINITION, and the flat claim is wrong. The three
// are everything only under Coxeter and Petrie's terms — convex faces, and a
// skew vertex figure allowed. Grunbaum let the FACES be skew too and found 23
// more; Dress added one and closed the list at twelve pure regular apeirohedra
// in 3-space. Coxeter's three are three of those twelve.
//
// NOT A SOLID, exactly as the others are not: a periodic surface with no
// circumradius, to which Euler's formula does not apply, rendered as a finite
// chunk.
//
// THE CONSTRUCTION. It is the quarter cubic honeycomb — truncated tetrahedra and
// plain tetrahedra, one for one — with every triangle deleted and every hexagon
// kept. The recipe is cleaner than either sibling's because the honeycomb sorts
// the faces for us: a hexagon always separates two truncated tetrahedra, and a
// triangle always separates a truncated tetrahedron from a plain one. Deleting
// the triangles therefore strips the plain tetrahedra of every face they had,
// and they become the holes.
//
// THE ONLY NON-CUBIC LATTICE IN THE EPIC, and the reason this one came third.
// The truncated tetrahedra sit on a DIAMOND lattice rather than on Z^3: cells at
// 4*(p, q, r) with p + q + r even, and a second cell at each of those minus
// (2, 2, 2). Each cell's twelve vertices are the permutations of (3, 1, 1)
// carrying an EVEN number of minus signs, so the edge is 2*sqrt(2) and every
// coordinate is an integer.
//
// THE SECOND SUBLATTICE IS TURNED OVER, not merely translated, and that is the
// whole of what makes the honeycomb close up. What is forced is the resulting
// ORIENTATION — the second cell must carry its hexagons on the directions the
// first carries its triangles on — rather than the inversion as such: a
// truncated tetrahedron is achiral, so negating every ring is just the cheapest
// spelling of that, and a rotation would do as well.
//
// Both ways of getting it wrong fail silently and totally rather than subtly,
// which is worth knowing because neither throws. Give both sublattices the same
// orientation and not one hexagon is shared by two cells. Put the second cell at
// PLUS (2, 2, 2) over the same index set and it lands on the hole sublattice
// instead — again not one shared hexagon, and a chunk of truncated tetrahedra
// floating free with no surface between them.
//
// Counted over a block with a real interior rather than taken on trust:
//
//   every hexagon is shared by exactly two truncated tetrahedra, and every one
//     of those pairs is one cell from each sublattice
//   no triangle is ever shared, which is what leaves the tetrahedra faceless
//   every interior EDGE is left with exactly two faces, which is what a surface
//     needs, and every interior VERTEX with exactly six hexagons, which is {6,6}
//
// THE TWO LABYRINTHS are the two sublattices, as they were for muO — but they
// arrive by a different route, and the route matters because the obvious reading
// is wrong. Joining cells through deleted faces links a truncated tetrahedron to
// the four tetrahedral holes at its triangles, and each hole back to four
// truncated tetrahedra, so it is tempting to conclude the graph is connected and
// there is only one region. It is not: a hole's four cells all lie on the SAME
// sublattice, so the holes never bridge the two. Each sublattice plus the holes
// it owns is one labyrinth, `sideA` is which sublattice a cell is on, and no
// shared hexagon puts the same side on both.
//
// The flag is taken at the emit site rather than recovered from coordinates, and
// that is deliberate after the last two tickets. The tempting closed form,
// "(x + y + z) / 2 is even", is right on every cell and INVERTED on every hole —
// the HAL-130 trap exactly, a rule that is sound on what the builder is handed
// and false about the sponge. The form that is true of both is
// (x + y + z) mod 8 in {0, 6}, and nothing here needs it.
//
// WHICH SUBLATTICE IS SIDE A is free. The point inversion about the midpoint of
// any cell-to-cell bond exchanges the two, so they are congruent — though as
// ever, free in the geometry is not free in the paint, because the tone reads
// `outward` and the flip repaints every face.
//
// AND IT IS ACHIRAL, which the ticket flagged as a risk and is worth settling
// rather than leaving open. The mirror (x, y, z) -> (y, x, z) is an exact
// symmetry of the surface as written here, with no translation needed: swapping
// two coordinates preserves both "permutation of (3, 1, 1)" and the count of
// minus signs, so it fixes each cell and maps each sublattice to itself. There
// is no second enantiomorph to pick between, and none is expected — a regular
// apeirohedron is flag-transitive, which forces reflections into its group. The
// honeycomb underneath is Fd-3m, diamond's own space group.
//
// The construction is stated twice over, and the second one is the useful
// citation because it comes from the honeycomb's side rather than the sponge's:
// Quarter cubic honeycomb captions its own figure "The subset of hexagonal faces
// of this honeycomb contains a regular skew apeirohedron {6,6|3}". The
// coordinates below are in neither article. Nothing in any source gives a vertex
// set for muT, so the frame is derived here and checked by counting.
//
// References:
//   https://en.wikipedia.org/wiki/Regular_skew_apeirohedron
//   https://en.wikipedia.org/wiki/Skew_apeirohedron
//   https://en.wikipedia.org/wiki/Quarter_cubic_honeycomb

import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Cells of the plain sublattice per axis; the inverted ones come with them, so
// the chunk holds one of each per even-sum index. Four gives thirty-two of each
// and closes on 31 interior vertices, which is what makes the counts above true
// of a real interior rather than of nothing. Exposed so the density can be tuned
// without touching the generator, exactly as menger's level is.
const DEFAULT_CELLS_PER_AXIS = 4;

const CELL_PITCH = 4;
const INVERTED_OFFSET = -2;

// The four directions of the tetrahedron the cell was truncated from. Each names
// one vertex that was cut off — so the TRIANGLE left in its place faces that way,
// and the HEXAGON opposite it faces the other. All four carry an even number of
// minus signs, which is the fact the colouring below rests on.
const TETRAHEDRAL_DIRECTIONS = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];

// The hexagon lying opposite direction (1, 1, 1), walked in ring order; every
// consecutive pair differs by 2*sqrt(2), and all six sum to -3, which is the
// plane the face lies in. The hexagon opposite any other direction is this ring
// multiplied through by that direction, which works because the directions are
// closed under componentwise multiplication.
const HEXAGON_RING = [
  [1, -1, -3],
  [-1, 1, -3],
  [-3, 1, -1],
  [-3, -1, 1],
  [-1, -3, 1],
  [1, -3, -1],
];

// Every face is a hexagon, so the polygon's size separates nothing — muO's
// problem, met again and NOT solved the same way. muO splits its hexagons by the
// sign product of their direction; muT's outward directions all carry an even
// sign product, so that key is constant here and useless. The direction itself
// is what is left, and the four tones are the four hexagons of a truncated
// tetrahedron. It is a proper colouring of the surface rather than an arbitrary
// split: no two faces meeting along an edge ever take the same tone.
//
// Indexed by the two leading sign bits, which determine the third because the
// count of minus signs is always even: (+,+,+), (+,-,-), (-,+,-), (-,-,+).
//
// WHY THEY ARE MATCHED IN VALUE AND SPREAD IN HUE, which is the part that was
// got wrong first and fixed against a render. Here the colour key IS the face
// normal — one tone per direction, exactly what FLAT shading already keys on —
// so an authored value ramp does not add to the shading, it fights it: the
// darkest tone can land on the best-lit normal and the two cancel to a single
// flat brown, which is what the first attempt produced. Matched value leaves the
// shading to supply the value and the tone to supply the hue, and they stop
// competing.
//
// Even so, this is warm variation across the net and not four obviously
// different colours, because with only four directions and backface culling only
// one or two of them face the camera at any pose. Inner tones are the same four
// dropped in value, and that contrast is doing most of the work: the openings
// show the far side of the surface, which is what makes a triangular hole read
// as a hole rather than as a dark facet.
//
// A rust, third in the warm family after muC's brass and muO's copper, because
// Petrie's and Coxeter's three belong together and Gott's set is the cool one.
const HEXAGON_TONES = [
  { outer: "rgba(208, 132, 68, 1)", inner: "rgba(104, 66, 34, 1)" },
  { outer: "rgba(196, 114, 80, 1)", inner: "rgba(98, 57, 40, 1)" },
  { outer: "rgba(178, 130, 58, 1)", inner: "rgba(89, 65, 29, 1)" },
  { outer: "rgba(188, 110, 98, 1)", inner: "rgba(94, 55, 49, 1)" },
];

export interface MutetrahedronOptions {
  cellsPerAxis?: number;
}

class MutetrahedronGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly cellsPerAxis: number;
  private readonly plainFaces: number[][][];
  private readonly invertedFaces: number[][][];

  constructor(options: MutetrahedronOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.cellsPerAxis = options.cellsPerAxis ?? DEFAULT_CELLS_PER_AXIS;
    this.plainFaces = this.buildHexagons();
    this.invertedFaces = this.plainFaces.map((ring) => ring.map((point) => point.map((axis) => -axis)));
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.inner, tone.outward),
    });
  }

  // The diamond lattice, as two cells per even-sum index. Only the truncated
  // tetrahedra are handed over; the tetrahedral holes contribute no face at all,
  // which is what makes them holes rather than cells with an empty face list.
  private buildCells(): SkewCell[] {
    const cells: SkewCell[] = [];

    for (let p = 0; p < this.cellsPerAxis; p += 1) {
      for (let q = 0; q < this.cellsPerAxis; q += 1) {
        for (let r = 0; r < this.cellsPerAxis; r += 1) {
          if ((p + q + r) % 2 !== 0) {
            continue;
          }

          const base = [p * CELL_PITCH, q * CELL_PITCH, r * CELL_PITCH];

          cells.push({ centre: base, sideA: true, faces: this.plainFaces });
          cells.push({
            centre: base.map((axis) => axis + INVERTED_OFFSET),
            sideA: false,
            faces: this.invertedFaces,
          });
        }
      }
    }

    return cells;
  }

  // All four, always: the triangles are the openings and are never offered.
  private buildHexagons(): number[][][] {
    return TETRAHEDRAL_DIRECTIONS.map((direction) =>
      HEXAGON_RING.map((offset) => offset.map((axis, index) => axis * direction[index])),
    );
  }

  private colorFor(inner: boolean, outward: number[]): string {
    const tone = HEXAGON_TONES[(outward[0] > 0 ? 0 : 2) + (outward[1] > 0 ? 0 : 1)];

    return inner ? tone.inner : tone.outer;
  }
}

export default MutetrahedronGenerator;
