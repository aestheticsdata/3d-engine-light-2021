// The winding trap, asserted. An inside-out component renders happily — the
// epic's own warning — and nothing else in the toolchain says so: the geometry
// baseline records what the mesh IS, not whether each ball closes outward
// about its own atom. The sign convention is the registry's: a demo-sphere
// triangle winds so that cross(b - a, c - a) points AGAINST the outward
// direction, and TorusKnotGenerator keeps a triangle on dot <= 0. Every ball
// and rod here is held to that sign about its OWN component's centre — never
// about the centroid of the whole, which for a molecule is inside nothing.
//
// HELD OVER THE WHOLE FAMILY, not over water. It was water alone until
// HAL-171, with water's resolution written in as constants, and that is
// precisely why it could not be pointed at anything else: water is 3 atoms and
// 2 bonds at lat 12, caffeine is 24 and 25 at lat 11, so the constants that
// describe one divide the other into the wrong strides. The resolution is
// solved out of each built mesh below instead, which is what lets the family
// come out of shapeInfo and a molecule be covered on the day it lands.
//
// The centring and scaling are restated from the generator rather than
// imported, the same bargain the poly-budget number strikes below.

import Vec3Math from "@data/builders/Vec3Math";
import data from "@data/data";
import moleculeInfo from "@data/moleculeInfo";
import elements from "@data/molecules/elements";
import waterMolecule from "@data/molecules/water";
import shapeInfo from "@data/shapeInfo";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";
import { describe, expect, it } from "vitest";

import type { Molecule } from "@data/molecules/types";
import type { Object3D } from "@data/types";

type Vec3 = [number, number, number];

// GeometryWidget derives POLY BUDGET as the next power of two above the
// densest shape in the registry. It cannot be imported here — it reads the
// DOM — so the number is restated, exactly as TorusKnotGenerator's suite does.
const POLY_BUDGET = 8192;

// Water's derived resolution: 3 atoms and 2 bonds land on the 12-segment knob,
// so each ball is 13 x 15 = 195 points and 336 triangles, and each rod is
// three 12-point rings carrying two 24-triangle bands. These four stay literal
// where the family's do not: one molecule worked out by hand is what the
// solver below is checked against, and water is the cheapest such molecule
// there is.
const BALL_POINTS = 195;
const BALL_TRIANGLES = 336;
const ROD_TRIANGLES = 48;
// Three rings — one at each atom, one at the midpoint — of latSegments points.
const ROD_POINTS = 3 * 12;
// The family ceiling: what the stage frames at the default view, rounded down
// to 230. It was 100 — the sphere's radius misread as a registry ceiling —
// then the cube corner's 100·√3, whose argument turned out to be about the
// solids and not about molecules at all; the derivation is in
// MoleculeGenerator's own comment and the ruling in
// molecules/reference/decisions.md D1. Restated here by hand for the same
// reason POLY_BUDGET is.
const ENVELOPE_RADIUS = 230;
const BALL_RADIUS_SCALE = 0.5;
// Restated here for the same reason POLY_BUDGET is: the generator owns it, and
// this suite has to agree with it by hand rather than by import.
const ENGINE_UNITS_PER_ANGSTROM = 22;
// The generator's resolution range and its lat-to-lon offset, restated on the
// same terms. They are the search space the solver walks, so a knob moved in
// the generator and not here shows up as a mesh no lat explains rather than as
// a silently wrong stride.
const MAX_LAT_SEGMENTS = 12;
const MIN_LAT_SEGMENTS = 6;
const LON_SEGMENTS_OFFSET = 2;

const vec = new Vec3Math();

const asVec = (point: number[]): Vec3 => [point[0], point[1], point[2]];

// The generator's own cost arithmetic: a ball is a lat x lon quad grid at two
// triangles per quad, a rod two bands of lat quads.
const ballTrianglesAt = (latSegments: number): number => 2 * latSegments * (latSegments + LON_SEGMENTS_OFFSET);
const rodTrianglesAt = (latSegments: number): number => 4 * latSegments;

