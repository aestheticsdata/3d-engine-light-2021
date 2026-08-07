// The depth-buffered rasteriser's own colour and depth stores (E3b/COS-242).
//
// Both are plain typed arrays rather than an ImageData/CanvasRenderingContext2D
// pair, which is what keeps every method but present() testable in Node: an
// ImageData needs a DOM, a Uint8ClampedArray does not, and present() is the
// one seam where this class finally needs one.
//
// depth stores 1/d, not d: d (E2's eye-space depth) does not interpolate
// linearly in screen space and 1/d does, so a barycentric-weighted sum of the
// three vertices' own 1/d is exact per pixel. Nearer is therefore LARGER, and
// d is bounded to Camera's [near, far] by the near-plane rejection every
// triangle here has already passed — so a real 1/d is always a small
// positive number, never zero or negative. clear() fills depth with 0 rather
// than the Infinity a raw-z buffer's usual sentinel would use: 0 is the
// value every real 1/d beats, Infinity is a value nothing could.
//
// present() always uploads the WHOLE buffer, not a dirty sub-rect. An
// earlier version of this class tracked a dirty rect — the union of this
// frame's and the previous frame's own paint region — and uploaded only
// that. It was wrong for a reason that had nothing to do with the rasteriser
// itself: BackgroundRenderer.renderPostMeshLayers draws the shadow and the
// vignette directly onto the CANVAS every frame, as a partial-alpha overlay
// on top of whatever is already there. With only a small region re-uploaded
// each frame, everywhere OUTSIDE it never got a fresh background under that
// overlay — so the vignette composited onto itself, frame after frame,
// converging toward fully opaque in well under a second at 60fps. A full
// upload is what guarantees renderPostMeshLayers always draws its one-shot
// overlay onto the canvas THIS frame's buffer produced, never onto an
// accumulation of frames past.

import type { RGBA } from "@rendering/cssColor";

class FrameBuffer {
  private width: number;
  private height: number;
  // Typed over ArrayBuffer explicitly (TS 5.7+'s typed arrays are generic
  // over their backing buffer) — new ImageData() only accepts that exact
  // form, not the wider ArrayBufferLike a bare Uint8ClampedArray annotation
  // defaults to.
  private colour: Uint8ClampedArray<ArrayBuffer>;
  private depth: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.colour = new Uint8ClampedArray(width * height * 4);
    this.depth = new Float32Array(width * height);
  }

  public get bufferWidth(): number {
    return this.width;
  }

  public get bufferHeight(): number {
    return this.height;
  }

  // Reallocates only when the size actually changed — E9b's resize observer
  // can fire on every frame of a drag, and two fresh typed arrays on every
  // one of those would be exactly the allocation churn this class exists to
  // avoid on the steady-state frame.
  public setSize(width: number, height: number) {
    if (width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.colour = new Uint8ClampedArray(width * height * 4);
    this.depth = new Float32Array(width * height);
  }

  // Seeds the colour buffer from the background snapshot's own bytes — a
  // copy, not a reference, so the rasteriser can go on writing into this
  // buffer without corrupting the snapshot the next frame reads from. Depth
  // resets to 0, the sentinel every real 1/d beats.
  public clear(snapshot: Uint8ClampedArray) {
    this.colour.set(snapshot);
    this.depth.fill(0);
  }

  // The one test a pixel has to pass to reach the buffer: nearer than
  // whatever is already there. Split from writePixel so the rasteriser's
  // inner loop can skip a losing pixel — the common case the moment a mesh
  // has any self-occlusion at all — without touching the colour buffer for
  // a pixel nothing will show.
  public depthTestPasses(x: number, y: number, invD: number): boolean {
    return invD > this.depth[y * this.width + x];
  }

  public readPixel(x: number, y: number): RGBA {
    const index = (y * this.width + x) * 4;

    return [this.colour[index], this.colour[index + 1], this.colour[index + 2], 1];
  }

  // Writes the depth AND the colour, alpha-blended against whatever the
  // buffer already holds — the background snapshot on a pixel's first
  // triangle, an earlier overlapping triangle's colour on a later one. Plain
  // src-over, the same blend context.globalAlpha already gave the painter
  // path, which is what lets the OPACITY slider survive under either
  // backend. The depth write is unconditional on alpha: a translucent
  // surface still owns that pixel's depth, or a nearer opaque triangle drawn
  // after it would blend straight through as if the translucent one had
  // never been there.
  public writePixel(x: number, y: number, invD: number, r: number, g: number, b: number, alpha: number) {
    const pixelIndex = y * this.width + x;
    const byteIndex = pixelIndex * 4;

    this.depth[pixelIndex] = invD;

    if (alpha >= 1) {
      this.colour[byteIndex] = r;
      this.colour[byteIndex + 1] = g;
      this.colour[byteIndex + 2] = b;
      this.colour[byteIndex + 3] = 255;
    } else {
      const inverse = 1 - alpha;

      this.colour[byteIndex] = r * alpha + this.colour[byteIndex] * inverse;
      this.colour[byteIndex + 1] = g * alpha + this.colour[byteIndex + 1] * inverse;
      this.colour[byteIndex + 2] = b * alpha + this.colour[byteIndex + 2] * inverse;
      this.colour[byteIndex + 3] = 255;
    }
  }

  // The one DOM dependency in this class, and the only method that touches
  // it. Whole-buffer, deliberately — see this file's header for why a
  // partial upload is not just a missed optimisation but a correctness bug
  // once a post-mesh overlay draws onto the canvas every frame.
  public present(context: CanvasRenderingContext2D) {
    const image = new ImageData(this.colour, this.width, this.height);

    context.putImageData(image, 0, 0);
  }
}

export default FrameBuffer;
