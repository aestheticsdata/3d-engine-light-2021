// The counts HAL-131 asked to have confirmed from a built-out block, taken off
// the shipped mesh rather than off a second copy of the lattice — a test that
// rebuilt the diamond lattice would agree with itself whatever the generator did.
//
// Hexagons are recovered through SkewApeirohedronBuilder's emission contract: a
// face of n sides is fanned from its first vertex, and each fan triangle is
// followed immediately by its own reversed copy. A hexagon is therefore eight
// triangles — (r0,r1,r2), mirror, (r0,r2,r3), mirror, (r0,r3,r4), mirror,
// (r0,r4,r5), mirror — and the ring is read from every other one of them. muT has
// no other polygon, which is what makes the block size constant.
//
// INTERIOR, defined without reference to the cells because the mesh has none: an
// edge is closed when it carries two faces, and a vertex is interior when every
// edge at it is closed.

import MutetrahedronGenerator from "@data/shapes/MutetrahedronGenerator";
import { describe, expect, it } from "vitest";

const TRIANGLES_PER_HEXAGON = 8;

const mutetrahedron = new MutetrahedronGenerator().build();

const faces = (): { ring: number[]; outer: string }[] => {
  const built: { ring: number[]; outer: string }[] = [];

  for (let index = 0; index < mutetrahedron.triangles.length; index += TRIANGLES_PER_HEXAGON) {
    const fan = [0, 2, 4, 6].map((step) => mutetrahedron.triangles[index + step]);

    built.push({
      ring: [fan[0][0], fan[0][1], fan[0][2], fan[1][2], fan[2][2], fan[3][2]],
      outer: fan[0][3] as string,
    });
  }

  return built;
};

const edgeKey = (first: number, second: number): string => [first, second].sort((a, b) => a - b).join("-");

const hexagons = faces();

const facesPerEdge = new Map<string, number>();
const edgesPerVertex = new Map<number, string[]>();
const hexagonsPerVertex = new Map<number, number>();
const tonesPerEdge = new Map<string, string[]>();

hexagons.forEach((face) => {
  face.ring.forEach((point, index) => {
    const edge = edgeKey(point, face.ring[(index + 1) % face.ring.length]);

    facesPerEdge.set(edge, (facesPerEdge.get(edge) ?? 0) + 1);
    tonesPerEdge.set(edge, [...(tonesPerEdge.get(edge) ?? []), face.outer]);
    edgesPerVertex.set(point, [...(edgesPerVertex.get(point) ?? []), edge]);
    hexagonsPerVertex.set(point, (hexagonsPerVertex.get(point) ?? 0) + 1);
  });
});

const interiorVertices = [...edgesPerVertex.entries()]
  .filter(([, edges]) => edges.every((edge) => facesPerEdge.get(edge) === 2))
  .map(([point]) => point);

describe("MutetrahedronGenerator", () => {
  it("recovers a whole number of hexagons from the triangle list", () => {
    expect(mutetrahedron.triangles.length % TRIANGLES_PER_HEXAGON).toBe(0);
    expect(hexagons).toHaveLength(mutetrahedron.triangles.length / TRIANGLES_PER_HEXAGON);
    hexagons.forEach((face) => {
      expect(new Set(face.ring).size).toBe(6);
    });
  });

  it("leaves no edge carrying more than two faces", () => {
    expect([...facesPerEdge.values()].filter((count) => count > 2)).toHaveLength(0);
    expect([...facesPerEdge.values()].filter((count) => count === 2).length).toBeGreaterThan(0);
  });

  // {6,6}: six hexagons at every vertex whose neighbourhood is entirely present.
  // This is the count the ticket said would miss if the honeycomb were wrong.
  it("puts six hexagons at every interior vertex, which is {6,6}", () => {
    expect(interiorVertices.length).toBeGreaterThan(0);
    interiorVertices.forEach((point) => {
      expect(hexagonsPerVertex.get(point)).toBe(6);
    });
  });

  // The colouring is a claim about the surface, not a preference: the four tones
  // are the four hexagons of a truncated tetrahedron, and two faces meeting along
  // an edge never come from the same one. That is what makes it a proper colouring
  // rather than an arbitrary split, and it is the half of the header's colour
  // argument that can be checked here — the other half, that the four are matched
  // in value so they do not cancel the shading, only a render can settle.
  it("never paints two hexagons that meet along an edge the same tone", () => {
    const meeting = [...tonesPerEdge.values()].filter((tones) => tones.length === 2);

    expect(meeting.length).toBeGreaterThan(0);
    meeting.forEach(([first, second]) => {
      expect(first).not.toBe(second);
    });
  });

  it("paints every triangle one of the eight authored tones", () => {
    expect(new Set(mutetrahedron.triangles.map((triangle) => triangle[3])).size).toBe(8);
  });
});
