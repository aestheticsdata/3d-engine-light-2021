// The turntable's own contract: one smooth tumble about a fixed axis.
//
// This suite exists because the opposite shipped once. Growing three Euler
// angles linearly and recomposing them every frame looks like a tumble in a
// screenshot and is not one in motion — the effective axis wanders as the
// angles grow, so the solid turns one way, then another, then another. The
// assertion that separates the two is that the accumulated rotation's own angle
// grows linearly with time, which is true of a fixed-axis rotation and false of
// an Euler sweep.

import CameraRig from "@camera/CameraRig";
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
  const rig = new CameraRig();

  rig.setAngles({ pitch: 0, yaw: 0, roll: 0, spinRate: rate });

  for (let step = 0; step < steps; step++) {
    rig.advance(seconds / steps);
  }

  return rig.meshMatrix();
};

describe("CameraRig turntable", () => {
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

  it("keeps the spin out of the camera readout, which describes the viewpoint alone", () => {
    const rig = new CameraRig();

    rig.setAngles({ pitch: 30, yaw: 45, roll: 0, spinRate: 122 });
    rig.advance(1);

    expect(rig.angles()).toEqual({ pitch: 30, yaw: 45, roll: 0 });
  });

  it("returns to a clean identity spin on reset, so a paused console is not left mid-tumble", () => {
    const rig = new CameraRig();

    rig.setAngles({ spinRate: 122 });
    rig.advance(1.37);
    rig.reset();

    expect(rotationAngleDegrees(rig.meshMatrix())).toBeCloseTo(0, 6);
  });
});
