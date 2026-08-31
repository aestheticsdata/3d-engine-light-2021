// Mucube (muC), an infinite skew polyhedron and one of the two Petrie himself
// found — {4,6|4}. Six squares around every vertex, and square holes. Petrie
// extended skew polygons to polyhedra in 1926 and discovered this one and the
// muoctahedron; Coxeter added the mutetrahedron and proved the three complete.
// Which of Petrie's two came first is not recorded, so nothing here calls this
// the first.
//
// NOT A SOLID, exactly as muO, muCO and muRCO are not: a periodic surface with
// no circumradius, to which Euler's formula does not apply, rendered as a finite
// chunk.
//
// THE CONSTRUCTION. Unit cubes on Z^3 in two roles. A TUBE is a cube with two
// opposite faces removed, so four lateral squares survive; a HOLE is a cube with
// all six removed, and six tubes open into it. The cheapest coordinates in the
// epic: every vertex is a half-integer, and nothing here is irrational.
//
// WHICH CUBES PLAY WHICH ROLE is the whole ticket, and it is DERIVED rather than
// sourced — no article says it. HOLES are the cubes whose coordinates are all
// even or all odd, a quarter of them; TUBES are the other three quarters, and a
// tube's AXIS is the single coordinate whose parity differs from the other two,
// which is what aims its two open ends at holes. The one piece of outside
// support is indirect: the article's table ties muC to the RUNCINATED cubic
// honeycomb even though its own construction sentence says the plain cubic one,
// and the runcinated labelling splits the eight cubes at a vertex two-and-six —
// the same quarter against three quarters this assignment gives. Counted over a
// block with a real interior rather than taken on trust:
//
//   three tubes per hole, exactly, on any whole number of periods
//   the kept squares are exactly half of the honeycomb's — the CELLS split one
//     to three and the FACES one to one, and those are two different numbers
//   every interior EDGE is left with exactly two faces, which is what a surface
//     needs, and every interior VERTEX with exactly six squares, which is {4,6}
//
// The vertex figure is a SKEW hexagon and not a plane one, which is what puts
// this in the class at all: the six squares at a vertex leave by six directions
// that close into a single 6-cycle, antipodal ones three apart — the Petrie
// hexagon of an octahedron — and no vertex's six are coplanar.
//
// The near miss is worth recording because it looks reasonable and fails
// quietly: taking the holes to be only the ALL-EVEN cubes, an eighth rather than
// a quarter, still leaves two faces on every edge it closes — but it closes
// none. Not one vertex in a five-cube block ends up with its whole neighbourhood
// present, so the surface never reaches a valid interior at all.
//
// THE TWO LABYRINTHS, which is what the winding needs, and they are not the
// tubes against the holes. A tube's two ends open into holes, so a tube and the
// holes it serves are the same region. What separates the two is WHICH holes:
// the tubes at parity (1,0,0), (0,1,0) and (0,0,1) run between all-even holes,
// and those at (0,1,1), (1,0,1) and (1,1,0) run between all-odd ones. So the two
// labyrinths are two interpenetrating scaffolds of tubes-and-holes that never
// touch, and a tube belongs to the one named by the shared parity of its two
// NON-AXIS coordinates. Every kept square has one on each side: 0 of the shared
// faces put the same family on both.
//
// WHICH FAMILY IS SIDE A is free, as it was for muO and unlike prismatic {4,5}.
// Translating by (1, 1, 1) flips all three parities, carries holes to holes and
// each tube to a tube of the same axis in the other family, so the two
// labyrinths are congruent. Free in the geometry is not free in the paint,
// though: the tone below reads `outward`, which the orientation decides, so the
// flip repaints every face rather than merely swapping two names.
//
// References:
//   https://en.wikipedia.org/wiki/Regular_skew_apeirohedron
//   https://en.wikipedia.org/wiki/Skew_apeirohedron
//   https://en.wikipedia.org/wiki/Cubic_honeycomb

import SkewApeirohedronBuilder from "@data/builders/SkewApeirohedronBuilder";
import { AXES, SIGNS } from "@data/builders/symmetry";

import type { SkewCell } from "@data/builders/SkewApeirohedronBuilder";
import type { Object3D } from "@data/types";

const RADIUS = 100;

// Cubes per axis. The period is two cubes, so an even number is what makes the
// chunk a whole number of periods — at four the tube-to-hole ratio comes out at
// exactly three and the kept squares at exactly half, and there are 27 interior
// vertices for the counts above to be true of. Four is also self-inverse: the
// point inversion about the block's centre carries holes to holes and each tube
// to a tube of the same axis in the OTHER labyrinth, so the chunk represents
// both halves equally rather than favouring the one it starts on. Two is a
// single hole and its collar, which reads as a widget rather than as a sponge.
//
// The one cost of an even span is that the block's median planes fall on face
// planes rather than on cube centres, so a face class lies flat in the view at
// the axis-aligned poses and projects to nothing. That is a face seen exactly
// edge-on, which is correct and not a pop: over 360 poses no pair is ever drawn
// on both skins, and every pair that draws neither has exactly zero projected
// area. Prismatic {4,5} escapes it only because its span is odd for an unrelated
// reason. Exposed so the density can be tuned without touching the generator, as
// menger's level is.
const DEFAULT_CUBES_PER_AXIS = 4;

