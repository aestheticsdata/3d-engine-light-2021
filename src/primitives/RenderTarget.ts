// Where the projection centre and the render-target scale are, resolved once.
//
// Replaces Viewport, which only ever gave the centre: this adds the scale a
// resize will need, so a later ticket that makes the canvas resizable touches
// one module instead of walking every projection consumer a second time.
//
// scale is height relative to referenceHeight, the height the registry's world
// coordinates and Camera's own DEFAULT_FOCAL_LENGTH were authored against — not
// a fraction of the render target's own size, or every target would report 1
// regardless of resolution. At the app's own 1024x640 stage the two heights
// coincide, so scale opens at exactly 1 and nothing about today's frame moves.
//
// The multiply happens outside Camera, in whoever reads both — Camera.scaleAt(z)
// already returns one final, fully-divided number in both its perspective and
// orthographic branches, and there is no depth left inside it to intercept.
// Folding a resolution scale into Camera would also be the wrong owner: the
// camera does not change when the canvas does.

export interface RenderTargetOptions {
  width: number;
  height: number;
  // Defaults to the app stage's own authored height. A caller with a different
  // notion of "authored size" — a thumbnail rendered at a different pixel size
  // with its own hand-tuned camera — overrides this to its own height instead,
  // which is what pins scale back to 1 and keeps that caller's projection
  // exactly as it was before this class existed.
  referenceHeight?: number;
}

const DEFAULT_REFERENCE_HEIGHT = 640;

class RenderTarget {
  private _width: number;
  private _height: number;
  private _centerX: number;
  private _centerY: number;
  private _scale: number;
  private readonly referenceHeight: number;

  constructor(options: RenderTargetOptions) {
    this.referenceHeight = options.referenceHeight ?? DEFAULT_REFERENCE_HEIGHT;
    this._width = options.width;
    this._height = options.height;
    this._centerX = options.width >> 1;
    this._centerY = options.height >> 1;
    this._scale = options.height / this.referenceHeight;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get centerX(): number {
    return this._centerX;
  }

  public get centerY(): number {
    return this._centerY;
  }

  public get scale(): number {
    return this._scale;
  }

  // Width and height stay two positional numbers rather than an options object:
  // R4 exempts positional arguments for value types where the order is the
  // meaning, the way it already exempts Point3D's own x/y/z. Neither is
  // optional here, so there is no set to name.
  public setSize(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._centerX = width >> 1;
    this._centerY = height >> 1;
    this._scale = height / this.referenceHeight;
  }
}

export default RenderTarget;
