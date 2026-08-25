// HAL-155's two options, each proved to be the current behaviour expressed
// differently rather than a new path that happens to agree. The geometry
// baseline holds the defaults byte-identical; what it cannot say is that the
// new options are pure translations of them, which is what this suite adds.

import SphereGenerator from "@data/shapes/SphereGenerator";
import { describe, expect, it } from "vitest";

describe("SphereGenerator", () => {
  it("keeps the demo sphere's counts at the defaults", () => {
    const sphere = new SphereGenerator().build();

    expect(sphere.points.length).toBe(143);
    expect(sphere.triangles.length).toBe(240);
  });

  // Exact equality, not toBeCloseTo: the origin branch adds the same float to
  // the same product, so anything short of bit-identity here would be the
  // reassociation drift the ticket warns about.
  it("builds an origin ball as the world-centre ball translated by hand", () => {
    const origin: [number, number, number] = [12.5, -40, 7.25];
    const centred = new SphereGenerator().build();
    const moved = new SphereGenerator({ origin }).build();

    expect(moved.triangles).toEqual(centred.triangles);
    centred.points.forEach((point, index) => {
      expect(moved.points[index][0]).toBe(point[0] + origin[0]);
      expect(moved.points[index][1]).toBe(point[1] + origin[1]);
      expect(moved.points[index][2]).toBe(point[2] + origin[2]);
    });
  });

  it("paints one colour on every face under `fill`, on the checker's own winding", () => {
    const fill = "rgba(48,80,248,1)";
    const checkered = new SphereGenerator().build();
    const plain = new SphereGenerator({ fill }).build();

    expect(plain.points).toEqual(checkered.points);
    plain.triangles.forEach((triangle, index) => {
      expect(triangle[3]).toBe(fill);
      expect(triangle.slice(0, 3)).toEqual(checkered.triangles[index].slice(0, 3));
    });
  });
});
