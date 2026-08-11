// The shadow blob's geometry and its alpha ramp, shared by the canvas painter
// and the frame-buffer compositor since E3e. The ramp is the half that matters
// most here: GroundShadow spells it as three CanvasGradient stops and
// ShadowCompositor evaluates it per pixel, so the two only agree as long as
// this function is what the stops describe.

import Camera from "@primitives/Camera";
import RenderTarget from "@primitives/RenderTarget";
import Fog from "@rendering/Fog";
import GroundProjection from "@rendering/GroundProjection";
import { CORE_SHARE, CORE_STOP, shadowAlphaAt, shadowEllipseFor } from "@rendering/shadowEllipse";
import { GROUND_Y } from "@rendering/worldScale";
import { describe, expect, it } from "vitest";

import type { MeshBounds } from "@primitives/Mesh";

const LEVEL = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const groundOf = () =>
  new GroundProjection({
    renderTarget: new RenderTarget({ width: 1024, height: 640 }),
    camera: new Camera({ focal: 300, magnification: 1 }),
    cameraTransform: LEVEL,
  });

// Fog at zero, so its ground fade multiplies by 1 and the density under test is
// the contact/risen ramp alone.
const clearFog = () => new Fog({ amount: 0, skyEnabled: true });

// A shape resting on the plane, centred on the origin. y is DOWN, so the
// lowest point carries the LARGEST y.
const restingBounds = (): MeshBounds => ({
  minX: -40,
  maxX: 40,
  minY: GROUND_Y - 80,
  maxY: GROUND_Y,
  minZ: -40,
  maxZ: 40,
});

const blobOf = (bounds: MeshBounds = restingBounds()) => ({ bounds, offsetX: 0, offsetY: 0 });

describe("shadowAlphaAt", () => {
  it("hits the gradient's three stops exactly", () => {
    expect(shadowAlphaAt(0, 0.42)).toBeCloseTo(0.42, 10);
    expect(shadowAlphaAt(CORE_STOP, 0.42)).toBeCloseTo(0.42 * CORE_SHARE, 10);
    expect(shadowAlphaAt(1, 0.42)).toBe(0);
  });

  it("gives nothing at all outside the unit circle the arc would have clipped to", () => {
    expect(shadowAlphaAt(1.0001, 0.42)).toBe(0);
    expect(shadowAlphaAt(12, 0.42)).toBe(0);
  });

  it("falls away monotonically from the centre", () => {
    const samples = [0, 0.2, 0.4, 0.5, 0.7, 0.9, 0.99].map((radius) => shadowAlphaAt(radius, 0.42));

    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it("gives up far less over the dense core than over the outer half", () => {
    const core = shadowAlphaAt(0, 0.42) - shadowAlphaAt(CORE_STOP, 0.42);
    const skirt = shadowAlphaAt(CORE_STOP, 0.42) - shadowAlphaAt(1, 0.42);

    expect(skirt).toBeGreaterThan(core);
  });

  it("scales with the blob's own density rather than carrying one of its own", () => {
    expect(shadowAlphaAt(0.25, 0.2)).toBeCloseTo(shadowAlphaAt(0.25, 0.4) / 2, 10);
  });
});

describe("shadowEllipseFor", () => {
  it("projects a resting shape to a basis with real area", () => {
    const ellipse = shadowEllipseFor(groundOf(), clearFog(), blobOf());

    // The determinant of the projected basis, which is what a degenerate blob
    // would have collapsed to zero.
    const area = Math.abs((ellipse?.ux ?? 0) * (ellipse?.vy ?? 0) - (ellipse?.uy ?? 0) * (ellipse?.vx ?? 0));

    expect(ellipse).not.toBeNull();
    expect(area).toBeGreaterThan(0);
  });

  it("carries the transition's screen offsets into the ellipse's centre", () => {
    const ground = groundOf();
    const fog = clearFog();
    const centred = shadowEllipseFor(ground, fog, blobOf());
    const slid = shadowEllipseFor(ground, fog, { bounds: restingBounds(), offsetX: 120, offsetY: -30 });

    expect(slid?.centreX).toBeCloseTo((centred?.centreX ?? 0) + 120, 10);
    expect(slid?.centreY).toBeCloseTo((centred?.centreY ?? 0) - 30, 10);
  });

  it("rejects an empty mesh, whose bounds fold to an inverted box", () => {
    const empty: MeshBounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };

    expect(shadowEllipseFor(groundOf(), clearFog(), blobOf(empty))).toBeNull();
  });

  it("rejects a shape with no horizontal extent, which has no circle to project", () => {
    const flat: MeshBounds = { minX: 0, maxX: 0, minY: GROUND_Y - 10, maxY: GROUND_Y, minZ: 0, maxZ: 0 };

    expect(shadowEllipseFor(groundOf(), clearFog(), blobOf(flat))).toBeNull();
  });

  it("thins the shadow as the shape rises off the plane", () => {
    const ground = groundOf();
    const fog = clearFog();
    const resting = shadowEllipseFor(ground, fog, blobOf());
    const risen = shadowEllipseFor(ground, fog, blobOf({ ...restingBounds(), maxY: GROUND_Y - 200 }));

    expect(risen?.alpha).toBeLessThan(resting?.alpha ?? 0);
  });
});
