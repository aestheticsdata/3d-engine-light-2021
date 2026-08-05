// The frame-time card: how long the last frame took, and where it went.
//
// The card shipped with a single grey unattributed segment because the
// renderer was not instrumented and the design's four phases were invented
// numbers. All four are real now (E6/COS-239):
//
//   TRANSFORM   the rig's own matrix pass (Main, unchanged since COS-238)
//               plus Mesh.renderMesh's projection pass — both are genuinely
//               "apply a transform to every vertex", so both land here
//   CLIP-CULL   Mesh.renderMesh's clip-cull pass: the depth sort, the near/far
//               rejection COS-236 already added, and the 2D facing test —
//               fused into one Triangle.render call before this ticket, and
//               too cheap individually to have been worth timing on their own
//   RASTERIZE   Mesh.renderMesh's raster pass: Triangle.fill on survivors only
//   PRESENT     the background pass (sky, floor, grid, vignette) or the
//               clearRect fallback — there is still no present/swap step in a
//               2D canvas, so this is what the design's PRESENT phase maps to
//               here, exactly as COS-224 mapped it to the phase this replaces
//
// FILL RATE is real too: summed projected triangle area over drawn triangles,
// which is submitted coverage rather than resolved coverage — it exceeds the
// buffer's pixel count under overdraw, and that is the correct reading, not a
// bug to clamp away.
//
// The clock-resolution probe runs once at boot (Main), not here: this widget
// only receives its answer and, when the platform's clock could not resolve
// better than 0.2ms, keeps every stage row dashed and marked rather than
// drawing a confident split of what would otherwise be quantisation noise
// wearing four labels. FILL RATE is not gated with them — it is an exact
// geometric sum that never reads the clock at all, so a coarse timer says
// nothing about it.
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

const COARSE_CLOCK_NOTE = "Stage timings need a clock finer than 0.2ms, which this browser does not provide.";

export interface FramePhases {
  transformMs: number;
  clipCullMs: number;
  rasterMs: number;
  presentMs: number;
  fillPx: number;
}

class FrameTimeWidget {
  private readonly fields: FieldWriter;
  private readonly segments: Record<keyof Omit<FramePhases, "fillPx">, HTMLElement[]>;
  private readonly smoothed: FramePhases;
  private readonly hasFineClockResolution: boolean;

  constructor(fields: FieldWriter, hasFineClockResolution: boolean) {
    this.fields = fields;
    this.hasFineClockResolution = hasFineClockResolution;
    // Two bars, one set of numbers: the desktop card and BUDGETS' mobile block
    // are both in the DOM at once, so each phase resolves to a list and every
    // mount gets the same width — the same reason FieldWriter writes text to
    // every matching node rather than the first.
    this.segments = {
      transformMs: this.resolveSegments("transform"),
      clipCullMs: this.resolveSegments("clipcull"),
      rasterMs: this.resolveSegments("raster"),
      presentMs: this.resolveSegments("present"),
    };
    this.smoothed = { transformMs: 0, clipCullMs: 0, rasterMs: 0, presentMs: 0, fillPx: 0 };

    // Marked once, not per render: the probe answers at boot and never changes,
    // so this is a fixed state of the document rather than a per-frame one.
    if (!hasFineClockResolution) {
      this.markStagesUnresolved();
    }
  }

  // Cheap EMA arithmetic, safe on every painted frame whether the loop is
  // animating or a single paused repaint.
  public pushSample(phases: FramePhases) {
    this.smoothed.transformMs = this.smooth(this.smoothed.transformMs, phases.transformMs);
    this.smoothed.clipCullMs = this.smooth(this.smoothed.clipCullMs, phases.clipCullMs);
    this.smoothed.rasterMs = this.smooth(this.smoothed.rasterMs, phases.rasterMs);
    this.smoothed.presentMs = this.smooth(this.smoothed.presentMs, phases.presentMs);
    // Not smoothed: fillPx is an exact per-frame sum, not a noisy clock
    // reading, and averaging it would make overdraw spikes unreadable.
    this.smoothed.fillPx = phases.fillPx;
  }

