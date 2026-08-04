// The frame-time card: how long the last frame took, and where it went.
//
// The card shipped with a single grey unattributed segment because the renderer
// was not instrumented and the design's four phases are invented numbers. Three
// of them are now measured, so three of them are real:
//
//   TRANSFORM   the per-frame matrix pass — CameraController.rotate over every
//               active mesh, timed by Main around the call
//   BACKGROUND  the sky, floor and vignette pass, timed inside Surface3D
//   RASTERIZE   the mesh pass: depth sort, backface test and fill
//
// The design's CLIP / CULL and PRESENT are gone rather than mocked. There is no
// present step in a 2D canvas, and the backface test happens inside
// Triangle.render one triangle at a time, where timing it would cost more than
// the test. FILL RATE stays a placeholder: it needs a pixel count nothing
// produces yet (de-mock E6).
//
// Every phase is smoothed the way FPSMeter smooths fps. Raw per-frame timings
// off performance.now() jitter by more than they drift, and four numbers
// flickering in the third significant figure are unreadable — the bar would
// twitch rather than move.

import type FieldWriter from "@ui/FieldWriter";

const SMOOTHING_FACTOR = 0.2;
// Below this the segment is too thin to read as a colour rather than as a line,
// and the bar looks broken. Only spent on phases that really are running.
const MIN_SEGMENT_PERCENT = 1.5;

export interface FramePhases {
  transformMs: number;
  backgroundMs: number;
  rasterMs: number;
}

class FrameTimeWidget {
  private readonly fields: FieldWriter;
  private readonly segments: Record<keyof FramePhases, HTMLElement[]>;
  private readonly smoothed: FramePhases;

  constructor(fields: FieldWriter) {
    this.fields = fields;
    // Two bars, one set of numbers: the desktop card and BUDGETS' mobile block
    // are both in the DOM at once, so each phase resolves to a list and every
    // mount gets the same width — the same reason FieldWriter writes text to
    // every matching node rather than the first.
    this.segments = {
      transformMs: this.resolveSegments("transform"),
      backgroundMs: this.resolveSegments("background"),
      rasterMs: this.resolveSegments("raster"),
    };
    this.smoothed = { transformMs: 0, backgroundMs: 0, rasterMs: 0 };
  }

  // Cheap EMA arithmetic, safe on every painted frame whether the loop is
  // animating or a single paused repaint.
  public pushSample(phases: FramePhases) {
    this.smoothed.transformMs = this.smooth(this.smoothed.transformMs, phases.transformMs);
    this.smoothed.backgroundMs = this.smooth(this.smoothed.backgroundMs, phases.backgroundMs);
    this.smoothed.rasterMs = this.smooth(this.smoothed.rasterMs, phases.rasterMs);
  }

  public render() {
    const total = this.smoothed.transformMs + this.smoothed.backgroundMs + this.smoothed.rasterMs;
    const formattedTotal = total.toFixed(2);

    this.fields.write("frameMs", formattedTotal);
    this.fields.write("frameTimeNote", `${formattedTotal} ms`);
    this.fields.write("ftTransform", this.smoothed.transformMs.toFixed(2));
    this.fields.write("ftBackground", this.smoothed.backgroundMs.toFixed(2));
    this.fields.write("ftRaster", this.smoothed.rasterMs.toFixed(2));

    this.setSegment("transformMs", this.smoothed.transformMs, total);
    this.setSegment("backgroundMs", this.smoothed.backgroundMs, total);
    this.setSegment("rasterMs", this.smoothed.rasterMs, total);
  }

  private resolveSegments(phase: string): HTMLElement[] {
    const selector = `[data-ft-segment="${phase}"]`;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));

    if (nodes.length === 0) {
      throw new Error(`FRAME TIME node is missing — no element matches ${selector}.`);
    }

    return nodes;
  }

  private smooth(current: number, sample: number): number {
    return current === 0 ? sample : current + (sample - current) * SMOOTHING_FACTOR;
  }

  // Width rather than flex-grow: the three shares have to add to 100% of a bar
  // whose own width is the card's, and a grow factor would also stretch the
  // rounding error.
  private setSegment(phase: keyof FramePhases, value: number, total: number) {
    const share = total === 0 ? 0 : (value / total) * 100;
    const width = value === 0 ? 0 : Math.max(MIN_SEGMENT_PERCENT, share);

    this.segments[phase].forEach((segment) => {
      segment.style.width = `${width.toFixed(2)}%`;
    });
  }
}

export default FrameTimeWidget;