// The resolution recovered from the mesh rather than restated per molecule.
// Eight molecules would be eight pairs of constants drifting apart from the
// generator one knob at a time, which is the drift HAL-171 was filed about.
//
// Zero is returned rather than a fallback lat, because there is no lat it
// could be mistaken for: a mesh whose triangle count no resolution in the
// generator's range explains has to fail loudly at the assertion below, not
// divide the family up by a stride that happens to parse.
const latSegmentsOf = (molecule: Molecule, mesh: Object3D): number => {
  for (let lat = MAX_LAT_SEGMENTS; lat >= MIN_LAT_SEGMENTS; lat -= 1) {
    const triangles = molecule.atoms.length * ballTrianglesAt(lat) + molecule.bonds.length * rodTrianglesAt(lat);

    if (triangles === mesh.triangles.length) {
      return lat;
    }
  }

  return 0;
};

// Where each ball sits in the built mesh: the generator centres on the
// centroid of the atom positions and scales by the family's shared constant,
// and both are reproduced here rather than read back off the mesh, so a
// centring the generator gets wrong is a failure rather than a shared premise.
const centresOf = (molecule: Molecule): Vec3[] => {
  const centroid = vec.centroid(molecule.atoms.map((atom) => atom.position));

  return molecule.atoms.map((atom) => vec.scale(vec.sub(atom.position, centroid), ENGINE_UNITS_PER_ANGSTROM));
};

// The face normal by the registry's cross convention, and the triangle's own
// centroid — a zero normal marks the degenerate pole quads the UV sphere
// carries by construction, which no winding test can or should judge.
const facing = (mesh: Object3D, index: number): { normal: Vec3; centre: Vec3 } => {
  const [a, b, c] = mesh.triangles[index];
  const pointA = asVec(mesh.points[a]);
  const pointB = asVec(mesh.points[b]);
  const pointC = asVec(mesh.points[c]);

  return {
    normal: vec.cross(vec.sub(pointB, pointA), vec.sub(pointC, pointA)),
    centre: [
      (pointA[0] + pointB[0] + pointC[0]) / 3,
      (pointA[1] + pointB[1] + pointC[1]) / 3,
      (pointA[2] + pointB[2] + pointC[2]) / 3,
    ],
  };
};

// The family as the picker sees it, read out of shapeInfo the way
// moleculeInfo.ts reads it and for the same reason: a second list of molecule
// keys drifts from the registry, and the molecule that fell out of this one
// would go unchecked in exactly the way HAL-171 exists to stop.
const moleculeKeys = Object.entries(shapeInfo)
  .filter(([, info]) => info.family === "MOLECULES")
  .map(([key]) => key);

const moleculeCases = moleculeKeys.flatMap((key) => {
  const molecule = moleculeInfo[key]?.structure;
  const mesh = data[key as keyof typeof data];

  return molecule === undefined ? [] : [{ key, molecule, mesh, latSegments: latSegmentsOf(molecule, mesh) }];
});

