// The Sutherland-Hodgman walk against one plane, in the plain {x,y,z,u,v}
// shape Triangle's clipToNear builds from its own vertices. Fixtures use
// near=10, eyeDistance=0 so depth === z and the interpolation arithmetic can
// be checked by hand.

import { clipTriangleToNear } from "@rendering/nearPlaneClip";
import { describe, expect, it } from "vitest";

import type { ClipVertex } from "@rendering/nearPlaneClip";

const NEAR = 10;
const EYE_DISTANCE = 0;

describe("clipTriangleToNear", () => {
  it("returns the three vertices unchanged when all are in front", () => {
    const a: ClipVertex = { x: 0, y: 0, z: 20, u: 0, v: 0 };
    const b: ClipVertex = { x: 10, y: 0, z: 20, u: 1, v: 0 };
    const c: ClipVertex = { x: 0, y: 10, z: 20, u: 0, v: 1 };

    expect(clipTriangleToNear([a, b, c], NEAR, EYE_DISTANCE)).toEqual([a, b, c]);
  });

  it("returns nothing when all three are behind the plane", () => {
    const a: ClipVertex = { x: 0, y: 0, z: 0, u: 0, v: 0 };
    const b: ClipVertex = { x: 10, y: 0, z: 0, u: 1, v: 0 };
    const c: ClipVertex = { x: 0, y: 10, z: 0, u: 0, v: 1 };

    expect(clipTriangleToNear([a, b, c], NEAR, EYE_DISTANCE)).toEqual([]);
  });

  it("splits a two-in-front triangle into a quad, interpolating x/y/z/u/v at the same t", () => {
    const a: ClipVertex = { x: 0, y: 0, z: 20, u: 0, v: 0 };
    const b: ClipVertex = { x: 10, y: 0, z: 20, u: 1, v: 0 };
    const c: ClipVertex = { x: 0, y: 10, z: 0, u: 0, v: 1 };

    const polygon = clipTriangleToNear([a, b, c], NEAR, EYE_DISTANCE);

    // t = (near - depth(b)) / (depth(c) - depth(b)) = (10-20)/(0-20) = 0.5
    expect(polygon).toEqual([a, b, { x: 5, y: 5, z: 10, u: 0.5, v: 0.5 }, { x: 0, y: 5, z: 10, u: 0, v: 0.5 }]);
  });

  it("splits a one-in-front triangle into a single triangle, in edge-walk order", () => {
    const a: ClipVertex = { x: 0, y: 0, z: 0, u: 0, v: 0 };
    const b: ClipVertex = { x: 10, y: 0, z: 0, u: 1, v: 0 };
    const c: ClipVertex = { x: 0, y: 10, z: 20, u: 0, v: 1 };

    const polygon = clipTriangleToNear([a, b, c], NEAR, EYE_DISTANCE);

    expect(polygon).toEqual([{ x: 5, y: 5, z: 10, u: 0.5, v: 0.5 }, c, { x: 0, y: 5, z: 10, u: 0, v: 0.5 }]);
  });

  it("survives exactly on the plane as in front, matching Camera.clips' own boundary", () => {
    const a: ClipVertex = { x: 0, y: 0, z: 10, u: 0, v: 0 };
    const b: ClipVertex = { x: 10, y: 0, z: 10, u: 1, v: 0 };
    const c: ClipVertex = { x: 0, y: 10, z: 10, u: 0, v: 1 };

    expect(clipTriangleToNear([a, b, c], NEAR, EYE_DISTANCE)).toEqual([a, b, c]);
  });
});
