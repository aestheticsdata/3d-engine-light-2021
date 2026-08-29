// The winding trap, asserted. An inside-out component renders happily — the
// epic's own warning — and nothing else in the toolchain says so: the geometry
// baseline records what the mesh IS, not whether each ball closes outward
// about its own atom. The sign convention is the registry's: a demo-sphere
// triangle winds so that cross(b - a, c - a) points AGAINST the outward
// direction, and TorusKnotGenerator keeps a triangle on dot <= 0. Every ball
// and rod here is held to that sign about its OWN component's centre — never
// about the centroid of the whole, which for a molecule is inside nothing.
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
// three 12-point rings carrying two 24-triangle bands.
const BALL_POINTS = 195;
const BALL_TRIANGLES = 336;
const ROD_TRIANGLES = 48;
// Three rings — one at each atom, one at the midpoint — of latSegments points.
const ROD_POINTS = 3 * 12;
// 100·√3, the corner of the registry's cube. It was 100 until the baseline was
// read back and the ceiling turned out to sit under the donut's 110 and the
// cross's 108.6; MoleculeGenerator's own comment carries that measurement
// across the whole registry. Restated here by hand for the same reason
// POLY_BUDGET is.
const ENVELOPE_RADIUS = 100 * Math.sqrt(3);
const BALL_RADIUS_SCALE = 0.5;
// Restated here for the same reason POLY_BUDGET is: the generator owns it, and
// this suite has to agree with it by hand rather than by import.
const ENGINE_UNITS_PER_ANGSTROM = 22;

const vec = new Vec3Math();

const asVec = (point: number[]): Vec3 => [point[0], point[1], point[2]];

const waterCentres = (): Vec3[] => {
  const centroid = vec.centroid(waterMolecule.atoms.map((atom) => atom.position));

  return waterMolecule.atoms.map((atom) => vec.scale(vec.sub(atom.position, centroid), ENGINE_UNITS_PER_ANGSTROM));
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

  it("winds every ball triangle outward about its own atom's centre", () => {
    const centres = waterCentres();
    let violations = 0;

    for (let ball = 0; ball < waterMolecule.atoms.length; ball += 1) {
      for (let index = ball * BALL_TRIANGLES; index < (ball + 1) * BALL_TRIANGLES; index += 1) {
        const { normal, centre } = facing(mesh, index);

        if (vec.magnitude(normal) > 1e-9 && vec.dot(normal, vec.sub(centre, centres[ball])) >= 0) {
          violations += 1;
        }
      }
    }

    expect(violations).toBe(0);
  });

  it("winds every rod triangle outward about its own axis", () => {
    const centres = waterCentres();
    const firstRodTriangle = waterMolecule.atoms.length * BALL_TRIANGLES;
    let violations = 0;

    waterMolecule.bonds.forEach((bond, rod) => {
      const start = centres[bond.a];
      const axis = vec.normalize(vec.sub(centres[bond.b], start));

      for (
        let index = firstRodTriangle + rod * ROD_TRIANGLES;
        index < firstRodTriangle + (rod + 1) * ROD_TRIANGLES;
        index += 1
      ) {
        const { normal, centre } = facing(mesh, index);
        const foot = vec.add(start, vec.scale(axis, vec.dot(vec.sub(centre, start), axis)));

        if (vec.dot(normal, vec.sub(centre, foot)) >= 0) {
          violations += 1;
        }
      }
    });

    expect(violations).toBe(0);
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

  it("keeps every molecule inside the registry envelope", () => {
    Object.entries(shapeInfo)
      .filter(([, info]) => info.family === "MOLECULES")
      .forEach(([key]) => {
        const distances = data[key as keyof typeof data].points.map((point) =>
          Math.hypot(point[0], point[1], point[2]),
        );

        expect(Math.max(...distances)).toBeLessThanOrEqual(ENVELOPE_RADIUS + 1e-6);
      });
  });

  // The invariant that replaced "every molecule fills the envelope", and the
  // reason it was replaced: filling the envelope made the drawn size of an atom
  // depend on how big the rest of its molecule was, so an oxygen came out 4.65x
  // larger in water than in caffeine. Over the whole family rather than over a
  // pair, because the failure is a spread and a pair can agree by luck.
  it("draws a given element at one size in every molecule", () => {
    const radii = new Map<string, Set<number>>();

    Object.entries(moleculeInfo).forEach(([, info]) => {
      info?.structure.atoms.forEach((atom) => {
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
        // Twenty Ångströms apart, so the reach is 223 engine units. It was
        // twelve when the ceiling was 100, which is now inside it.
        { element: "H", position: [20, 0, 0] },
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
