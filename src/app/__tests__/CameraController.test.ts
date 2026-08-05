// The three mappings a console control goes through before it is projection
// state, pinned in the node environment: the controller reads two numbers off
// the canvas element and never touches the DOM again, so a plain object with a
// width and a height is the whole fixture it needs.
//
// The suite exists for one claim above all. This ticket re-parameterised the
// projection, and the promise attached to that was that nothing visible changed:
// at the focal length the zoom curve was authored against, every position of the
// slider must still project exactly as it did. That is asserted here rather than
// argued in a comment, because it is the kind of guarantee that decays into
// approximately true.

import CameraController, { DEFAULT_FOV, DEFAULT_ZOOM_SLIDER_VALUE } from "@app/CameraController";
import { describe, expect, it } from "vitest";

const canvasOf = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;

const controller = () => new CameraController(canvasOf(1024, 640));

// The focal length the zoom curve was written against, and the angle that
// produces it exactly: the slider's integer 94 lands on 298.4 instead, which is
// close enough to look identical and not close enough to assert against.
const REFERENCE_FOCAL_LENGTH = 300;
const REFERENCE_FOV_DEGREES = 2 * Math.atan(320 / REFERENCE_FOCAL_LENGTH) * (180 / Math.PI);

// What the projection was before the magnification replaced the push-back, and
// the offsets the slider maps onto — its two ends, its default and two points in
// between.
const previousScale = (zOffset: number, z: number) => REFERENCE_FOCAL_LENGTH / (REFERENCE_FOCAL_LENGTH + zOffset + z);
const SLIDER_TO_ZOFFSET: [number, number][] = [
  [0, 260],
  [25, 140],
  [50, 20],
  [75, -100],
  [100, -220],
];

describe("CameraController", () => {
  it("opens on the field of view and zoom the sliders show", () => {
    const camera = controller();

    expect(camera.fieldOfViewDegrees).toBeCloseTo(DEFAULT_FOV, 10);
    expect(camera.projection.focalLength).toBeCloseTo(320 / Math.tan((DEFAULT_FOV * Math.PI) / 360), 10);
    expect(camera.projection.mode).toBe("PERSPECTIVE");
  });

  it("projects every zoom position exactly as it did before the magnification", () => {
    SLIDER_TO_ZOFFSET.forEach(([sliderValue, zOffset]) => {
      const camera = controller();

      camera.setFovDegrees(REFERENCE_FOV_DEGREES);
      camera.setZoomFromSlider(sliderValue);

      [-173, -100, 0, 100, 173].forEach((z) => {
        expect(camera.projection.scaleAt(z)).toBeCloseTo(previousScale(zOffset, z), 10);
      });
    });
  });

  it("reports the eye distance as fl over k, at both ends of the zoom", () => {
    const camera = controller();

    camera.setFovDegrees(REFERENCE_FOV_DEGREES);
    camera.setZoomFromSlider(0);

    expect(camera.distance).toBeCloseTo(560, 10);

    camera.setZoomFromSlider(100);

    expect(camera.distance).toBeCloseTo(80, 10);
  });

  // The clamp this replaced held the focal at 260, so the slider ran on past
  // roughly 102° while the projection stood still. Both ends of the range are
  // asserted because only the wide end was ever clamped.
  it("converts the whole 15..120 range with no floor under the focal", () => {
    const camera = controller();

    camera.setFovDegrees(120);

    expect(camera.projection.focalLength).toBeCloseTo(184.75, 2);
    expect(camera.fieldOfViewDegrees).toBeCloseTo(120, 10);

    camera.setFovDegrees(15);

    expect(camera.projection.focalLength).toBeCloseTo(2430.6, 1);
    expect(camera.fieldOfViewDegrees).toBeCloseTo(15, 10);
  });

  // A dolly, not a second zoom: the eye moves to hold the subject's size at its
  // own centre plane, which is what the FOV control was deferred to this ticket
  // to become.
  it("moves the eye instead of the subject when the field of view changes", () => {
    const camera = controller();

    camera.setZoomFromSlider(DEFAULT_ZOOM_SLIDER_VALUE);

    const framing = camera.projection.scaleAt(0);

    camera.setFovDegrees(15);

    expect(camera.projection.scaleAt(0)).toBeCloseTo(framing, 10);
    expect(camera.distance).toBeGreaterThan(2000);

    camera.setFovDegrees(120);

    expect(camera.projection.scaleAt(0)).toBeCloseTo(framing, 10);
    expect(camera.distance).toBeLessThan(200);
  });

  // Both setters absorb the null Controls.getNumericValue returns for a missing
  // slider, and a missing slider must leave the camera alone rather than send
  // NaN into every vertex of the scene.
  it("ignores a slider that is not there", () => {
    const camera = controller();
    const focal = camera.projection.focalLength;
    const distance = camera.distance;

    camera.setFovDegrees(null);
    camera.setZoomFromSlider(null);

    expect(camera.projection.focalLength).toBe(focal);
    expect(camera.distance).toBe(distance);
  });
});
