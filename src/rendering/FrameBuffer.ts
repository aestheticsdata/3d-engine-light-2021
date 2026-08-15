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
// itself: BackgroundRenderer.renderVignetteOverlay draws the vignette
// directly onto the CANVAS every frame, as a partial-alpha overlay on top of
// whatever is already there. With only a small region re-uploaded each frame,
// everywhere OUTSIDE it never got a fresh background under that overlay — so
// the vignette composited onto itself, frame after frame, converging toward
// fully opaque in well under a second at 60fps. A full upload is what
// guarantees renderVignetteOverlay always draws its one-shot overlay onto the
// canvas THIS frame's buffer produced, never onto an accumulation of frames
// past.
//
// E3e/3DE-115 tried to remove that constraint by blending the vignette into
// this buffer instead, which would have made a dirty rect valid again. It was
// measured and reverted, and the numbers are worth keeping because they close
// the question rather than leaving it open. A whole-buffer putImageData costs
// 0.24ms at 1024x640 and 0.78ms at 1615x991 — it is not where a heavy frame
// goes. Evaluating the vignette per pixel in JS over the same 1615x991 frame
// costs 5.7ms, because a CanvasGradient fill is not something a hand-written
// loop can match. The dirty rect only ever clawed back a cost the compositing
// had just introduced, and netted out at break-even. What DID come out of that
// ticket is next door in Surface3D: the stage timings on this backend were
// double-counting the mesh loop into `present`, which is why present looked
// like the largest stage in the first place.

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
    return this.depthTestPassesAt(y * this.width + x, invD);
  }

  // The same three tests and writes, addressed by a pixel index the caller
  // already has (E3f/3DE-116). Rasterizer's inner loop holds the row's base
  // index and adds x to it, so the multiply that y * width + x costs happens
  // once per scanline rather than twice per surviving pixel — once for the
  // depth test and again for the write.
  //
  // The coordinate forms above and below are not duplicates of these: they are
  // these, called with the index computed. fillPoint keeps them because a point
  // walks a block rather than a row and has no base index to carry.
  public depthTestPassesAt(index: number, invD: number): boolean {
    return invD > this.depth[index];
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
    this.writePixelAt(y * this.width + x, invD, r, g, b, alpha);
  }

  public writePixelAt(index: number, invD: number, r: number, g: number, b: number, alpha: number) {
    const byteIndex = index * 4;

    this.depth[index] = invD;

    if (alpha >= 1) {
      this.colour[byteIndex] = r;
      this.colour[byteIndex + 1] = g;
      this.colour[byteIndex + 2] = b;
      this.colour[byteIndex + 3] = 255;

      return;
    }

    this.blendInto(byteIndex, r, g, b, alpha);
  }

  // Colour without depth — E3d/COS-244's edge feather, and the one write in this
  // class that deliberately leaves the depth map alone. A pixel the triangle only
  // partly covers has no business claiming it: the rest of that pixel still
  // belongs to whatever is behind, and a depth written from a fragment that owns
  // a third of the area would reject the surface that owns the other two thirds.
  // Rasterizer's fillTriangle carries the rest of the argument.
  public blendPixel(x: number, y: number, r: number, g: number, b: number, alpha: number) {
    this.blendInto((y * this.width + x) * 4, r, g, b, alpha);
  }

  public blendPixelAt(index: number, r: number, g: number, b: number, alpha: number) {
    this.blendInto(index * 4, r, g, b, alpha);
  }

  private blendInto(byteIndex: number, r: number, g: number, b: number, alpha: number) {
    const inverse = 1 - alpha;

    this.colour[byteIndex] = r * alpha + this.colour[byteIndex] * inverse;
    this.colour[byteIndex + 1] = g * alpha + this.colour[byteIndex + 1] * inverse;
    this.colour[byteIndex + 2] = b * alpha + this.colour[byteIndex + 2] * inverse;
    this.colour[byteIndex + 3] = 255;
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
