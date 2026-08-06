// The projection runs at mesh-build time over the registry's own coordinates,
// which is exactly what makes it testable here: no canvas, no DOM, no camera —
// twenty point tables and a pair of guards.

import cross from "@data/shapes/cross";
import cube from "@data/shapes/cube";
import menger from "@data/shapes/menger";
import sphere from "@data/shapes/sphere";
import { sphericalUVs } from "@rendering/uvProjection";
import { describe, expect, it } from "vitest";

import type { Object3D, Triangle3D } from "@data/types";

const GREY = "rgba(128, 128, 128, 1)";

const faceOf = (points: number[][]): Object3D => ({
  points,
  triangles: [[0, 1, 2, GREY] satisfies Triangle3D],
});

// The one face of a one-face fixture, asserted non-null so the tests below read
// as arithmetic rather than as null checks.
const uvsOf = (points: number[][]) => {
  const face = sphericalUVs(faceOf(points))[0];

  if (!face) {
    throw new Error("the fixture authored no UVs, so the projection must have generated some");
  }

  return face;
};

const spanOf = (us: number[]): number => Math.max(...us) - Math.min(...us);

describe("the spherical projection", () => {
  // Straight down the axes, so the arctangent's branch is pinned rather than
  // inferred. Azimuth 0 sits on +x, which is the same convention the key light
  // measures from.
  it("puts +x at the middle of the texture and sweeps a full turn around it", () => {
    const [right, front, back] = uvsOf([
      [100, 0, 0],
      [0, 0, 100],
      [0, 0, -100],
    ]);

    expect(right[0]).toBeCloseTo(0.5);
    expect(front[0]).toBeCloseTo(0.75);
    expect(back[0]).toBeCloseTo(0.25);
  });

  // The regression this file exists for. Every reference writes v = 0.5 - asin,
  // which assumes y up; this engine's y is down, and getting it wrong flips every
  // generated texture without flipping the cube's authored ones — two halves of
  // one shape disagreeing about which way is up.
  it("maps the underside of a shape to the bottom of the texture, not the top", () => {
    const [below, above] = uvsOf([
      [0, 100, 0],
      [0, -100, 0],
      [100, 0, 0],
    ]);

    expect(below[1]).toBeCloseTo(1);
    expect(above[1]).toBeCloseTo(0);
  });

  // The same claim again, but stated against the registry rather than against
  // the reasoning: the cube's galaxy face is a hand-authored 14x14 grid whose
  // p00 corner sits at model y = -100 and carries v = 0. A generated coordinate
  // at negative y has to land in the same half of the image, or the cube's four
  // flat faces would run upside down beside its two textured ones.
  it("agrees with the cube's own authored convention about which half is up", () => {
    const authoredTop = cube.triangles.find(
      (triangle): triangle is Extract<Triangle3D, { length: 7 }> => triangle.length === 7 && triangle[4][1] === 0,
    );
    const topCorner = cube.points[authoredTop?.[0] ?? 0];

    expect(authoredTop).toBeDefined();
    expect(topCorner[1]).toBeLessThan(0);
    expect(uvsOf([topCorner, [100, 0, 0], [0, 0, 100]])[0][1]).toBeLessThan(0.5);
  });

  it("falls back to the corner of the texture for a vertex at the origin", () => {
    expect(
      uvsOf([
        [0, 0, 0],
        [100, 0, 0],
        [0, 100, 0],
      ])[0],
    ).toEqual([0, 0]);
  });
});

describe("the seam", () => {
  // Two vertices a hair either side of the -x meridian, where u wraps from 1
  // back to 0. Left alone their face claims to span the whole texture, and the
  // affine solve would run all 64 pixels of it backwards across a sliver.
  it("shifts a straddling face past 1 instead of leaving it spanning the texture", () => {
    const [a, b, c] = uvsOf([
      [-100, 0, -1],
      [-100, 0, 1],
      [-100, 50, 0],
    ]);

    expect(spanOf([a[0], b[0], c[0]])).toBeLessThan(0.1);
    expect(Math.max(a[0], b[0], c[0])).toBeGreaterThan(1);
  });

  it("leaves a face that does not straddle it exactly where it was", () => {
    const [a, b, c] = uvsOf([
      [100, 0, 10],
      [100, 0, -10],
      [100, 50, 0],
    ]);

    [a, b, c].forEach((uv) => {
      expect(uv[0]).toBeGreaterThan(0);
      expect(uv[0]).toBeLessThan(1);
    });
  });

  // The sphere is the shape that has to work: its longitude bands close on
  // themselves, so its last column of quads is a seam face by construction.
  it("closes the sphere's wrap without a single face spanning half the texture", () => {
    sphericalUVs(sphere).forEach((face) => {
      expect(face).not.toBeNull();
      expect(spanOf([face?.[0][0] ?? 0, face?.[1][0] ?? 0, face?.[2][0] ?? 0])).toBeLessThanOrEqual(0.5);
    });
  });
});

describe("the registry as a whole", () => {
  // Authored UVs win by never being generated over, which is the rule this
  // assertion pins: the cube's two subdivided faces come back null and its four
  // flat ones do not.
  it("generates nothing for a face the registry already gave coordinates", () => {
    const faces = sphericalUVs(cube);
    const authored = cube.triangles.map((triangle) => triangle.length === 7);

    expect(faces.filter((face) => face === null)).toHaveLength(authored.filter(Boolean).length);
    faces.forEach((face, index) => {
      expect(face === null).toBe(authored[index]);
    });
  });

  // The concave solids are where a NaN would come from — both carry coordinates
  // close to the origin, and both are the shapes a procedural mode is most
  // likely to be pointed at.
  it("produces a finite coordinate for every vertex of every face", () => {
    [sphere, cube, cross, menger].forEach((object3D) => {
      sphericalUVs(object3D).forEach((face) => {
        face?.forEach(([u, v]) => {
          expect(Number.isFinite(u)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        });
      });
    });
  });
});
