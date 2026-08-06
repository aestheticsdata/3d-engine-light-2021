// Where the key light points, in both frames.
//
// The sign of every component here was chosen by one criterion rather than
// derived: the console has always drawn its mock shading as an upper-left key
// tilted toward the viewer, and the four LIGHTING rows ship at 135 and 42. So
// the last case in this file is not a regression guard on the maths — it is the
// definition of the azimuth convention, and the maths above it was arranged
// until it passed.
//
// It runs against a real CameraRig rather than a hand-written matrix, because
// the claim being tested is about the pose the console actually opens on, and a
// reconstruction of the camera would only prove the reconstruction.

import CameraRig from "@camera/CameraRig";
import { toEyeSpace, worldLightDirection } from "@rendering/lightDirection";
import { describe, expect, it } from "vitest";

import type { Vec3 } from "@rendering/lightDirection";

const DEFAULT_AZIMUTH = 135;
const DEFAULT_ELEVATION = 42;
const DEFAULT_CAM_ELEV = 30;
const DEFAULT_CAM_AZIM = 45;

const IDENTITY = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const lengthOf = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

const openingCamera = () => {
  const rig = new CameraRig();

  rig.setAngles({ pitch: DEFAULT_CAM_ELEV, yaw: DEFAULT_CAM_AZIM, roll: 0 });

  return rig;
};

describe("worldLightDirection", () => {
  it("returns a unit vector at every angle, which is what lets the dot product be the cosine", () => {
    const angles = [
      [0, 0],
      [135, 42],
      [270, 89],
      [-45, 15],
      [360, 90],
    ];

    angles.forEach(([azimuth, elevation]) => {
      expect(lengthOf(worldLightDirection(azimuth, elevation))).toBeCloseTo(1, 12);
    });
  });

  // Up is -y, so a raised light always has a negative y whatever the azimuth
  // does. This is the one component the console reads as "the light is above",
  // and getting it backwards lights every shape from underneath.
  it("puts the light above the ground for any positive elevation", () => {
    [1, 15, 42, 89].forEach((elevation) => {
      [0, 90, 135, 200, 359].forEach((azimuth) => {
        expect(worldLightDirection(azimuth, elevation)[1]).toBeLessThan(0);
      });
    });
  });

  it("stands the light straight up at elevation 90 and lays it flat at 0", () => {
    const overhead = worldLightDirection(135, 90);
    const horizon = worldLightDirection(0, 0);

    expect(overhead[0]).toBeCloseTo(0, 12);
    expect(overhead[1]).toBeCloseTo(-1, 12);
    expect(overhead[2]).toBeCloseTo(0, 12);
    expect(horizon).toEqual([1, -0, -0]);
  });

  // Azimuth 0 is from the right and travels right -> front -> left, which is the
  // reading the draft stated in eye space and this keeps in world space.
  it("swings the light through the front as azimuth grows from 0 to 180", () => {
    expect(worldLightDirection(0, 0)[0]).toBeCloseTo(1, 12);
    expect(worldLightDirection(90, 0)[2]).toBeCloseTo(-1, 12);
    expect(worldLightDirection(180, 0)[0]).toBeCloseTo(-1, 12);
  });
});

describe("toEyeSpace", () => {
  it("leaves the direction alone under an unrotated camera", () => {
    const world = worldLightDirection(DEFAULT_AZIMUTH, DEFAULT_ELEVATION);

    expect(toEyeSpace(world, IDENTITY)).toEqual(world);
  });

  // The camera rotation is orthonormal, which is the property that lets the
  // caller skip a renormalising divide per frame. It stops being true the moment
  // someone passes meshMatrix() instead — E4a put a scale factor in that one.
  it("preserves length through the camera rotation, so nothing has to renormalise", () => {
    const rig = openingCamera();
    const world = worldLightDirection(DEFAULT_AZIMUTH, DEFAULT_ELEVATION);

    expect(lengthOf(toEyeSpace(world, rig.viewMatrix()))).toBeCloseTo(1, 12);
  });

  // The light is world-fixed: two different camera poses must see the same world
  // light from two different directions. If this ever passes with equal vectors,
  // the rotation has been dropped and the light has silently become eye-fixed.
  it("moves the light across the frame when the camera orbits", () => {
    const rig = openingCamera();
    const world = worldLightDirection(DEFAULT_AZIMUTH, DEFAULT_ELEVATION);
    const atRest = toEyeSpace(world, rig.viewMatrix());

    rig.setAngles({ yaw: DEFAULT_CAM_AZIM + 90 });

    const orbited = toEyeSpace(world, rig.viewMatrix());

    expect(orbited[0]).not.toBeCloseTo(atRest[0], 3);
    expect(orbited[2]).not.toBeCloseTo(atRest[2], 3);
  });

  // The criterion the whole convention answers to.
  it("lands the shipped defaults upper-left and tilted toward the viewer", () => {
    const eye = toEyeSpace(worldLightDirection(DEFAULT_AZIMUTH, DEFAULT_ELEVATION), openingCamera().viewMatrix());

    // x < 0 is from the left, y < 0 is from above (y is down), z < 0 is toward
    // the eye rather than behind the subject.
    expect(eye[0]).toBeLessThan(0);
    expect(eye[1]).toBeLessThan(0);
    expect(eye[2]).toBeLessThan(0);
  });
});
