// The turntable's own contract: one smooth tumble about a fixed axis, and a
// rest pose that sits underneath it without disturbing it.
//
// This suite exists because the opposite shipped once. Growing three Euler
// angles linearly and recomposing them every frame looks like a tumble in a
// screenshot and is not one in motion — the effective axis wanders as the
// angles grow, so the solid turns one way, then another, then another. The
// assertion that separates the two is that the accumulated rotation's own angle
// grows linearly with time, which is true of a fixed-axis rotation and false of
// an Euler sweep.

import CameraRig from "@camera/CameraRig";
import ShapeRig from "@scene/ShapeRig";
import { describe, expect, it } from "vitest";

// Rodrigues, backwards: the rotation angle of an orthonormal 3x3 satisfies
// trace = 1 + 2cos(theta). Clamped because accumulated float error can push the
// argument a hair outside acos's domain.
const rotationAngleDegrees = (matrix: number[][]): number => {
  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
  const cosine = Math.min(1, Math.max(-1, (trace - 1) / 2));

  return (Math.acos(cosine) * 180) / Math.PI;
};

const spinFor = (seconds: number, steps: number, rate: number): number[][] => {
  const rig = new ShapeRig();

  rig.setAngles({ pitch: 0, yaw: 0, roll: 0, spinRate: rate });

  for (let step = 0; step < steps; step++) {
    rig.advance(seconds / steps);
  }

  return rig.matrix();
};

describe("ShapeRig turntable", () => {
  it("sweeps a constant angle per unit time, rather than wandering as Euler angles would", () => {
    const rate = 122;
    // Kept well under a half turn so acos stays on its monotonic branch and the
    // comparison is about the motion rather than about wrapping.
    const quarter = rotationAngleDegrees(spinFor(0.25, 25, rate));
    const half = rotationAngleDegrees(spinFor(0.5, 50, rate));
    const threeQuarters = rotationAngleDegrees(spinFor(0.75, 75, rate));

    expect(half / quarter).toBeCloseTo(2, 2);
    expect(threeQuarters / quarter).toBeCloseTo(3, 2);
  });

  it("lands on the same attitude however finely the same interval is stepped", () => {
    const coarse = spinFor(0.5, 5, 122);
    const fine = spinFor(0.5, 500, 122);

    // A fixed-axis accumulation is exact under subdivision: R(a)R(b) = R(a+b)
    // about one axis. This is what makes the tumble frame-rate independent, so
    // the RENDER tab's 30fps cap cannot change where the shape ends up.
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        expect(fine[row][column]).toBeCloseTo(coarse[row][column], 6);
      }
    }
  });

  it("returns to a clean identity spin on reset, so a paused console is not left mid-tumble", () => {
    const rig = new ShapeRig();

    rig.setAngles({ spinRate: 122 });
    rig.advance(1.37);
    rig.reset();

    expect(rotationAngleDegrees(rig.matrix())).toBeCloseTo(0, 6);
  });

  it("rests at identity, so the opening frame is the camera's matrix alone", () => {
    const rig = new ShapeRig();

    expect(rotationAngleDegrees(rig.matrix())).toBeCloseTo(0, 6);
  });

  it("poses under the spin rather than tilting its axis, so PITCH cannot change how the shape tumbles", () => {
    // Stripping the spin back out of a posed rig has to leave exactly the pose.
    // That is what S · O buys and what O · S would not: under the other order
    // the accumulator would be sitting in object space, so the pose could not be
    // recovered by multiplying the spin's inverse back in on the left.
    const posed = new ShapeRig();
    const spinning = new ShapeRig();

    posed.setAngles({ pitch: 40, spinRate: 122 });
    spinning.setAngles({ spinRate: 122 });
    posed.advance(0.5);
    spinning.advance(0.5);

    const pose = new ShapeRig();

    pose.setAngles({ pitch: 40 });

    // Sᵀ · (S · O) = O, and S is orthonormal so its transpose is its inverse.
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const recovered =
          spinning.matrix()[0][row] * posed.matrix()[0][column] +
          spinning.matrix()[1][row] * posed.matrix()[1][column] +
          spinning.matrix()[2][row] * posed.matrix()[2][column];

        expect(recovered).toBeCloseTo(pose.matrix()[row][column], 6);
      }
    }
  });

  it("keeps the shape's motion out of the camera readout, which describes the viewpoint alone", () => {
    const camera = new CameraRig();
    const shape = new ShapeRig();

    camera.setAngles({ pitch: 30, yaw: 45, roll: 0 });
    shape.setAngles({ pitch: 10, yaw: 20, roll: 30, spinRate: 122 });
    shape.advance(1);

    expect(camera.angles()).toEqual({ pitch: 30, yaw: 45, roll: 0 });
  });
});
