// GOURAUD's vertex normals, on a fold whose two faces have normals known by
// construction.
//
// Both faces are the ones Lighting.test.ts already reads its terms off: one in
// the z = 0 plane with an outward normal of (0, 0, -1), one in the x = 0 plane
// with (-1, 0, 0). They share two vertices, so the shared corners average to 45°
// between the two while the unshared ones keep their own face's normal — which
// is the whole behaviour, readable without trusting a second derivation.
//
// The area weighting is the part worth guarding hardest. It is implicit — it
// falls out of accumulating the un-normalised cross product — so nothing would
// throw if a well-meaning normalise crept into the accumulation; the shading
// would just quietly stop respecting how much surface each face contributes.
//
// Real Triangles rather than a stub: none of this needs a canvas, which is what
// projection.test.ts exists to demonstrate, and a duck type would be indirection
// for a second caller that does not exist.

import Camera from "@primitives/Camera";
import Point3D from "@primitives/Point3D";
import RenderTarget from "@primitives/RenderTarget";
import Triangle from "@primitives/Triangle";
import VertexNormals from "@primitives/VertexNormals";
import Lighting from "@rendering/Lighting";
import { describe, expect, it } from "vitest";

import type { LightingValues } from "@rendering/Lighting";

const IDENTITY = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

// Azimuth 90 with no elevation points the light down -z, straight at the eye,
// and no ambient makes every shade below the raw Lambert term.
const HEADLIGHT: LightingValues = { azimuth: 90, elevation: 0, ambient: 0, specular: 0, enabled: true };

const target = new RenderTarget({ width: 1024, height: 640 });
const camera = new Camera({ focal: 300, magnification: 1 });

const headlight = () => {
  const lighting = new Lighting(HEADLIGHT);

  lighting.setCamera(IDENTITY, 300);

  return lighting;
};

// Four corners of a right-angled fold: 0 at the crease's near end, 1 out along
// x, 2 at the crease's far end, 3 out along z.
const CORNERS: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// `reach` scales the z = 0 face alone, so the two faces' areas can be put out of
// balance without touching either one's direction.
const fold = (reach: number) => {
  const points = CORNERS.map(([x, y, z]) => new Point3D(x * reach, y, z, target, camera));
  const flat = new Triangle(
    points[0],
    points[1],
    points[2],
    "rgba(255, 255, 255, 1)",
    undefined,
    undefined,
    undefined,
    [0, 1, 2],
  );
  const upright = new Triangle(
    points[0],
    points[2],
    points[3],
    "rgba(255, 255, 255, 1)",
    undefined,
    undefined,
    undefined,
    [0, 2, 3],
  );

  return { points, triangles: [flat, upright] };
};

const shadesOf = (reach: number): number[] => {
  const { points, triangles } = fold(reach);
  const normals = new VertexNormals(points.length);

  normals.rebuild(triangles, headlight());

  return points.map((_, index) => normals.shadeAt(index));
};

describe("VertexNormals", () => {
  it("leaves a corner on one face alone at that face's own shade", () => {
    const shades = shadesOf(1);

    // Vertex 1 belongs only to the z = 0 face, whose outward normal is
    // (0, 0, -1) — straight into the headlight.
    expect(shades[1]).toBeCloseTo(1, 6);
    // Vertex 3 belongs only to the x = 0 face, at (-1, 0, 0) — edge on, so
    // ambient and nothing else, and ambient is zero here.
    expect(shades[3]).toBeCloseTo(0, 6);
  });

  it("averages a shared corner to halfway between the two faces", () => {
    const shades = shadesOf(1);

    // Equal areas, so the sum bisects: (-1, 0, -1)/√2 against a light down -z.
    expect(shades[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(shades[2]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("weights a shared corner by area, not by face count", () => {
    // The z = 0 face is now nine times the area of the other, so the crease
    // leans almost all the way onto it: (-1, 0, -9)/√82 rather than the /√2 a
    // plain average of two unit normals would give.
    const shades = shadesOf(9);

    expect(shades[0]).toBeCloseTo(9 / Math.sqrt(82), 6);
    expect(shades[0]).toBeGreaterThan(Math.SQRT1_2);
  });

  it("shades a vertex with no usable normal at full ambient rather than black", () => {
    // Every face around it degenerate — SphereGenerator's thirteen coincident
    // points at each pole are exactly this, and an unlit spot in the middle of a
    // smooth surface reads as a hole.
    const origin = new Point3D(0, 0, 0, target, camera);
    const flat = new Triangle(
      origin,
      origin,
      origin,
      "rgba(255, 255, 255, 1)",
      undefined,
      undefined,
      undefined,
      [0, 0, 0],
    );
    const normals = new VertexNormals(1);

    normals.rebuild([flat], headlight());

    expect(normals.shadeAt(0)).toBe(1);
  });

  it("rebuilds from scratch, so a second call does not accumulate onto the first", () => {
    const { points, triangles } = fold(1);
    const normals = new VertexNormals(points.length);
    const lighting = headlight();

    normals.rebuild(triangles, lighting);
    const once = normals.shadeAt(0);
    normals.rebuild(triangles, lighting);

    expect(normals.shadeAt(0)).toBeCloseTo(once, 6);
  });

  it("skips a triangle with no indices rather than writing outside the array", () => {
    // A near-plane clip fragment is built without them: it has no entry in the
    // points array to accumulate into.
    const { points, triangles } = fold(1);
    const orphan = new Triangle(points[0], points[1], points[2], "rgba(255, 255, 255, 1)");
    const normals = new VertexNormals(points.length);

    normals.rebuild([...triangles, orphan], headlight());

    expect(normals.shadeAt(0)).toBeCloseTo(Math.SQRT1_2, 6);
  });
});
