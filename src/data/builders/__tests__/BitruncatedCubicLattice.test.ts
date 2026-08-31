// The counts HAL-129 asked to have asserted rather than asserted about, and the
// one that would have caught the mistake the ticket walked into.
//
// muCO and muO are complementary sub-complexes of one honeycomb, so it is
// tempting to give them one `sideA` rule as well. They cannot share one. The
// rule 2-colours the cells across the faces a sponge KEEPS, and the two sponges
// keep opposite classes, so each rule is exactly wrong for the other sponge —
// which shows up as half the surface wound backwards and nothing thrown. The
// last two cases below pin that in both directions.
//
// The honeycomb is walked here rather than the mesh: SkewApeirohedronBuilder
// hands back triangles, and a claim about hexagons per vertex cannot be read off
// a fan. A block of 5 is used for the incidence counts because a vertex only
// counts when all four of its cells are present, and the interior has to be
// wide enough to be worth counting.

import BitruncatedCubicLattice from "@data/builders/BitruncatedCubicLattice";
import { describe, expect, it } from "vitest";

import type { BitruncatedCubicCell } from "@data/builders/BitruncatedCubicLattice";

interface PlacedFace {
  sides: number;
  ring: string[];
  cells: BitruncatedCubicCell[];
}

const keyOf = (point: number[]): string => point.join(",");

// The two candidate colourings, named so that each assertion below reads as the
// claim it is making rather than as arithmetic.
const bySublattice = (cell: BitruncatedCubicCell): boolean => !cell.bodyCentred;
const byIndexParity = (cell: BitruncatedCubicCell): boolean =>
  (cell.index[0] + cell.index[1] + cell.index[2]) % 2 === 0;

const place = (cell: BitruncatedCubicCell, ring: number[][]): string[] =>
  ring.map((offset) => keyOf(offset.map((value, axis) => value + cell.centre[axis])));

// Every distinct face of the honeycomb, with the cells that offered it. A face
// offered twice is interior to the block; one offered once is on its skin.
const facesOf = (lattice: BitruncatedCubicLattice, keepSquares: boolean): PlacedFace[] => {
  const faces = new Map<string, PlacedFace>();

  lattice.cells.forEach((cell) => {
    const rings = [
      ...(keepSquares ? lattice.squares.map((ring) => ({ ring, sides: 4 })) : []),
      ...lattice.hexagons.map((hexagon) => ({ ring: hexagon.ring, sides: 6 })),
    ];

    rings.forEach(({ ring, sides }) => {
      const placed = place(cell, ring);
      const key = [...placed].sort().join("|");
      const existing = faces.get(key);

      if (existing) {
        existing.cells.push(cell);

        return;
      }

      faces.set(key, { sides, ring: placed, cells: [cell] });
    });
  });

  return [...faces.values()];
};

// Vertices and edges, each carrying the faces around it. Interior means every
// face touching it is shared by two cells, which is the same thing as the whole
// neighbourhood being inside the block.
const incidence = (faces: PlacedFace[], atEdges: boolean): number[][] => {
  const table = new Map<string, PlacedFace[]>();

  faces.forEach((face) => {
    face.ring.forEach((point, index) => {
      const key = atEdges ? [point, face.ring[(index + 1) % face.ring.length]].sort().join("|") : point;

      table.set(key, [...(table.get(key) ?? []), face]);
    });
  });

  return [...table.values()]
    .filter((around) => around.every((face) => face.cells.length === 2))
    .map((around) => around.map((face) => face.sides).sort());
};

const lattice = new BitruncatedCubicLattice(5);
const honeycomb = facesOf(lattice, true);
const sponge = facesOf(lattice, false);

describe("the bitruncated cubic honeycomb", () => {
  it("puts one square and two hexagons on every interior edge", () => {
    const edges = incidence(honeycomb, true);

    expect(edges).not.toHaveLength(0);
    edges.forEach((sides) => {
      expect(sides).toEqual([4, 6, 6]);
    });
  });

  it("puts two squares and four hexagons at every interior vertex", () => {
    const vertices = incidence(honeycomb, false);

    expect(vertices).not.toHaveLength(0);
    vertices.forEach((sides) => {
      expect(sides).toEqual([4, 4, 6, 6, 6, 6]);
    });
  });

  // Which is what makes each sponge's labyrinths what they are: deleting the
  // squares leaves the two sublattices unjoined, deleting hexagons welds them.
  it("shares every square within one sublattice and every hexagon across the two", () => {
    honeycomb
      .filter((face) => face.cells.length === 2)
      .forEach((face) => {
        const across = face.cells[0].bodyCentred !== face.cells[1].bodyCentred;

        expect(across).toBe(face.sides === 6);
      });
  });
});

