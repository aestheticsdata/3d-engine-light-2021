// Where the projection centre is, resolved once.
//
// Every point of a mesh needs it, and a Menger sponge has 7000 of them — so the
// canvas is read here, at mesh-build time, rather than by each point for itself.

class Viewport {
  private readonly centerX: number;
  private readonly centerY: number;

  constructor(canvas: HTMLCanvasElement) {
    this.centerX = canvas.width >> 1;
    this.centerY = canvas.height >> 1;
  }

  public get x(): number {
    return this.centerX;
  }

  public get y(): number {
    return this.centerY;
  }
}

export default Viewport;
