// What one call to Surface3D.render cost, and what it drew (E6/COS-239).
//
// A reusable instance rather than a fresh object per frame: Mesh's three
// passes and Surface3D's own background/present timing all write into the
// same accumulator, and re-allocating a depthBins Uint32Array 60 times a
// second for a card that reads it every 90ms would be the exact allocation
// churn T28/T29 spent this codebase's early tickets removing.
//
// Two different update rhythms live here on purpose. The counts — drawCalls,
// fillPx, submitted, drawn, inverted, depthBins — are cheap arithmetic over
// work the render pass is already doing, so beginFrame() resets them and they
// are rebuilt every single frame. The four stage timings are not cheap to
// *measure*: performance.now() calls around a hot loop are what the sampling
// gate exists to bound, so they update only on the one frame in six
// beginFrame() marks sampled, and hold their previous value the other five —
// which is what makes the displayed numbers a representative sample of the
// real pass structure rather than a different, lighter code path.
//
// depthNear/depthFar must be set (setDepthRange) before any addDepthSample
// call in the same frame: the bin edges are fixed for the frame, not
// recomputed per sample, so binning against a stale range would misplace
// every triangle read before the call that corrects it.

// 10 near / 9 mid / 9 far, the z-buffer card's own banding.
export const DEPTH_BIN_COUNT = 28;

// One frame in six is timed; performance.now() is not free and the raster
// loop runs up to 7920 triangles on the torus knot, doubling mid-transition.
const INSTRUMENT_SAMPLE_INTERVAL = 6;

class RenderStats {
  private frameIndex: number;
  private sampledTransformMs: number;
  private sampledClipCullMs: number;
  private sampledRasterMs: number;
  private sampledPresentMs: number;
  private drawCallCount: number;
  private fillPxTotal: number;
  private submittedCount: number;
  private drawnCount: number;
  private invertedCount: number;
  private near: number;
  private far: number;
  private readonly bins: Uint32Array;

  constructor() {
    this.frameIndex = 0;
    this.sampledTransformMs = 0;
    this.sampledClipCullMs = 0;
    this.sampledRasterMs = 0;
    this.sampledPresentMs = 0;
    this.drawCallCount = 0;
    this.fillPxTotal = 0;
    this.submittedCount = 0;
    this.drawnCount = 0;
    this.invertedCount = 0;
    this.near = 0;
    this.far = 0;
    this.bins = new Uint32Array(DEPTH_BIN_COUNT);
  }

  public get transformMs(): number {
    return this.sampledTransformMs;
  }

  public get clipCullMs(): number {
    return this.sampledClipCullMs;
  }

  public get rasterMs(): number {
    return this.sampledRasterMs;
  }

  public get presentMs(): number {
    return this.sampledPresentMs;
  }

  // Derived from the four above rather than stored, which is what guarantees
  // the stages sum to it — the frame-time ticket's own header total (D5) — by
  // construction instead of by two call sites agreeing to keep two totals in
  // step.
  public get totalMs(): number {
    return this.sampledTransformMs + this.sampledClipCullMs + this.sampledRasterMs + this.sampledPresentMs;
  }

  public get drawCalls(): number {
    return this.drawCallCount;
  }

  public get fillPx(): number {
    return this.fillPxTotal;
  }

  public get submitted(): number {
    return this.submittedCount;
  }

  public get drawn(): number {
    return this.drawnCount;
  }

  // Triangles the near plane should already have excluded (E2) that reached
  // the fill accounting with a non-positive projection denominator anyway. It
  // must stay at zero; a nonzero reading means the near plane has a hole.
  public get inverted(): number {
    return this.invertedCount;
  }

  public get depthNear(): number {
    return this.near;
  }

  public get depthFar(): number {
    return this.far;
  }

  public get depthBins(): Uint32Array {
    return this.bins;
  }

  // Called once at the very start of a rendered frame — before the rig's own
  // matrix pass, before Surface3D.render, before anything this frame times.
  // Resets every per-frame count unconditionally, since those are cheap to
  // rebuild every frame regardless of sampling. Returns whether this is one
  // of the sampled frames; only then does it also zero the four timing
  // accumulators, which is what lets several add*Ms calls — the rig's own
  // pass plus however many renderables Surface3D iterates — sum into one
  // frame's reading instead of each overwriting the last. On an unsampled
  // frame the timings are left exactly as they were, which is the hold that
  // makes the display read the last real sample rather than a stale zero.
  public beginFrame(): boolean {
    this.frameIndex += 1;
    this.drawCallCount = 0;
    this.fillPxTotal = 0;
    this.submittedCount = 0;
    this.drawnCount = 0;
    this.invertedCount = 0;
    this.bins.fill(0);

    const timed = this.frameIndex % INSTRUMENT_SAMPLE_INTERVAL === 0;

    if (timed) {
      this.sampledTransformMs = 0;
      this.sampledClipCullMs = 0;
      this.sampledRasterMs = 0;
      this.sampledPresentMs = 0;
    }

    return timed;
  }

  // Callers must only reach these when beginFrame() returned true — that is
  // the whole contract that keeps an unsampled frame's performance.now() call
  // count at zero.
  public addTransformMs(ms: number) {
    this.sampledTransformMs += ms;
  }

  public addClipCullMs(ms: number) {
    this.sampledClipCullMs += ms;
  }

  public addRasterMs(ms: number) {
    this.sampledRasterMs += ms;
  }

  public addPresentMs(ms: number) {
    this.sampledPresentMs += ms;
  }

  public setDepthRange(near: number, far: number) {
    this.near = near;
    this.far = far;
  }

  public addDrawCall() {
    this.drawCallCount += 1;
  }

  public addFillPx(pixels: number) {
    this.fillPxTotal += pixels;
  }

  public addSubmitted(count: number) {
    this.submittedCount += count;
  }

  public addDrawn() {
    this.drawnCount += 1;
  }

  public addInverted() {
    this.invertedCount += 1;
  }

  // depth is eye-space (z + camera.distance), the same space depthNear/Far
  // are expressed in — not the mean-z Triangle.depth already returns for the
  // painter's sort, which that sort must go on using untouched.
  public addDepthSample(depth: number) {
    const span = this.far - this.near || 1;
    const position = ((depth - this.near) / span) * DEPTH_BIN_COUNT;
    const index = Math.min(DEPTH_BIN_COUNT - 1, Math.max(0, Math.floor(position)));

    this.bins[index] += 1;
  }

  // The pause half of the frame-time ticket's own zeroing: RenderLoop.stop()
  // must not leave a paused console showing the last playing frame's stage
  // split, fill rate or draw-call count.
  public zero() {
    this.sampledTransformMs = 0;
    this.sampledClipCullMs = 0;
    this.sampledRasterMs = 0;
    this.sampledPresentMs = 0;
    this.drawCallCount = 0;
    this.fillPxTotal = 0;
    this.submittedCount = 0;
    this.drawnCount = 0;
    this.invertedCount = 0;
    this.near = 0;
    this.far = 0;
    this.bins.fill(0);
  }
}

export default RenderStats;