describe("MoleculeGenerator", () => {
  const mesh = new MoleculeGenerator(waterMolecule).build();

  it("builds water at the derived resolution, inside the poly budget", () => {
    expect(mesh.points.length).toBe(3 * BALL_POINTS + 2 * ROD_POINTS);
    expect(mesh.triangles.length).toBe(3 * BALL_TRIANGLES + 2 * ROD_TRIANGLES);
    expect(mesh.triangles.length).toBeLessThanOrEqual(POLY_BUDGET);
  });

  it("leaves the registry's derived budget on 8192", () => {
    const densest = Math.max(...Object.values(data).map((object3D) => object3D.triangles.length));

    expect(2 ** Math.ceil(Math.log2(densest))).toBe(POLY_BUDGET);
  });

  // The guard that keeps every it.each below from passing by never running.
  // The list is built by a flatMap that drops a key with no chemistry entry,
  // and a silently shorter list is a silently narrower suite.
  it("covers every molecule the picker lists, at a resolution the generator's arithmetic explains", () => {
    expect(moleculeCases.length).toBe(moleculeKeys.length);
    expect(moleculeCases.length).toBeGreaterThan(1);

    // Water is the worked example the solver is checked against: 3 atoms and
    // 2 bonds at lat 12 is the one resolution in this suite derived twice, by
    // hand above and by search here.
    expect(moleculeCases.find((entry) => entry.key === "water")?.latSegments).toBe(MAX_LAT_SEGMENTS);
    moleculeCases.forEach(({ latSegments }) => {
      expect(latSegments).toBeGreaterThanOrEqual(MIN_LAT_SEGMENTS);
    });
  });

  it.each(moleculeCases)("winds every ball triangle outward about its own atom's centre: $key", ({
    molecule,
    mesh: built,
    latSegments,
  }) => {
    const centres = centresOf(molecule);
    const ballTriangles = ballTrianglesAt(latSegments);
    let violations = 0;
    let judged = 0;

    for (let ball = 0; ball < molecule.atoms.length; ball += 1) {
      for (let index = ball * ballTriangles; index < (ball + 1) * ballTriangles; index += 1) {
        const { normal, centre } = facing(built, index);

        if (vec.magnitude(normal) <= 1e-9) {
          continue;
        }

        judged += 1;

        if (vec.dot(normal, vec.sub(centre, centres[ball])) >= 0) {
          violations += 1;
        }
      }
    }

    expect(violations).toBe(0);

    // A count rather than a "greater than zero", because the number of
    // triangles no winding test can judge is itself derivable and worth
    // pinning: the UV sphere's two pole rows contribute exactly one
    // degenerate quad-half per longitude each, so 2·lon per ball — 84 across
    // water, 624 across caffeine. Anything else means the seam changed shape
    // and the skip is swallowing triangles it was never meant to.
    expect(judged).toBe(molecule.atoms.length * (ballTriangles - 2 * (latSegments + LON_SEGMENTS_OFFSET)));
  });

  it.each(moleculeCases)("winds every rod triangle outward about its own axis: $key", ({
    molecule,
    mesh: built,
    latSegments,
  }) => {
    const centres = centresOf(molecule);
    const rodTriangles = rodTrianglesAt(latSegments);
    const firstRodTriangle = molecule.atoms.length * ballTrianglesAt(latSegments);
    let violations = 0;

    molecule.bonds.forEach((bond, rod) => {
      const start = centres[bond.a];
      const axis = vec.normalize(vec.sub(centres[bond.b], start));

      for (
        let index = firstRodTriangle + rod * rodTriangles;
        index < firstRodTriangle + (rod + 1) * rodTriangles;
        index += 1
      ) {
        const { normal, centre } = facing(built, index);
        const foot = vec.add(start, vec.scale(axis, vec.dot(vec.sub(centre, start), axis)));

        if (vec.dot(normal, vec.sub(centre, foot)) >= 0) {
          violations += 1;
        }
      }
    });

    expect(violations).toBe(0);
    // The rods are the tail of the mesh, so this is what says the loop above
    // walked all of them and stopped at the end of the last.
    expect(built.triangles.length).toBe(firstRodTriangle + molecule.bonds.length * rodTriangles);
  });

  it("colours each component from its own atom's CPK fill", () => {
    const fills = mesh.triangles.map((triangle) => triangle[3]);
    const oxygen = elements.O.fill;
    const hydrogen = elements.H.fill;

    expect(new Set(fills.slice(0, BALL_TRIANGLES))).toEqual(new Set([oxygen]));
    expect(new Set(fills.slice(BALL_TRIANGLES, 3 * BALL_TRIANGLES))).toEqual(new Set([hydrogen]));
    expect(fills.filter((fill) => fill === oxygen).length).toBe(BALL_TRIANGLES + 2 * (ROD_TRIANGLES / 2));
    expect(fills.filter((fill) => fill === hydrogen).length).toBe(2 * BALL_TRIANGLES + 2 * (ROD_TRIANGLES / 2));
  });

  it.each(moleculeCases)("keeps the mesh inside the family envelope: $key", ({ mesh: built }) => {
    const distances = built.points.map((point) => Math.hypot(point[0], point[1], point[2]));

    expect(Math.max(...distances)).toBeLessThanOrEqual(ENVELOPE_RADIUS + 1e-6);
  });

  // The invariant that replaced "every molecule fills the envelope", and the
  // reason it was replaced: filling the envelope made the drawn size of an atom
  // depend on how big the rest of its molecule was, so an oxygen came out 4.65x
  // larger in water than in caffeine. Over the whole family rather than over a
  // pair, because the failure is a spread and a pair can agree by luck.
  it("draws a given element at one size in every molecule", () => {
    const radii = new Map<string, Set<number>>();

    moleculeCases.forEach(({ molecule }) => {
      molecule.atoms.forEach((atom) => {
        const drawn = elements[atom.element].covalentRadius * BALL_RADIUS_SCALE * ENGINE_UNITS_PER_ANGSTROM;
        radii.set(atom.element, (radii.get(atom.element) ?? new Set()).add(Number(drawn.toFixed(9))));
      });
    });

    expect(radii.size).toBeGreaterThan(1);
    radii.forEach((sizes) => {
      expect(sizes.size).toBe(1);
    });
  });

  // The envelope is a ceiling now rather than a target, so something has to
  // stop a molecule slipping past it. Shrinking the shared scale to fit a
  // newcomer would resize every mesh that was already right.
  it("throws rather than rescaling the family when a molecule overflows the envelope", () => {
    const sprawl: Molecule = {
      name: "Sprawl",
      atoms: [
        { element: "H", position: [0, 0, 0] },
        // Twenty-four Ångströms apart, so the reach is 267 engine units. This
        // fixture has now been stretched twice — twelve Å overflowed the
        // 100-unit ceiling, twenty the cube corner's 173.2 — and each stretch
        // was a recorded raise of the ceiling, not drift; the current one is
        // decisions.md D1.
        { element: "H", position: [24, 0, 0] },
      ],
      bonds: [{ a: 0, b: 1, order: 1 }],
    };

    expect(() => new MoleculeGenerator(sprawl)).toThrow(/envelope/);
  });

  // Asserted as translation invariance rather than as "the two hydrogens
  // straddle x = 0", which is what this checked until HAL-173. That older form
  // read the mesh's x extent, and it happened to work only because the ball
  // tessellation was symmetric about x at an even longitude count: at 12 lat
  // segments the ball took 14 longitudes, and max + min cancelled. Seventeen
  // takes 19, an odd count whose sampling is not mirror-symmetric, so the
  // extent no longer cancels — by 0.046 units on a 3.41-unit hydrogen — while
  // the centring it was standing in for is untouched.
  //
  // Centring on the centroid IS translation invariance, so this asserts it
  // directly and cannot be fooled by how the sphere is sampled.
  it("centres the mesh on the atoms' centroid, so moving the molecule changes nothing", () => {
    const shifted = new MoleculeGenerator({
      ...waterMolecule,
      atoms: waterMolecule.atoms.map((atom) => ({
        ...atom,
        position: [atom.position[0] + 7, atom.position[1] - 3, atom.position[2] + 11] as Vec3,
      })),
    }).build();

    const drift = Math.max(
      ...shifted.points.flatMap((point, index) =>
        point.map((value, axis) => Math.abs(value - mesh.points[index][axis])),
      ),
    );

    expect(drift).toBeLessThan(1e-9);
  });

  it("throws rather than clamping when a molecule cannot fit the budget", () => {
    const crowd: Molecule = {
      name: "Crowd",
      atoms: Array.from({ length: 200 }, (_, index) => ({ element: "H" as const, position: [index, 0, 0] })),
      bonds: [],
    };

    expect(() => new MoleculeGenerator(crowd)).toThrow(/budget/);
  });
});
