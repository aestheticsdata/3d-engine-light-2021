// Prismatic {4,5}, an infinite skew polyhedron — Gott's first prismatic
// pseudopolyhedron, and the `4.4.4.4.4` of the Wikipedia plate's prismatic
// uniform table. Those are one object drawn twice, so they are one shape here.
// Vertex configuration 4.4.4.4.4: five squares around every vertex, and no
// other polygon anywhere on the surface.
//
// NOT A SOLID, exactly as muCO and muRCO are not: a periodic surface with no
// circumradius, to which Euler's formula does not apply, rendered as a finite
// chunk.
//
// THE CONSTRUCTION, in Gott's own words: "Two parallel square tilings connected
// by cubic holes." Two sheets of unit squares, square holes punched through
// both, and the four lateral faces of a unit cube joining each pair of holes.
// Every coordinate is an integer. Nothing here is irrational, nothing is
// chiral, and there is no honeycomb to identify.
//
// WHAT IS SOURCED AND WHAT IS DERIVED. The name, the configuration and that one
// sentence are Gott's. Neither the slab's thickness nor the hole spacing is
// stated anywhere, and both are forced rather than chosen — by counting:
//
//   THICKNESS. A shaft wall is a square of the same edge as the sheets, so one
//   course of walls puts the sheets exactly one edge apart. Two courses would
//   leave a ring of vertices halfway up every shaft carrying four vertical
//   squares and no horizontal ones — degree 4, not 5. So the slab is one cube
//   thick, and CUBES_ACROSS below has no third component to set.
//
//   SPACING. A sheet vertex clear of every hole carries 4 squares. Punching a
//   hole into one of its four quadrants takes one away and hands back the two
//   shaft walls that meet there: 3 + 2 = 5. A vertex shared by two holes —
//   which is to say two holes touching corner to corner — comes out at
//   2 + 4 = 6. So {4,5} holds exactly when every vertex is a corner of EXACTLY
//   ONE hole, and that puts one hole in every 2x2 block of squares. No other
//   density satisfies it.
//
//   THE COUNT that settles both. One period is a 2x2 block of squares taken
//   through both sheets: 8 vertices, 20 edges, and 10 faces — 3 surviving
//   squares per sheet plus the 4 walls of the one shaft. 10 faces x 4 sides
//   = 40 = 2 x 20, so every edge carries exactly the two faces a surface needs;
//   8 vertices x 5 = 40 = 2 x 20, so every vertex carries exactly five squares.
//
// THE TWO LABYRINTHS, which is what the winding needs — and they are not "above
// the slab" and "below" it. Those two are one region, not two: a line dropped
// down a shaft leaves through the bottom hole without meeting a face, so the
// whole outside is connected to itself through every shaft. The second
// labyrinth is the slab's own cavity, the space between the sheets, which every
// shaft is walled off from and which no sheet is punctured into. It is flat,
// unbounded and completely enclosed. Every face has one of the two on each
// side, which is all `sideA` has to decide.
//
// WHICH OF THEM IS SIDE A, and unlike the two mu-sponges it is not free here.
// Theirs are congruent and interpenetrating, so either assignment paints the
// same picture and the outer and inner tones are interchangeable. These two are
// nothing like each other. The renderer keeps the winding whose world-space
// normal points AWAY from the camera (PolyhedronBuilder's header states the
// rule; MengerSpongeGenerator's face table obeys it), and the builder paints the
// outer tone on the ring as oriented — so the outer tone is seen from the side
// that ring's normal points away from, which is the interior of the side-A cell.
// The shafts are therefore the side-A cells: that is what turns every face's
// oriented normal inward, into the cavity, and leaves the outer tones facing
// the world on both sheets and down every shaft. The cavity keeps the inner
// tones, and is seen only where the chunk is cut — which is the edge-on view
// that has to show the slab's real thickness.
//
// References:
//   J. R. Gott, "Pseudopolyhedrons", Amer. Math. Monthly 74 (1967), 497-504
//   https://en.wikipedia.org/wiki/Skew_apeirohedron

import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Shafts per side. The chunk runs 2n+1 cubes across rather than 2n so that it
// closes on a solid rim in both directions: every shaft is then fully
// surrounded, and the vertex count in the header is true of a real interior
// rather than of nothing. Three gives nine shafts, which is where the period
// starts reading as a period. Exposed for the same reason menger's level is.
const DEFAULT_SHAFTS_PER_SIDE = 3;

// The cube is the unit of the whole construction, so its half is the only
// magnitude any face offset is written from.
const HALF_CUBE = 0.5;

const VERTICAL_AXIS = 2;

