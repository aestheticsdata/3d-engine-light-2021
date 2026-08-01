// The frame-rate sample, and the throttle that keeps it readable.
//
// Two things are happening and only one of them is per frame. The sliding
// one-second window and the exponential smoothing run on every call, because
// dropping samples would change the average. The *publish* is throttled to one
// write per 90ms — at 60fps an unthrottled readout reflows six times per
// hundred milliseconds and is unreadable, and the drawn-triangle count rides
// the same tick so the two numbers on screen always describe the same frame.
//
// sample() returns null between publishes rather than the current value, so the
// caller cannot accidentally write on every frame by ignoring the throttle.
//
// The clock is injected. Reading performance.now() here would make the throttle
// untestable, which is exactly what happened while this lived on Main.

const DISPLAY_UPDATE_INTERVAL_MS = 90;
const SMOOTHING_FACTOR = 0.2;

class FpsMeter {
  private readonly now: () => number;
  private readonly times: number[];
  private fps: number;
  private smoothedFps: number;
  private lastDisplayUpdateAt: number;

  constructor(now: () => number) {
    this.now = now;
    this.times = [];
    this.fps = 0;
    this.smoothedFps = 0;
    this.lastDisplayUpdateAt = 0;
  }

  // Returns the rounded smoothed rate when the throttle window has elapsed, and
  // null otherwise.
  public sample(): number | null {
    const now = this.now();

    while (this.times.length > 0 && this.times[0] <= now - 1000) {
      this.times.shift();
    }

    this.times.push(now);
    this.fps = this.times.length;
    this.smoothedFps =
      this.smoothedFps === 0
        ? this.fps
        : this.smoothedFps + (this.fps - this.smoothedFps) * SMOOTHING_FACTOR;

    if (now - this.lastDisplayUpdateAt < DISPLAY_UPDATE_INTERVAL_MS) {
      return null;
    }

    this.lastDisplayUpdateAt = now;

    return Math.round(this.smoothedFps);
  }

  // The zeroing half of a pause. `times` is deliberately left alone: the window
  // is wall-clock based, so entries older than a second are discarded by the
  // next sample anyway, and clearing it would make the first rate after a
  // resume read 1 instead of picking up where it left off.
  public reset() {
    this.smoothedFps = 0;
    this.lastDisplayUpdateAt = 0;
  }
}

export default FpsMeter;