describe("the muoctahedron, which is that honeycomb with every square deleted", () => {
  it("leaves two faces on every interior edge, which is what a surface needs", () => {
    const edges = incidence(sponge, true);

    expect(edges).not.toHaveLength(0);
    edges.forEach((sides) => {
      expect(sides).toEqual([6, 6]);
    });
  });

  it("leaves four hexagons at every interior vertex, which is {6,4}", () => {
    const vertices = incidence(sponge, false);

    expect(vertices).not.toHaveLength(0);
    vertices.forEach((sides) => {
      expect(sides).toEqual([6, 6, 6, 6]);
    });
  });

  // What the copper alternation is painted from. Two hexagons meeting along an
  // edge belong to one cell and differ in exactly one sign, so the sign product
  // never repeats across an edge — the tones say something about the surface
  // rather than picking a side at random.
  //
  // The class has to be read from a FIXED side. A hexagon is offered by its plain
  // cell in direction s and by its body-centred cell in direction -s, and those
  // have opposite sign products, so the value is a property of the pair and not
  // of the face alone. Reading it from the plain cell is what `outward` amounts
  // to in the generator, which is why that one is well defined.
  it("has no two neighbouring hexagons of the same sign-product class", () => {
    const classOf = new Map<string, number>();

    lattice.cells
      .filter((cell) => !cell.bodyCentred)
      .forEach((cell) => {
        lattice.hexagons.forEach((hexagon) => {
          classOf.set([...place(cell, hexagon.ring)].sort().join("|"), hexagon.signProduct);
        });
      });

    const edges = new Map<string, string[]>();

    sponge.forEach((face) => {
      const key = [...face.ring].sort().join("|");

      face.ring.forEach((point, index) => {
        const edge = [point, face.ring[(index + 1) % face.ring.length]].sort().join("|");

        edges.set(edge, [...(edges.get(edge) ?? []), key]);
      });
    });

    // Only edges whose two hexagons both have a plain cell inside the block have
    // a class to compare; the block's skin does not.
    const meeting = [...edges.values()].filter((keys) => keys.length === 2 && keys.every((key) => classOf.has(key)));

    expect(meeting.length).toBeGreaterThan(0);
    meeting.forEach(([first, second]) => {
      expect(classOf.get(first)).not.toBe(classOf.get(second));
    });
  });

  it("is 2-coloured by the sublattice, and is not by muCO's index parity", () => {
    const shared = sponge.filter((face) => face.cells.length === 2);
    const disagreeing = (side: (cell: BitruncatedCubicCell) => boolean) =>
      shared.filter((face) => side(face.cells[0]) !== side(face.cells[1])).length;

    expect(shared.length).toBeGreaterThan(0);
    expect(disagreeing(bySublattice)).toBe(shared.length);
    expect(disagreeing(byIndexParity)).toBeLessThan(shared.length);
  });
});

describe("the mucuboctahedron, which keeps the squares and half the hexagons", () => {
  it("is 2-coloured by muCO's index parity, and is not by the sublattice", () => {
    const faces = new Map<string, BitruncatedCubicCell[]>();

    lattice.cells.forEach((cell) => {
      const kept = cell.bodyCentred ? 1 : -1;
      const rings = [
        ...lattice.squares,
        ...lattice.hexagons.filter((hexagon) => hexagon.signProduct === kept).map((hexagon) => hexagon.ring),
      ];

      rings.forEach((ring) => {
        const key = [...place(cell, ring)].sort().join("|");

        faces.set(key, [...(faces.get(key) ?? []), cell]);
      });
    });

    const shared = [...faces.values()].filter((cells) => cells.length === 2);
    const disagreeing = (side: (cell: BitruncatedCubicCell) => boolean) =>
      shared.filter((cells) => side(cells[0]) !== side(cells[1])).length;

    expect(shared.length).toBeGreaterThan(0);
    expect(disagreeing(byIndexParity)).toBe(shared.length);
    expect(disagreeing(bySublattice)).toBeLessThan(shared.length);
  });
});
