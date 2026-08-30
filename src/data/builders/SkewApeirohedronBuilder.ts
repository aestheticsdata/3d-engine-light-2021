// A finite chunk of an infinite skew polyhedron.
//
// The mu-polyhedra of "The Symmetries of Things" p. 337 are not solids. They
// are periodic sponges on the cubic lattice: they tile space instead of closing
// up, so they have no circumradius and Euler's formula does not apply to them.
// What is rendered is a chunk, the same compromise the book's own figures make.
//
// THE SHAPE OF THE CONSTRUCTION, shared by both of them. A uniform honeycomb
// fills space with cells; a skew apeirohedron is what is left when some of
// those cells' faces are kept and the rest are opened out as holes. So a caller
// supplies two things and nothing else: which cells are in the chunk, and which
// faces each cell contributes. Everything downstream — sharing a face between
// the two cells that meet along it, sharing a vertex between the faces around
// it, orientation, scale — is identical between the two solids and lives here.
//
// WINDING, WHICH IS THE PART THAT DOES NOT TRANSFER FROM THE CONVEX SOLIDS.
// PolyhedronBuilder orients a face by pushing its normal away from the centre
// of the solid. A sponge has no inside for that to mean anything: its surface
// separates space into two interpenetrating labyrinths, and a face's two sides
// face one of each.
//
// What makes it tractable is that the labyrinth is a property of the CELL. Every
// face of the surface separates a cell of one labyrinth from a cell of the
// other — never two of the same — so `sideA` on the cell a face came from is
// enough to orient it, and the orientation is globally consistent without any
// propagation across edges.
//
// AND THEN BOTH SIDES ARE EMITTED ANYWAY. Backface culling would otherwise make
// the sponge see-through: unlike the Menger sponge, whose surface bounds a
// solid whose interior is never seen, the tunnels here show the far side of the
// surface through every opening, and a single-sided face vanishes when viewed
// from its back. Emitting the reversed copy costs nothing at render time — the
// cull keeps exactly one of each pair for any given camera, so the DRAWN count
// is what a single-sided sponge would have been — and it is what lets the
// interior carry its own darker tone, the way the book's plate shades the
// insides of the tunnels.

import MeshBuilder from "@data/builders/MeshBuilder";
import PolyhedronBuilder from "@data/builders/PolyhedronBuilder";
import Vec3Math from "@data/builders/Vec3Math";

import type { Object3D } from "@data/types";

// One cell of the underlying honeycomb, and the faces it contributes.
export interface SkewCell {
  centre: number[];
  // Which of the two labyrinths this cell opens into. Faces are oriented away
  // from the side-A cell, which is what makes the whole surface agree.
  sideA: boolean;
  // Each face as a ring of offsets FROM the centre, not as absolute points. A
  // cell type that repeats across the lattice can then be built once and handed
  // to every cell of that type; the translation happens here. A face shared
  // with a neighbour arrives from both cells and is emitted once.
  faces: number[][][];
}

// One side of one face, as the colouring is asked about it. An options object
// rather than three positional arguments (R4), which also lets a generator take
// only the fields it colours by and leave the rest unread.
export interface SkewFaceTone {
  sides: number;
  // Which of the face's two skins this is: the one the outside sees, or the one
  // facing the labyrinth behind it.
  inner: boolean;
  // The unit direction the OUTER skin is seen from.
  //
  // The polygon's own size was the whole of the key while both sponges here mixed
  // squares with hexagons. It is not enough for one whose faces are all the same
  // polygon: `sides` cannot tell a sheet from a shaft wall, and such a sponge in a
  // single flat tone shows no openings at all — the wall seen through a hole is
  // painted exactly the colour of the sheet around it. Direction is what is left,
  // and it is what MengerSpongeGenerator has always coloured by.
  outward: number[];
}

export interface SkewApeirohedronOptions {
  cells: SkewCell[];
  radius: number;
  colorFor: (tone: SkewFaceTone) => string;
}

interface OrientedFace {
  ring: number[][];
  sides: number;
  outward: number[];
}

// Coordinates here are built out of sqrt(2), and a face shared between two
// cells is computed once from each of them — by two different sums, which agree
// mathematically and can disagree in the last bit. Identity keys are therefore
// rounded: the smallest real feature is most of an edge length across, so six
// decimal places separates two genuinely different points by a mile while
// folding two spellings of the same one together. Left unrounded, a shared face
// is emitted twice and the pair z-fights.
const KEY_PRECISION = 1e6;

class SkewApeirohedronBuilder {
  private readonly builder: MeshBuilder;
  private readonly polyhedron: PolyhedronBuilder;
  private readonly vec: Vec3Math;