// A square face's four offsets in the two axes that are not its own, in ring
// order. Which way round is not load-bearing: SkewApeirohedronBuilder rewinds
// every face from its own cell's side.
const SQUARE_RING = [
  [-HALF_CUBE, -HALF_CUBE],
  [HALF_CUBE, -HALF_CUBE],
  [HALF_CUBE, HALF_CUBE],
  [-HALF_CUBE, HALF_CUBE],
];

// Every face here is a square, so the polygon's size — the key both mu-sponges
// colour by — separates nothing. Direction is what is left, and it has to be
// used: painted one flat tone, a shaft wall seen through a hole is exactly the
// colour of the sheet around it and the slab reads as an unbroken plate.
//
// A cool slate rather than a gold keeps Gott's set apart from Conway's plate at
// a glance in the picker. The sheets take the lightest tone because they are
// most of the surface; the two wall directions differ from each other so that a
// shaft reads as a tube rather than as a flat patch. Inner tones are the same
// three dropped in value — the cavity is the far side of this surface, not
// another material.
//
// The chroma is authored wider than it looks on the swatch, and that is the key
// light's doing rather than taste. It scales all three channels by roughly the
// same factor, so a face angled away keeps its hue and loses only its value: a
// near-grey slate authored at a comfortable brightness lands on screen as a
// genuinely grey plate. Spreading red to blue is what survives the multiply.
const DECK_OUTER = "rgba(164, 196, 228, 1)";
const WALL_X_OUTER = "rgba(112, 152, 196, 1)";
const WALL_Y_OUTER = "rgba(74, 116, 166, 1)";
const DECK_INNER = "rgba(70, 92, 118, 1)";
const WALL_X_INNER = "rgba(52, 76, 104, 1)";
const WALL_Y_INNER = "rgba(36, 58, 86, 1)";

// Beats rounding on coordinates that are all halves and whole numbers, and
// nothing else: every face normal here is exactly an axis, so the runner-up
// component is exactly zero.
const AXIS_TOLERANCE = 0.5;

export interface PrismaticFourFiveOptions {
  shaftsPerSide?: number;
}

class PrismaticFourFiveGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly shaftsPerSide: number;
  private readonly sheetFaces: number[][][];
  private readonly shaftFaces: number[][][];

  constructor(options: PrismaticFourFiveOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.shaftsPerSide = options.shaftsPerSide ?? DEFAULT_SHAFTS_PER_SIDE;
    this.sheetFaces = this.buildSheetFaces();
    this.shaftFaces = this.buildShaftFaces();
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.inner, tone.outward),
    });
  }

  // One cube per square of the sheet, all in the single course the thickness
  // count forces. A cube on an odd index in both directions is a shaft; the
  // other three of every 2x2 block are solid, which is the one-hole-per-block
  // spacing the vertex count forces. Starting the sweep on an even index is
  // what puts the solid rim on all four sides.
  private buildCells(): SkewCell[] {
    const cells: SkewCell[] = [];
    const span = 2 * this.shaftsPerSide;

    for (let x = 0; x <= span; x += 1) {
      for (let y = 0; y <= span; y += 1) {
        const shaft = x % 2 === 1 && y % 2 === 1;

        cells.push({
          centre: [x + HALF_CUBE, y + HALF_CUBE, HALF_CUBE],
          sideA: shaft,
          faces: shaft ? this.shaftFaces : this.sheetFaces,
        });
      }
    }

    return cells;
  }

  // A solid cube gives up its two caps and nothing else. Its four sides are
  // never faces of the surface: each one either abuts another solid cube, and
  // is interior to the cavity, or abuts a shaft, which offers that wall itself.
  private buildSheetFaces(): number[][][] {
    return SIGNS.map((sign) => this.squareAt(VERTICAL_AXIS, sign));
  }

  // A shaft gives up its four walls and keeps neither cap: the caps are the
  // holes, and closing them would close the shaft.
  private buildShaftFaces(): number[][][] {
    return AXES.filter((axis) => axis !== VERTICAL_AXIS).flatMap((axis) =>
      SIGNS.map((sign) => this.squareAt(axis, sign)),
    );
  }

  private squareAt(axis: number, sign: number): number[][] {
    const [first, second] = [(axis + 1) % 3, (axis + 2) % 3];

    return SQUARE_RING.map((offset) => {
      const point = [0, 0, 0];
      point[axis] = sign * HALF_CUBE;
      point[first] = offset[0];
      point[second] = offset[1];

      return point;
    });
  }

  private colorFor(inner: boolean, outward: number[]): string {
    if (Math.abs(outward[VERTICAL_AXIS]) > AXIS_TOLERANCE) {
      return inner ? DECK_INNER : DECK_OUTER;
    }

    if (Math.abs(outward[0]) > AXIS_TOLERANCE) {
      return inner ? WALL_X_INNER : WALL_X_OUTER;
    }

    return inner ? WALL_Y_INNER : WALL_Y_OUTER;
  }
}

export default PrismaticFourFiveGenerator;