const HALF_CUBE = 0.5;

// A square face's four offsets in the two axes that are not its own, in ring
// order. Which way round is not load-bearing: SkewApeirohedronBuilder rewinds
// every face from its own cell's side.
const SQUARE_RING = [
  [-HALF_CUBE, -HALF_CUBE],
  [HALF_CUBE, -HALF_CUBE],
  [HALF_CUBE, HALF_CUBE],
  [-HALF_CUBE, HALF_CUBE],
];

// Every face is a unit square, so the polygon's size — the key muCO and muRCO
// colour by — separates nothing, and the direction it is seen from is what is
// left, exactly as for prismatic {4,5}. Keying on the normal's axis is what
// makes a shaft read as a shaft: looking down a tube, its four walls lie in the
// two orientations that are not its own, so the tone alternates around the bore
// instead of painting it one flat colour.
//
// Warm, because Petrie's three and Conway's plate belong together and Gott's set
// is the cool one. A brass beside the muoctahedron's copper — the two are the
// closest pair in the picker and have to be told apart at a glance. The three
// tones are separated in value as well as hue so the alternation survives a face
// angled away from the key light, and the inner tones are the same three dropped
// in value: the tunnels show the far side of the surface, and shading it apart
// from the outer skin is what makes an opening read as an opening.
const FACE_X_OUTER = "rgba(232, 196, 96, 1)";
const FACE_Y_OUTER = "rgba(198, 154, 62, 1)";
const FACE_Z_OUTER = "rgba(158, 116, 40, 1)";
const FACE_X_INNER = "rgba(112, 92, 40, 1)";
const FACE_Y_INNER = "rgba(88, 68, 26, 1)";
const FACE_Z_INNER = "rgba(64, 46, 16, 1)";

// Beats rounding on coordinates that are all halves and whole numbers: every
// face normal here is exactly an axis, so the runner-up component is exactly
// zero.
const AXIS_TOLERANCE = 0.5;

export interface MucubeOptions {
  cubesPerAxis?: number;
}

class MucubeGenerator {
  private readonly builder: SkewApeirohedronBuilder;
  private readonly cubesPerAxis: number;
  private readonly lateralFaces: number[][][][];

  constructor(options: MucubeOptions = {}) {
    this.builder = new SkewApeirohedronBuilder();
    this.cubesPerAxis = options.cubesPerAxis ?? DEFAULT_CUBES_PER_AXIS;
    this.lateralFaces = AXES.map((axis) => this.buildLateralFaces(axis));
  }

  public build(): Object3D {
    return this.builder.build({
      cells: this.buildCells(),
      radius: RADIUS,
      colorFor: (tone) => this.colorFor(tone.inner, tone.outward),
    });
  }

  // Only the tubes are handed over. A hole contributes no face at all, which is
  // what makes it a hole rather than a cell with an empty face list.
  private buildCells(): SkewCell[] {
    const cells: SkewCell[] = [];

    for (let x = 0; x < this.cubesPerAxis; x += 1) {
      for (let y = 0; y < this.cubesPerAxis; y += 1) {
        for (let z = 0; z < this.cubesPerAxis; z += 1) {
          const parity = [x % 2, y % 2, z % 2];
          const axis = this.axisOf(parity);

          if (axis === undefined) {
            continue;
          }

          cells.push({
            centre: [x + HALF_CUBE, y + HALF_CUBE, z + HALF_CUBE],
            sideA: parity[(axis + 1) % 3] === 0,
            faces: this.lateralFaces[axis],
          });
        }
      }
    }

    return cells;
  }

  // The odd one out, which is the tube's axis — and `undefined` when there is
  // none, because all three parities agreeing is exactly what makes a hole.
  private axisOf(parity: number[]): number | undefined {
    return AXES.find((axis) => parity[axis] !== parity[(axis + 1) % 3] && parity[axis] !== parity[(axis + 2) % 3]);
  }

  // The four walls, and neither cap: the caps are the openings the tube's two
  // holes are reached through, and closing one would seal the tube off.
  private buildLateralFaces(axis: number): number[][][] {
    return AXES.filter((wall) => wall !== axis).flatMap((wall) =>
      SIGNS.map((sign) => {
        const [first, second] = [(wall + 1) % 3, (wall + 2) % 3];

        return SQUARE_RING.map((offset) => {
          const point = [0, 0, 0];
          point[wall] = sign * HALF_CUBE;
          point[first] = offset[0];
          point[second] = offset[1];

          return point;
        });
      }),
    );
  }

  private colorFor(inner: boolean, outward: number[]): string {
    if (Math.abs(outward[0]) > AXIS_TOLERANCE) {
      return inner ? FACE_X_INNER : FACE_X_OUTER;
    }

    if (Math.abs(outward[1]) > AXIS_TOLERANCE) {
      return inner ? FACE_Y_INNER : FACE_Y_OUTER;
    }

    return inner ? FACE_Z_INNER : FACE_Z_OUTER;
  }
}

export default MucubeGenerator;
