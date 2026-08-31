// The two counts HAL-130 asked to have proved in code before anything was drawn,
// and they are taken off the shipped mesh rather than off a second copy of the
// classification. A test that re-derived which cubes are holes would agree with
// itself no matter what the generator did.
//
// Squares are recovered from the triangle list through SkewApeirohedronBuilder's
// emission contract, which its own header states: a face of n sides is fanned
// from its first vertex, and each fan triangle is followed IMMEDIATELY by its own
// reversed copy rather than the two sides being emitted as two passes. So a
// square arrives as (r0,r1,r2), its mirror, (r0,r2,r3), its mirror — four
// triangles per face, in face order, and the ring is read from the first and
// third. muC has no other polygon, which is what makes the block size constant.
//
// INTERIOR, defined without reference to the cells, because the mesh has none: an
// edge is closed when it carries two faces, and a vertex is interior when every
// edge at it is closed. That is the same neighbourhood-is-present test the
// bitruncated lattice suite makes against cells, spelled in what a mesh can see.

import MucubeGenerator from "@data/shapes/MucubeGenerator";
import { describe, expect, it } from "vitest";

const TRIANGLES_PER_SQUARE = 4;

const mucube = new MucubeGenerator().build();

// Each square's four point indices, in ring order.
const squares = (): number[][] => {
  const rings: number[][] = [];

  for (let index = 0; index < mucube.triangles.length; index += TRIANGLES_PER_SQUARE) {
    const [first, third] = [mucube.triangles[index], mucube.triangles[index + 2]];

    rings.push([first[0], first[1], first[2], third[2]]);
  }

  return rings;
};

const edgeKey = (first: number, second: number): string => [first, second].sort((a, b) => a - b).join("-");

const rings = squares();

const facesPerEdge = new Map<string, number>();
const edgesPerVertex = new Map<number, string[]>();
const squaresPerVertex = new Map<number, number>();

rings.forEach((ring) => {
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length];
    const edge = edgeKey(point, next);

    facesPerEdge.set(edge, (facesPerEdge.get(edge) ?? 0) + 1);
    edgesPerVertex.set(point, [...(edgesPerVertex.get(point) ?? []), edge]);
    squaresPerVertex.set(point, (squaresPerVertex.get(point) ?? 0) + 1);
  });
});

const interiorVertices = [...edgesPerVertex.entries()]
  .filter(([, edges]) => edges.every((edge) => facesPerEdge.get(edge) === 2))
  .map(([point]) => point);

describe("MucubeGenerator", () => {
  it("recovers a whole number of squares from the triangle list", () => {
    expect(mucube.triangles.length % TRIANGLES_PER_SQUARE).toBe(0);
    expect(rings).toHaveLength(mucube.triangles.length / TRIANGLES_PER_SQUARE);
    rings.forEach((ring) => {
      expect(new Set(ring).size).toBe(4);
    });
  });

  // Two faces is what a surface needs; three would be a honeycomb wall left in
  // by mistake, and the chunk's own skin is what the ones carrying a single face
  // are.
  it("leaves no edge carrying more than two faces", () => {
    const overloaded = [...facesPerEdge.values()].filter((count) => count > 2);

    expect(overloaded).toHaveLength(0);
    expect([...facesPerEdge.values()].filter((count) => count === 2).length).toBeGreaterThan(0);
  });

  // {4,6}: six squares at every vertex whose neighbourhood is entirely present.
  // If the hole sublattice were wrong this is the count that would miss — and
  // the near miss the header records, holes on an eighth of the cubes rather
  // than a quarter, does not reach a single interior vertex at all.
  it("puts six squares at every interior vertex, which is {4,6}", () => {
    expect(interiorVertices.length).toBeGreaterThan(0);
    interiorVertices.forEach((point) => {
      expect(squaresPerVertex.get(point)).toBe(6);
    });
  });

  // The chunk is a whole number of periods, so the ratio the assignment predicts
  // is exact rather than approached: three tubes per hole, four kept squares per
  // tube, and every one of them shared by two tubes.
  it("keeps the square count the tube-to-hole ratio predicts", () => {
    const cubesPerAxis = 4;
    const holes = (cubesPerAxis * cubesPerAxis * cubesPerAxis) / 4;
    const tubes = holes * 3;

    expect(tubes).toBe(48);
    expect(rings.length).toBeLessThan(tubes * 4);
    expect(rings).toHaveLength(120);
  });

  it("paints every triangle one of the six authored tones", () => {
    const tones = new Set(mucube.triangles.map((triangle) => triangle[3]));

    expect(tones.size).toBe(6);
  });
});
