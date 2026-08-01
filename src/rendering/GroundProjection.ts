// The checker floor's perspective divide.
//
// It was a closure declared inside the floor painter, capturing four values and
// rebuilt on every frame — roughly thirty thousand calls per frame at seventy-two
// columns. Hoisting it to a private method on the renderer instead would have
// produced a six-argument signature, four of which never change, so it becomes
// the thing it already was: a small object that holds the four and projects
// against them.

export interface GroundProjectionOptions {
  centerX: number;
  horizonY: number;
  focal: number;
  cameraHeight: number;
}

export interface GroundPoint {
  x: number;
  y: number;
}

class GroundProjection {
  private readonly centerX: number;
  private readonly horizonY: number;
  private readonly focal: number;
  private readonly cameraHeight: number;

  constructor(options: GroundProjectionOptions) {
    this.centerX = options.centerX;
    this.horizonY = options.horizonY;
    this.focal = options.focal;
    this.cameraHeight = options.cameraHeight;
  }

  public project(x: number, z: number): GroundPoint {
    return {
      x: this.centerX + (this.focal * x) / z,
      y: this.horizonY + (this.focal * this.cameraHeight) / z,
    };
  }
}

export default GroundProjection;
