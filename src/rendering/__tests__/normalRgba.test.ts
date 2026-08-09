// NORMALS mode's encoding, on faces whose normals are known by construction.
//
// The same two triangles Lighting.test.ts uses, for the same reason: FACING_EYE
// lies in the z = 0 plane with an outward normal of (0, 0, -1) and EDGE_ON has
// one of (-1, 0, 0), so every channel below can be read off without trusting a
// second piece of arithmetic to set the scene up.
//
// The y and z flips are what this file mostly exists to pin. Both are display
// conventions rather than maths, so nothing else in the tree would notice if one
// of them were dropped — the picture would simply be wrong in a way that looks
// plausible.

import { normalRgba } from "@rendering/normalRgba";
import { describe, expect, it } from "vitest";

const MID = 128;

// Outward normal (0, 0, -1): straight back at an eye sitting at negative z.
const facingEye = () => normalRgba(0, 0, 0, 1, 0, 0, 0, 1, 0);
// The same three points wound the other way, so the outward normal is (0, 0, 1).
const facingAway = () => normalRgba(0, 0, 0, 0, 1, 0, 1, 0, 0);

describe("normalRgba", () => {
  it("encodes a face turned toward the eye as full blue", () => {
    // -1 on the z axis, negated for display, is +1 — which is the convention
    // every normal map is authored to and the whole reason z is flipped.
    expect(facingEye()).toEqual([MID, MID, 255, 1]);
  });

  it("encodes a face turned away from the eye as no blue", () => {
    expect(facingAway()).toEqual([MID, MID, 0, 1]);
  });

  it("puts a face pointing screen-up at a different green from one pointing screen-down", () => {
    // Outward normal (0, -1, 0), which is screen-UP because y is down.
    const up = normalRgba(0, 0, 0, 0, 0, 1, 1, 0, 0);
    // Outward normal (0, 1, 0).
    const down = normalRgba(0, 0, 0, 1, 0, 0, 0, 0, 1);

    expect(up[1]).toBe(255);
    expect(down[1]).toBe(0);
  });

  it("leaves the x axis unflipped, since screen x already runs right", () => {
    // Outward normal (1, 0, 0).
    const right = normalRgba(0, 0, 0, 0, 0, 1, 0, 1, 0);

    expect(right[0]).toBe(255);
  });

  it("reads a degenerate face as the zero normal rather than dividing by nothing", () => {
    // SphereGenerator emits thirteen coincident points at each pole, so this is
    // a shape in the registry rather than a hypothetical.
    expect(normalRgba(0, 0, 0, 0, 0, 0, 0, 0, 0)).toEqual([MID, MID, MID, 1]);
  });

  it("normalises, so a face's size does not change its colour", () => {
    const small = normalRgba(0, 0, 0, 1, 0, 0, 0, 1, 0);
    const large = normalRgba(0, 0, 0, 400, 0, 0, 0, 400, 0);

    expect(large).toEqual(small);
  });
});
