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
import elements from "@data/molecules/elements";
import waterMolecule from "@data/molecules/water";
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
const ENVELOPE_RADIUS = 100;
const BALL_RADIUS_SCALE = 0.5;

const vec = new Vec3Math();

const asVec = (point: number[]): Vec3 => [point[0], point[1], point[2]];

const waterCentres = (): Vec3[] => {
  const centroid = vec.centroid(waterMolecule.atoms.map((atom) => atom.position));
  const centred = waterMolecule.atoms.map((atom) => vec.sub(atom.position, centroid));
  const reach = Math.max(
    ...centred.map(
      (position, index) =>
        vec.magnitude(position) + elements[waterMolecule.atoms[index].element].covalentRadius * BALL_RADIUS_SCALE,
    ),
  );

  return centred.map((position) => vec.scale(position, ENVELOPE_RADIUS / reach));
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
    expect(mesh.points.length).toBe(3 * BALL_POINTS + 2 * 36);
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

  it("scales the farthest ball onto the registry envelope, and no point past it", () => {
    const distances = mesh.points.map((point) => Math.hypot(point[0], point[1], point[2]));
    const farthest = Math.max(...distances);

    expect(farthest).toBeLessThanOrEqual(ENVELOPE_RADIUS + 1e-6);
    expect(farthest).toBeGreaterThan(ENVELOPE_RADIUS - 1);
  });

  it("centres the mesh on the atoms' centroid: the two hydrogens straddle x = 0", () => {
    const xs = mesh.points.map((point) => point[0]);

    expect(Math.abs(Math.max(...xs) + Math.min(...xs))).toBeLessThan(1e-6);
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
