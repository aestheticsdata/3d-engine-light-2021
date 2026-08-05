// Truncated icosidodecahedron (tID), also called the great rhombicosidodecahedron
// or the omnitruncated dodecahedron. The largest solid of this family, and the
// dual of the kisrhombic triacontahedron in this folder — that solid is built by
// reciprocating the very face planes derived here.
//
// 120 vertices, 180 edges, 62 faces — 30 squares, 20 hexagons, 12 decagons.
//
// WHY THERE IS NO COORDINATE TABLE. The usual recipe is five golden-ratio orbits
// of 24, copied from a reference and checked afterwards. Five orbits of signed
// even permutations is exactly the kind of transcription that ships with one sign
// wrong and still renders something plausible, so the construction is turned
// around: tID is the *omnitruncation* of the icosahedron, meaning it has one
// vertex per FLAG — per incident (vertex, edge, face) triple. The icosahedron has
// 12x5 = 60 vertex-edge incidences, each lying in two faces, so there are exactly
// 120 flags and the count cannot come out wrong.
//
// Each vertex of tID touches exactly one decagon, one hexagon and one square, so
// it is the single point where those three face planes meet: one 3x3 solve per
// flag, by Cramer's rule. The face planes come from the Archimedean condition —
// with unit edges every vertex sits at one circumradius R and every face is a
// regular polygon, so the distance from the centre to a p-gonal face is
// sqrt(R^2 - r_p^2), where r_p = 1/(2 sin(pi/p)) is that polygon's own
// circumradius: phi for the decagon, 1 for the hexagon, 1/sqrt(2) for the square.
// The same relation kisRhombicTriacontahedron.ts already encodes, from the other
// side of the duality.
//
// Every check the ticket asks for is therefore a consequence of the construction
// rather than something to remember to run: the counts follow from the flags, the
// face split follows from grouping them three ways, and the equal edge lengths
// follow from the Archimedean condition the planes were placed by. The trade-off,
// stated plainly: the file carries a small linear solve instead of a table of
// numbers.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Truncated_icosidodecahedron
//   https://mathworld.wolfram.com/TruncatedIcosidodecahedron.html

import Icosahedron, { PHI } from "@data/builders/Icosahedron";
import MeshBuilder from "@data/builders/MeshBuilder";
import Vec3Math from "@data/builders/Vec3Math";

import type { Object3D } from "@data/types";

type Vec3 = [number, number, number];

const CIRCUMRADIUS = 100;

// Three plums, one per face type. The fan triangles of a face all share its
// colour, or the solid reads as 236 triangles instead of 62 faces — and the
// decagons, at eight triangles each, are where that would show worst. Lightest on
// them so the icosahedron underneath the truncation stays legible, exactly as tCO
// keeps its cube legible under the octagons.
const DECAGON_COLOR = "rgba(208, 134, 198, 1)";
const HEXAGON_COLOR = "rgba(158, 82, 152, 1)";
const SQUARE_COLOR = "rgba(102, 44, 102, 1)";

// R^2 for unit edges. Shared with kR30 by value rather than by import: the two
// files derive it independently and agreeing to nine decimals is what
// cross-validates them, which importing one from the other would throw away.
const CIRCUMRADIUS_SQUARED = (31 + 12 * Math.sqrt(5)) / 4;

// The three polygons' own circumradii, r_p = 1/(2 sin(pi/p)).
const DECAGON_RADIUS = PHI;
const HEXAGON_RADIUS = 1;
const SQUARE_RADIUS = 1 / Math.SQRT2;

// One incident (vertex, edge, face) triple of the icosahedron, as indices into
// its three tables. One tID vertex per flag.
interface Flag {
  vertex: number;
  edge: number;
  face: number;
}

class TruncatedIcosidodecahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly vec: Vec3Math;
  private readonly icosahedron: Icosahedron;
  private readonly flags: Flag[];
  private readonly decagonPlane: number;
  private readonly hexagonPlane: number;
  private readonly squarePlane: number;

  constructor(icosahedron: Icosahedron = new Icosahedron()) {
    this.builder = new MeshBuilder();
    this.vec = new Vec3Math();
    this.icosahedron = icosahedron;
    this.flags = this.buildFlags();
    // Decagons sit on the 5-fold axes, hexagons on the 3-fold, squares on the
    // 2-fold — the icosahedron's vertices, faces and edges respectively.
    this.decagonPlane = this.distanceToFacePlane(DECAGON_RADIUS);
    this.hexagonPlane = this.distanceToFacePlane(HEXAGON_RADIUS);
    this.squarePlane = this.distanceToFacePlane(SQUARE_RADIUS);
  }

  public build(): Object3D {
    this.builder.addConvexPolyhedron({
      vertices: this.flags.map((flag) => this.cornerOf(flag)),
      faces: this.buildFaces(),
      radius: CIRCUMRADIUS,
      colorForFace: (vertexCount) => this.colorFor(vertexCount),
    });

    return this.builder.mesh;
  }

  // 30 edges x 2 faces along each x 2 endpoints = 120. Nothing here filters or
  // deduplicates, so a wrong icosahedron shows up as a wrong flag count rather
  // than as a subtly wrong picture.
  private buildFlags(): Flag[] {
    const flags: Flag[] = [];

    this.icosahedron.edges.forEach(([first, second], edge) => {
      this.icosahedron.faces.forEach((face, index) => {
        if (!face.includes(first) || !face.includes(second)) {
          return;
        }

        flags.push({ vertex: first, edge, face: index });
        flags.push({ vertex: second, edge, face: index });
      });
    });

    return flags;
  }

  // The same 120 flags grouped three ways: by the vertex they carry (12 decagons
  // of 10), by the face (20 hexagons of 6), by the edge (30 squares of 4). Every
  // flag lands in exactly one group of each kind, which is the incidence
  // structure of the omnitruncation written out.
  private buildFaces(): number[][] {
    return [
      ...this.icosahedron.vertices.map((_, vertex) => this.flagsWhere((flag) => flag.vertex === vertex)),
      ...this.icosahedron.faces.map((_, face) => this.flagsWhere((flag) => flag.face === face)),
      ...this.icosahedron.edges.map((_, edge) => this.flagsWhere((flag) => flag.edge === edge)),
    ];
  }

  private flagsWhere(predicate: (flag: Flag) => boolean): number[] {
    return this.flags.reduce<number[]>((indices, flag, index) => {
      if (predicate(flag)) {
        indices.push(index);
      }

      return indices;
    }, []);
  }

  // Cramer's rule on the three face planes n·x = d. The determinant is the scalar
  // triple product of the three axes, and it is never near zero: the 5-, 3- and
  // 2-fold axes through one flag are mutually inclined by tens of degrees.
  private cornerOf(flag: Flag): number[] {
    const fiveFold = this.axisThrough([flag.vertex]);
    const threeFold = this.axisThrough(this.icosahedron.faces[flag.face]);
    const twoFold = this.axisThrough(this.icosahedron.edges[flag.edge]);

    const corner = this.vec.add(
      this.vec.add(
        this.vec.scale(this.vec.cross(threeFold, twoFold), this.decagonPlane),
        this.vec.scale(this.vec.cross(twoFold, fiveFold), this.hexagonPlane),
      ),
      this.vec.scale(this.vec.cross(fiveFold, threeFold), this.squarePlane),
    );

    return this.vec.scale(corner, 1 / this.vec.dot(fiveFold, this.vec.cross(threeFold, twoFold)));
  }

  // One helper for all three axes, because the centroid of a single vertex is
  // that vertex, of two is the edge midpoint, and of three is the face centre.
  private axisThrough(vertexIndices: number[]): Vec3 {
    return this.vec.normalize(this.vec.centroid(vertexIndices.map((index) => this.icosahedron.vertices[index])));
  }

  private distanceToFacePlane(polygonCircumradius: number): number {
    return Math.sqrt(CIRCUMRADIUS_SQUARED - polygonCircumradius ** 2);
  }

  private colorFor(vertexCount: number): string {
    if (vertexCount === 10) {
      return DECAGON_COLOR;
    }

    return vertexCount === 6 ? HEXAGON_COLOR : SQUARE_COLOR;
  }
}

export default TruncatedIcosidodecahedronGenerator;
