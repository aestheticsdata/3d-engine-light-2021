// Muoctahedron (muO), an infinite skew polyhedron and one of the three regular
// ones: Petrie's and Coxeter's {6,4|4}, with four hexagons about each vertex and
// square holes. Petrie found this one and the mucube; Coxeter added the
// mutetrahedron and proved the three complete.
//
// NOT A SOLID, exactly as muCO and muRCO are not: a periodic surface with no
// circumradius, to which Euler's formula does not apply, rendered as a finite
// chunk.
//
// THE CONSTRUCTION. It is the bitruncated cubic honeycomb — the Kelvin foam —
// with every square face of its truncated octahedra deleted and every hexagon
// kept. The deleted squares are the tunnels, and they are what links each cell
// to the next along the axes. It is therefore the exact complement of what muCO
// does with the same honeycomb, which is why both are built on
// BitruncatedCubicLattice and differ only in the faces they ask it for. The
// Bitruncated cubic honeycomb article captions its own figure of this surface
// with the whole of it: "The regular skew apeirohedron {6,4|4} contains the
// hexagons of this honeycomb."
//
// READING THE SYMBOL, because its two 4s are different things. The 4 in the
// {6,4} is q, four hexagons round a vertex; the trailing |4 is the HOLE, and the
// article's own table gives it as a square. That is the source agreeing that the
// squares are what is deleted. The faces here are the flat convex hexagons — the
// skewness of the figure lives in the VERTEX figure, which is a skew square, and
// that is what makes this an apeirohedron rather than a tiling.
//
// WHAT IS SOURCED AND WHAT IS DERIVED. The name, the symbol, the hole and the
// construction are the article's; "muoctahedron" for MULTIPLE OCTAHEDRON is
// Conway's, as Wikipedia reports it citing The Symmetries of Things pp. 333-335,
// which is not online and was not read here. Writing it as the configuration
// 6.6.6.6 is this file's shorthand and not the article's, which only ever says
// "4 hexagons about each vertex". Everything below is counted here rather than
// taken on trust, over a block wide enough to have a genuine interior:
//
//   every interior EDGE of the honeycomb carries three faces, and in every one
//     of 1944 cases they are one square and two hexagons — so deleting the
//     squares leaves exactly the two faces a surface needs
//   every interior VERTEX carries six faces, and in every one of 864 cases they
//     are two squares and four hexagons — so what is left is four hexagons per
//     vertex, which is {6,4}
//
// Both counts are a test rather than a comment: see
// builders/__tests__/BitruncatedCubicLattice.test.ts.
//
// THE TWO LABYRINTHS, and this is the part that does not carry over from muCO.
// SkewApeirohedronBuilder winds a face from the `sideA` flag of the cell that
// offered it, which is sound only when the two cells sharing a kept face always
// disagree. Which cells those are depends on which faces were DELETED, so the
// colouring is a property of the sponge and not of the lattice:
//
//   every shared SQUARE joins two cells of the same sublattice (600 of 600)
//   every shared HEXAGON joins a plain cell to a body-centred one (729 of 729)
//
// muO deletes the squares, so its two labyrinths are the two sublattices
// themselves — each a simple cubic array of truncated octahedra strung together
// through the square openings — and `bodyCentred` is the colouring. muCO's
// parity of (i + j + k) is NOT: it gets 172 of muO's 343 shared hexagons wrong,
// which would have wound half the surface backwards. Reusing it, which is the
// obvious thing to do given the shared lattice, is the mistake to avoid here.
//
// WHICH SUBLATTICE IS SIDE A is free, unlike prismatic {4,5} where it was
// forced. The two labyrinths are congruent — translating by (2, 2, 2) is a
// symmetry of the infinite surface that exchanges them — so neither is the
// outside and neither is a cavity. Free in the geometry is not free in the
// paint, though: the tone is keyed on `outward`, which is derived from the
// oriented ring, so flipping the assignment reverses every face's outward
// direction and permutes the four tones below rather than merely swapping two.
// The face that read lightest would read darkest. There is no picture to prefer
// between them, and this is the one that shipped.
//
// References:
//   https://en.wikipedia.org/wiki/Regular_skew_apeirohedron
//   https://en.wikipedia.org/wiki/Skew_apeirohedron
//   https://en.wikipedia.org/wiki/Bitruncated_cubic_honeycomb
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, pp. 333-335

