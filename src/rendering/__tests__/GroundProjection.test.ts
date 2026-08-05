// The ground plane's projector, pinned against the same Camera/RenderTarget
// pair a mesh vertex projects through — see
// src/primitives/__tests__/projection.test.ts's convert3D2D suite, which this
// is deliberately kept in step with rather than duplicating in spirit only.
//
// No DOM, no canvas: GroundProjection touches neither, which is what lets its
// formula be pinned here instead of only ever being checked by eye in a
// browser.

import Camera from "@primitives/Camera";
import RenderTarget from "@primitives/RenderTarget";
import GroundProjection from "@rendering/GroundProjection";
import { GROUND_DEPTH_METRES, GROUND_Y, metresToUnits } from "@rendering/worldScale";
import { describe, expect, it } from "vitest";

import type { CameraOptions } from "@primitives/Camera";

const renderTarget = () => new RenderTarget({ width: 1024, height: 640 });

const cameraOf = (options: Partial<CameraOptions> = {}) => new Camera({ focal: 300, magnification: 1, ...options });

describe("GroundProjection", () => {
  it("projects the ground at z=0 through the same scale a mesh vertex there would get", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const ground = new GroundProjection(target, camera);

    const point = ground.project(0, 0);

    expect(point.x).toBe(target.centerX);
    expect(point.y).toBeCloseTo(target.centerY + GROUND_Y * camera.scaleAt(0) * target.scale, 10);
  });

  it("puts the horizon at the render target centre as z grows without bound", () => {
    const ground = new GroundProjection(renderTarget(), cameraOf());

    const far = ground.project(0, 1_000_000_000);

    expect(far.y).toBeCloseTo(320, 2);
  });

  it("moves x by exactly the camera's own scale at that z, the same multiply convert3D2D does", () => {
    const camera = cameraOf();
    const target = renderTarget();
    const ground = new GroundProjection(target, camera);

    const point = ground.project(100, 50);

    expect(point.x).toBeCloseTo(target.centerX + 100 * camera.scaleAt(50) * target.scale, 10);
  });

  it("floors nearZ's depth at 40 engine units when the camera's own near plane is tighter", () => {
    const camera = cameraOf({ near: 1 });
    const ground = new GroundProjection(renderTarget(), camera);

    expect(ground.nearZ).toBeCloseTo(40 - camera.distance, 10);
  });

  it("lets a wider camera near plane than the 40-unit floor win", () => {
    const camera = cameraOf({ near: 200 });
    const ground = new GroundProjection(renderTarget(), camera);

    expect(ground.nearZ).toBeCloseTo(200 - camera.distance, 10);
  });

  // ORTHOGRAPHIC's own exception (GroundProjection.scaleFor): Camera.scaleAt
  // drops z entirely in that mode, which would collapse every ground point at
  // a given x onto the same pixel — a mesh vertex still looks three-
  // dimensional there because it carries its own x and y, but a ground point's
  // y is the single constant GROUND_Y. The tangent line to PERSPECTIVE's own
  // curve at z=0 is used instead, so PERSPECTIVE and ORTHOGRAPHIC agree
  // exactly at the reference plane and ORTHOGRAPHIC keeps receding in a
  // straight line rather than curving away.
  describe("ORTHOGRAPHIC", () => {
    it("agrees with PERSPECTIVE's own scale exactly at the z=0 reference plane", () => {
      const camera = cameraOf({ mode: "ORTHOGRAPHIC", magnification: 0.75 });
      const target = renderTarget();
      const ground = new GroundProjection(target, camera);

      const point = ground.project(100, 0);

      expect(point.x).toBeCloseTo(target.centerX + 100 * camera.scaleAt(0) * target.scale, 10);
    });

    it("recedes linearly rather than collapsing: x keeps changing as z grows", () => {
      const camera = cameraOf({ mode: "ORTHOGRAPHIC", magnification: 0.75 });
      const ground = new GroundProjection(renderTarget(), camera);

      const near = ground.project(100, -50);
      const mid = ground.project(100, camera.distance / 2);

      expect(mid.x).not.toBe(near.x);
      expect(mid.x).toBeGreaterThan(512);
      expect(mid.x).toBeLessThan(near.x);
    });

    // scale(z) = magnification·(1 - z/reach) reaches exactly 0 at z = reach —
    // the tangent line's own root — and is clamped rather than left to go
    // negative beyond it. reach is the 6000-unit floor here, not
    // camera.distance (400): the next test is why that floor exists.
    it("reaches the render-target centre at the ground's own designed depth and never crosses past it", () => {
      const camera = cameraOf({ mode: "ORTHOGRAPHIC", magnification: 0.75 });
      const target = renderTarget();
      const ground = new GroundProjection(target, camera);
      const reach = metresToUnits(GROUND_DEPTH_METRES);

      expect(camera.distance).toBeLessThan(reach);
      expect(ground.project(100, reach).x).toBeCloseTo(target.centerX, 10);
      expect(ground.project(100, reach * 10).x).toBe(target.centerX);
    });

    // The reach used above is camera.distance floored at the ground's own
    // designed depth (GROUND_DEPTH_METRES in units), not camera.distance
    // alone — at the zoom slider's tight end distance can shrink under 50
    // units, and using it directly would clamp the whole visible ground to
    // the centre a few dozen units past the eye, nowhere near the far edge
    // GroundGrid and GroundFloor draw out to.
    it("keeps the far edge of the ground visible even when the camera sits very close", () => {
      const camera = cameraOf({ magnification: 6, mode: "ORTHOGRAPHIC" });
      const target = renderTarget();
      const ground = new GroundProjection(target, camera);

      expect(camera.distance).toBeCloseTo(50, 5);

      const centre = ground.project(100, 0).x;
      const farEdge = ground.project(100, 5000).x;

      expect(farEdge).toBeGreaterThan(target.centerX);
      expect(farEdge).toBeLessThan(centre);
    });
  });

  it("follows the camera it was built with when it is mutated afterwards", () => {
    const camera = cameraOf();
    const ground = new GroundProjection(renderTarget(), camera);

    const before = ground.project(100, 0).x;

    camera.setMagnification(2);

    expect(ground.project(100, 0).x).not.toBe(before);
  });
});
