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

  rig.setPose({ pitch: 0, yaw: 0, roll: 0, spinRate: rate });

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

    rig.setPose({ spinRate: 122 });
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

    posed.setPose({ pitch: 40, spinRate: 122 });
    spinning.setPose({ spinRate: 122 });
    posed.advance(0.5);
    spinning.advance(0.5);

    const pose = new ShapeRig();

    pose.setPose({ pitch: 40 });

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
    shape.setPose({ pitch: 10, yaw: 20, roll: 30, spinRate: 122 });
    shape.advance(1);

    expect(camera.angles()).toEqual({ pitch: 30, yaw: 45, roll: 0 });
  });
});

// The scale rides the same matrix, which is the whole reason it lives here
// rather than in the projection: a factor folded into convert3D2D would move
// what the viewer sees without moving z, so the near plane, the painter's sort
// and the depth histogram would all go on reasoning about the unscaled shape.
// These cases assert the property that makes that true — the transform's linear
// part really is factor x rotation — rather than the pixels downstream of it.
describe("ShapeRig scale", () => {
  // The length of a column of an orthonormal rotation is 1, so scaling one is
  // the only thing that can move this number.
  const columnLength = (matrix: number[][], column: number): number =>
    Math.sqrt(matrix[0][column] ** 2 + matrix[1][column] ** 2 + matrix[2][column] ** 2);

  it("rests at 1, so a rig nobody has scaled is the identity it always was", () => {
    const rig = new ShapeRig();

    expect(columnLength(rig.matrix(), 0)).toBeCloseTo(1, 9);
  });

  it("scales all three axes by the same factor", () => {
    const rig = new ShapeRig();

    rig.setPose({ scale: 2.5 });

    for (let column = 0; column < 3; column++) {
      expect(columnLength(rig.matrix(), column)).toBeCloseTo(2.5, 9);
    }
  });

  // About the origin, which is also the centre of rotation: a scale that carried
  // a translation would slide the shape off the axis it is spinning around.
  it("scales about the model origin, leaving the translation column alone", () => {
    const rig = new ShapeRig();

    rig.setPose({ pitch: 30, yaw: 45, scale: 3 });

    expect(rig.matrix()[0][3]).toBe(0);
    expect(rig.matrix()[1][3]).toBe(0);
    expect(rig.matrix()[2][3]).toBe(0);
  });

  // The property the old per-vertex approach could not offer for free. The rig
  // rebuilds its product from the stored factor every call, so advancing the
  // turntable a hundred times cannot multiply the size a hundred times.
  it("does not compound across frames, however many the turntable has run for", () => {
    const rig = new ShapeRig();

    rig.setPose({ scale: 1.5, spinRate: 122 });

    for (let step = 0; step < 100; step++) {
      rig.advance(1 / 60);
    }

    expect(columnLength(rig.matrix(), 0)).toBeCloseTo(1.5, 9);
  });

  // Independent of the pose, which is what a uniform scale buys: the factor
  // survives any rotation unchanged, so SCALE and the three angle rows cannot
  // interfere with one another.
  it("leaves the attitude alone, and the attitude leaves it alone", () => {
    const scaled = new ShapeRig();
    const plain = new ShapeRig();

    scaled.setPose({ pitch: 25, yaw: -70, roll: 15, scale: 4 });
    plain.setPose({ pitch: 25, yaw: -70, roll: 15 });

    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        expect(scaled.matrix()[row][column]).toBeCloseTo(plain.matrix()[row][column] * 4, 9);
      }
    }
  });
});