  constructor() {
    this.builder = new MeshBuilder();
    this.polyhedron = new PolyhedronBuilder();
    this.vec = new Vec3Math();
  }

  public build(options: SkewApeirohedronOptions): Object3D {
    const faces = this.collectFaces(options);
    const vertices: number[][] = [];
    const vertexIndices = new Map<string, number>();

    const rings = faces.map((face) =>
      face.ring.map((point) => {
        const key = this.keyOf(point);
        const existing = vertexIndices.get(key);

        if (existing !== undefined) {
          return existing;
        }

        vertexIndices.set(key, vertices.length);
        vertices.push(point);

        return vertices.length - 1;
      }),
    );

    this.polyhedron.centerAndScale(vertices, options.radius).forEach((vertex) => {
      this.builder.addPoint(vertex);
    });

    rings.forEach((ring, index) => {
      this.emitBothSides(ring, faces[index], options.colorFor);
    });

    return this.builder.mesh;
  }

  // A face between two cells is offered by both of them. The first one to
  // arrive wins, and because its orientation is decided by its own cell's
  // labyrinth rather than by the order cells are walked, the copy that survives
  // is wound the same way the one it displaced would have been.
  private collectFaces(options: SkewApeirohedronOptions): OrientedFace[] {
    const seen = new Set<string>();
    const faces: OrientedFace[] = [];

    options.cells.forEach((cell) => {
      cell.faces.forEach((offsets) => {
        const ring = offsets.map((offset) => [
          cell.centre[0] + offset[0],
          cell.centre[1] + offset[1],
          cell.centre[2] + offset[2],
        ]);
        const key = ring
          .map((point) => this.keyOf(point))
          .sort()
          .join("|");

        if (seen.has(key)) {
          return;
        }

        seen.add(key);

        const oriented = this.orient(ring, offsets, cell.sideA);

        faces.push({ ring: oriented, sides: oriented.length, outward: this.outwardOf(oriented) });
      });
    });

    return faces;
  }

  // Away from the cell centre when the cell is on side A, towards it when it is
  // not — so the ring's own normal always points into side-B space, wherever on
  // the sponge the face sits.
  //
  // That normal is NOT the direction the outer tone is seen from; it is the
  // opposite one. `outwardOf` below is the field to read for that, and the two
  // are deliberately named apart because reading this one as "the outward side"
  // is how a sponge gets painted inside out.
  //
  // The offsets are what the outward direction is read from rather than the
  // translated ring: they are already measured from the cell centre, so the
  // face's own centroid IS the direction away from it.
  private orient(ring: number[][], offsets: number[][], sideA: boolean): number[][] {
    const normal = this.vec.cross(this.vec.sub(ring[1], ring[0]), this.vec.sub(ring[2], ring[0]));
    const pointsAway = this.vec.dot(normal, this.vec.centroid(offsets)) > 0;

    return pointsAway === sideA ? ring : [...ring].reverse();
  }

  // The engine culls a triangle whose projected cross product is <= 0, which is
  // the winding whose world-space (b-a) x (c-a) points back towards the body it
  // encloses. The first fan below is that winding for the ring as oriented; the
  // second is its mirror, and is the face's other side.
  private emitBothSides(ring: number[], face: OrientedFace, colorFor: (tone: SkewFaceTone) => string) {
    const outer = colorFor({ sides: face.sides, inner: false, outward: face.outward });
    const inner = colorFor({ sides: face.sides, inner: true, outward: face.outward });

    for (let i = 1; i < ring.length - 1; i += 1) {
      this.builder.addTriangle([ring[0], ring[i], ring[i + 1], outer]);
      this.builder.addTriangle([ring[0], ring[i + 1], ring[i], inner]);
    }
  }

  // The side the outer skin is painted on, which is NOT the side the oriented
  // ring's own normal points at. The renderer keeps the winding whose world-space
  // normal points AWAY from the camera — PolyhedronBuilder's header states the
  // same rule for the convex solids, and it is why addQuadByCoords reverses the
  // corner list it is handed — and emitBothSides paints the outer tone on the
  // ring as oriented. So that tone is the one seen from behind the ring's normal.
  private outwardOf(ring: number[][]): number[] {
    const normal = this.vec.cross(this.vec.sub(ring[1], ring[0]), this.vec.sub(ring[2], ring[0]));

    return this.vec.normalize(this.vec.scale(normal, -1));
  }

  private keyOf(point: number[]): string {
    return point.map((value) => Math.round(value * KEY_PRECISION)).join(",");
  }
}

export default SkewApeirohedronBuilder;
