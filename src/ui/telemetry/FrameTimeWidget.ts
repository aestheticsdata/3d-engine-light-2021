// The frame-time card's one real number: how long the last measured render
// pass took, smoothed the same way FPSMeter smooths fps.
//
// Everything else in the card — the four TRANSFORM/CLIP/RASTERIZE/PRESENT
// segments and FILL RATE — is a static em-dash placeholder baked into the
// markup, because the renderer has no per-phase timing to report yet
// (de-mock E6). This class owns only the total, so it needs no DOM
// references of its own: both places the total is shown — the header note in
// three cards and the bare number in the toolbar and viewport HUD — already
// exist as [data-field] nodes, so FieldWriter reaches all of them.
//
// pushSample() and render() are split the same way FramerateWidget splits
// them: pushSample() is cheap EMA arithmetic, safe to call every time a frame
// is painted, animated or not. render() is the DOM write, gated to the same
// 90ms cadence as the rest of the telemetry row on the animated path, and
// called once, immediately, after a paused single-frame repaint — there is no
// 60fps flood to throttle there.

import type FieldWriter from "@ui/FieldWriter";

const SMOOTHING_FACTOR = 0.2;

class FrameTimeWidget {
  private readonly fields: FieldWriter;
  private smoothedMs: number;

  constructor(fields: FieldWriter) {
    this.fields = fields;
    this.smoothedMs = 0;
  }

  public pushSample(ms: number) {
    this.smoothedMs = this.smoothedMs === 0 ? ms : this.smoothedMs + (ms - this.smoothedMs) * SMOOTHING_FACTOR;
  }

  public render() {
    const formatted = this.smoothedMs.toFixed(2);

    this.fields.write("frameMs", formatted);
    this.fields.write("frameTimeNote", `${formatted} ms`);
  }
}

export default FrameTimeWidget;
