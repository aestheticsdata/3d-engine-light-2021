// The camera's own contract: the readout describes the viewpoint and nothing
// else, and the mesh matrix is the view composed with whatever the shape is
// doing. The turntable that used to live here moved to ShapeRig with COS-434,
// and its cases went with it.

import CameraRig from "@camera/CameraRig";
import { describe, expect, it } from "vitest";

const IDENTITY = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

describe("CameraRig readout", () => {
  it("reports the angles it was given, normalised into (-180, 180]", () => {
    const rig = new CameraRig();

    rig.setAngles({ pitch: 30, yaw: 45, roll: 0 });

    expect(rig.angles()).toEqual({ pitch: 30, yaw: 45, roll: 0 });
  });

  it("prints BACK as 180, not -180, so the readout matches the chip that set it", () => {
    const rig = new CameraRig();

    rig.setAngles({ yaw: 180 });

    expect(rig.angles().yaw).toBe(180);
  });
});

describe("CameraRig mesh matrix", () => {
  it("is the view alone while the shape rests, which is what keeps the opening frame where it was", () => {
    const rig = new CameraRig();

    rig.setAngles({ pitch: 30, yaw: 45, roll: 0 });

    const view = rig.viewMatrix();
    const mesh = rig.meshMatrix(IDENTITY);

    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        expect(mesh[row][column]).toBeCloseTo(view[row][column], 12);
      }
    }
  });

  it("puts the camera on the left, so the shape's own attitude is applied first", () => {
    const rig = new CameraRig();
    // A quarter turn about yaw, as an object matrix the camera has to apply
    // before its own rotation rather than after it.
    const quarterYaw = [
      [0, 0, 1, 0],
      [0, 1, 0, 0],
      [-1, 0, 0, 0],
      [0, 0, 0, 1],
    ];

    rig.setAngles({ pitch: 30, yaw: 45, roll: 0 });

    const view = rig.viewMatrix();
    const mesh = rig.meshMatrix(quarterYaw);

    // C · O, computed here by hand: if the two were composed the other way the
    // product would differ, because rotations about different axes do not
    // commute.
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const expected =
          view[row][0] * quarterYaw[0][column] +
          view[row][1] * quarterYaw[1][column] +
          view[row][2] * quarterYaw[2][column] +
          view[row][3] * quarterYaw[3][column];

        expect(mesh[row][column]).toBeCloseTo(expected, 12);
      }
    }
  });
});
