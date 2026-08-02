// kisRhombic triacontahedron (kR30), better known as the disdyakis
// triacontahedron — R30 with a pyramid raised on each of its 30 rhombic faces,
// and the dual of the truncated icosidodecahedron. The densest solid in this
// family, and the icosahedral counterpart of the kisrhombic dodecahedron.
//
// 62 vertices, 180 edges, 120 triangular faces.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Disdyakis_triacontahedron
//   https://mathworld.wolfram.com/DisdyakisTriacontahedron.html

import Icosahedron, { PHI } from "@data/builders/Icosahedron";
import MeshBuilder from "@data/builders/MeshBuilder";
import { AXES } from "@data/builders/symmetry";

import type { Object3D } from "@data/types";

const CIRCUMRADIUS = 100;

// Two tones alternating around each pyramid. Per-triangle colour is honest here
// in a way it is not for the rhombic solids: these 120 triangles are the real
// faces, not the fan artifacts of a polygon. The alternation is what makes the
// four sides of a pyramid legible as four faces, so the tones are kept far apart
// in lightness.
const FACE_COLORS = ["rgba(126, 166, 224, 1)", "rgba(44, 74, 138, 1)"];

// Placing the three orbits — the same decision as kR12, and the same answer.
//
// Raising pyramids on a *rigid* R30 gives 120 congruent triangles at any apex
// height; icosahedral symmetry alone guarantees that much, so congruence does
// not pin the height down. What singles out the disdyakis triacontahedron from
// that family is the dual condition, and meeting it moves all three orbits, not
// just the apexes. So the solid is built as the reciprocal of tID rather than as
// a tuned pyramid height, and there is no fitted constant anywhere here.
//
// tID is Archimedean: with unit edges every vertex sits at one circumradius and
// every face is a regular polygon, so the distance from the centre to a p-gonal
// face is √(R² − r_p²), where r_p = 1/(2·sin(π/p)) is that polygon's own
// circumradius — φ for the decagon, 1 for the hexagon, 1/√2 for the square.
// Reciprocating a face plane at distance d gives a dual vertex at 1/d along the
// same axis, which is all three orbits at once.
const TID_CIRCUMRADIUS_SQUARED = (31 + 12 * Math.sqrt(5)) / 4;

// A face and the tone it carries, in one record. They were two arrays rejoined
// by index, and nothing but discipline kept them the same length.
interface PyramidFace {
  vertices: number[];
  tone: number;
}

class KisRhombicTriacontahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly icosahedron: Icosahedron;
  private readonly fiveFoldRadius: number;
  private readonly threeFoldRadius: number;
  private readonly twoFoldRadius: number;

  constructor(icosahedron: Icosahedron = new Icosahedron()) {
    this.builder = new MeshBuilder();
    this.icosahedron = icosahedron;
    // Decagons sit on the 5-fold axes, hexagons on the 3-fold, squares on the
    // 2-fold — so those become R30's icosahedral corners, its dodecahedral
    // corners, and the new apexes respectively.
    this.fiveFoldRadius = this.reciprocalOfFacePlane(PHI);
    this.threeFoldRadius = this.reciprocalOfFacePlane(1);
    this.twoFoldRadius = this.reciprocalOfFacePlane(1 / Math.SQRT2);
  }

  public build(): Object3D {
    const faces = this.buildFaces();

    this.builder.addConvexPolyhedron({
      vertices: this.buildVertices(),
      faces: faces.map((face) => face.vertices),
      radius: CIRCUMRADIUS,
      colorForFace: (_vertexCount, faceIndex) => FACE_COLORS[faces[faceIndex].tone],
    });

    return this.builder.mesh;
  }

  // 12 five-fold corners of degree 10, then 20 three-fold corners of degree 6,
  // one per icosahedron face, then 30 apexes of degree 4, one over each R30
  // rhombus — that is, one per icosahedron edge.
  private buildVertices(): number[][] {
    return [
      ...this.icosahedron.vertices.map((vertex) => this.alongDirection(vertex, this.fiveFoldRadius)),
      ...this.icosahedron.faces.map((face) => this.alongDirection(this.sumOf(face), this.threeFoldRadius)),
      ...this.icosahedron.edges.map((edge) => this.alongDirection(this.sumOf(edge), this.twoFoldRadius)),
    ];
  }

  private buildFaces(): PyramidFace[] {
    const threeFoldOffset = this.icosahedron.vertices.length;
    const apexOffset = threeFoldOffset + this.icosahedron.faces.length;
    const faces: PyramidFace[] = [];

    this.icosahedron.edges.forEach(([first, second], edge) => {
      const apex = apexOffset + edge;

      // The rhombus under this apex, exactly as R30 builds it: the edge's two
      // endpoints are its five-fold corners, and the two icosahedron faces
      // meeting along that edge give its three-fold corners.
      const corners = this.icosahedron.faces.reduce<number[]>((indices, face, index) => {
        if (face.includes(first) && face.includes(second)) {
          indices.push(threeFoldOffset + index);
        }

        return indices;
      }, []);

      // Walking the rhombus alternates tip, corner, tip, corner, so every one
      // of its four edges runs from a tip to a corner — which makes the
      // pyramid's four triangles simply the four (tip, corner) pairs, with
      // nothing to order by hand. Consecutive pairs around that walk differ in
      // exactly one slot, so the parity of the two slots alternates the tone
      // around the pyramid.
      [first, second].forEach((tip, tipSlot) => {
        corners.forEach((corner, cornerSlot) => {
          faces.push({
            vertices: [apex, tip, corner],
            tone: (tipSlot + cornerSlot) % 2,
          });
        });
      });
    });

    return faces;
  }

  private reciprocalOfFacePlane(polygonCircumradius: number): number {
    return 1 / Math.sqrt(TID_CIRCUMRADIUS_SQUARED - polygonCircumradius ** 2);
  }

  private alongDirection(direction: number[], radius: number): number[] {
    const length = Math.hypot(...direction);

    return direction.map((component) => (component / length) * radius);
  }

  private sumOf(vertexIndices: number[]): number[] {
    return AXES.map((axis) => vertexIndices.reduce((sum, vertex) => sum + this.icosahedron.vertices[vertex][axis], 0));
  }
}

export default KisRhombicTriacontahedronGenerator;