  public render() {
    // Written before the gate below: fill rate is summed projected area, not a
    // clock reading, so it stays live on a platform whose timer is too coarse
    // to split the frame. The unit lives in the markup beside this node.
    this.fields.write("frameFillRate", Math.round(this.smoothed.fillPx).toLocaleString());

    if (!this.hasFineClockResolution) {
      this.renderUnresolved();

      return;
    }

    const total =
      this.smoothed.transformMs + this.smoothed.clipCullMs + this.smoothed.rasterMs + this.smoothed.presentMs;
    const formattedTotal = total.toFixed(2);

    this.fields.write("frameMs", formattedTotal);
    this.fields.write("frameTimeNote", `${formattedTotal} ms`);
    this.fields.write("ftTransform", this.smoothed.transformMs.toFixed(2));
    this.fields.write("ftClipCull", this.smoothed.clipCullMs.toFixed(2));
    this.fields.write("ftRaster", this.smoothed.rasterMs.toFixed(2));
    this.fields.write("ftPresent", this.smoothed.presentMs.toFixed(2));

    this.setSegment("transformMs", this.smoothed.transformMs, total);
    this.setSegment("clipCullMs", this.smoothed.clipCullMs, total);
    this.setSegment("rasterMs", this.smoothed.rasterMs, total);
    this.setSegment("presentMs", this.smoothed.presentMs, total);
  }

  // The pause half of the ticket's own zeroing (E6/COS-239): snaps every
  // smoothed value to zero directly rather than letting the EMA decay toward
  // it over several frames, which is what stop() needs — a paused console
  // must show no stale timings on the very first frame after the loop stops.
  public reset() {
    this.smoothed.transformMs = 0;
    this.smoothed.clipCullMs = 0;
    this.smoothed.rasterMs = 0;
    this.smoothed.presentMs = 0;
    this.smoothed.fillPx = 0;
  }

  private renderUnresolved() {
    this.fields.write("frameMs", "—");
    this.fields.write("frameTimeNote", "— ms");
    this.fields.write("ftTransform", "—");
    this.fields.write("ftClipCull", "—");
    this.fields.write("ftRaster", "—");
    this.fields.write("ftPresent", "—");

    (Object.keys(this.segments) as Array<keyof Omit<FramePhases, "fillPx">>).forEach((phase) => {
      this.segments[phase].forEach((segment) => {
        segment.style.width = "0%";
      });
    });
  }

  // The same affordance SystemWidget gives an unavailable JS HEAP: the rows
  // stay, dimmed by the pending opacity and carrying the sentence, because the
  // reason they are empty is "your browser's clock is too coarse", not
  // "unbuilt". No --dim class with it: the mobile rows' phase colours are how
  // that card is read, and the attribute already carries the dimming.
  private markStagesUnresolved() {
    ["ftTransform", "ftClipCull", "ftRaster", "ftPresent"].forEach((field) => {
      document.querySelectorAll<HTMLElement>(`[data-field="${field}"]`).forEach((node) => {
        node.setAttribute("data-placeholder", "true");
        node.setAttribute("title", COARSE_CLOCK_NOTE);
        node.setAttribute("aria-describedby", "ph-frame-time-clock");
      });
    });
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

  // Width rather than flex-grow: the four shares have to add to 100% of a bar
  // whose own width is the card's, and a grow factor would also stretch the
  // rounding error.
  private setSegment(phase: keyof Omit<FramePhases, "fillPx">, value: number, total: number) {
    const share = total === 0 ? 0 : (value / total) * 100;
    const width = value === 0 ? 0 : Math.max(MIN_SEGMENT_PERCENT, share);

    this.segments[phase].forEach((segment) => {
      segment.style.width = `${width.toFixed(2)}%`;
    });
  }
}

export default FrameTimeWidget;