import BitruncatedCubicLattice from "@data/builders/BitruncatedCubicLattice";
import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Cells of the plain cubic lattice per axis, as muCO counts them, and two for
// the same reason: it is the block the article's own figure shows, and it lands
// the triangle budget beside muCO's. It is a small interior — 18 vertices and 54
// edges have their whole neighbourhood inside the chunk — which is why the
// counts above are taken from a block of 5 and not from this one. Exposed so the
// density can be tuned without touching the generator, as menger's level is.
const DEFAULT_CELLS_PER_AXIS = 2;

// Every face here is a hexagon, so the polygon's size — the key muCO and muRCO
// colour by — separates nothing, and the direction the face is seen from is what
// is left. It is not decoration. Every interior edge of this surface joins two
// hexagons of ONE cell, whose directions differ in exactly one sign (1944 of
// 1944), so the sign product two-colours the hexagons with no two neighbours
// ever alike — and that split is precisely muCO's: one class is the half muCO
// keeps as faces, the other is the half it opens out as holes. Painting them
// apart is what shows a hexagonal net rather than an undifferentiated crust, and
// it shows what the two sponges do differently on one honeycomb.
//
// Warm, because this is one of Conway's mu-polyhedra rather than one of Gott's
// set, but a copper rather than muCO's yellow so the two are not each other at a
// glance in the picker. The two classes are separated in value, not just in hue,
// so the alternation survives a face angled away from the key light. Inner tones
// are the same two dropped in value: the tunnels show the far side of the
// surface, and shading it apart from the outer skin is what makes an opening
// read as an opening rather than as a bite out of the silhouette.
const HEXAGON_A_OUTER = "rgba(226, 152, 78, 1)";
const HEXAGON_B_OUTER = "rgba(168, 96, 44, 1)";
const HEXAGON_A_INNER = "rgba(112, 72, 34, 1)";
const HEXAGON_B_INNER = "rgba(82, 46, 20, 1)";

export interface MuoctahedronOptions {
  cellsPerAxis?: number;
}

class MuoctahedronGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly lattice: BitruncatedCubicLattice;
  private readonly hexagonFaces: number[][][];

  constructor(options: MuoctahedronOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.lattice = new BitruncatedCubicLattice(options.cellsPerAxis ?? DEFAULT_CELLS_PER_AXIS);
    this.hexagonFaces = this.buildHexagonFaces();
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.inner, tone.outward),
    });
  }

  // The sublattice IS the labyrinth here, so `bodyCentred` is read straight
  // through as the side rather than being turned into an index parity first.
  private buildCells(): SkewCell[] {
    return this.lattice.cells.map((cell) => ({
      centre: cell.centre,
      sideA: !cell.bodyCentred,
      faces: this.hexagonFaces,
    }));
  }

  // Every cell gives up all eight of its hexagons and keeps none of its squares:
  // closing a square would seal the two cells it joins off from each other, and
  // those are the tunnels.
  private buildHexagonFaces(): number[][][] {
    return this.lattice.hexagons.map((hexagon) => hexagon.ring);
  }

  // The outward direction is one of the eight (+-1, +-1, +-1), normalised, so
  // multiplying its components recovers the class of the hexagon it belongs to.
  private colorFor(inner: boolean, outward: number[]): string {
    if (outward[0] * outward[1] * outward[2] > 0) {
      return inner ? HEXAGON_A_INNER : HEXAGON_A_OUTER;
    }

    return inner ? HEXAGON_B_INNER : HEXAGON_B_OUTER;
  }
}

export default MuoctahedronGenerator;
