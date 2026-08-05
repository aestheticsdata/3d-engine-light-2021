// The depth histogram: 28 bins over the eye-space depth of every triangle
// submitted this frame, culled or not.
//
// It is NOT a z-buffer, and the card no longer claims to be one. This renderer
// has no depth buffer — Mesh.renderMesh sorts whole triangles by their mean z
// and paints back to front — so there is no per-pixel depth to bucket. What
// there is, every frame and already hot, is one depth per triangle: the
// clip-cull pass reads it for the near/far test already, so binning it a
// second time costs one add per triangle, not a second pass over the mesh.
//
// The bins arrive pre-filled (E6/COS-239): Mesh.renderMesh writes them into
// the shared RenderStats as it walks each mesh's triangles, over fixed edges
// — camera.distance ± the largest boundingRadius among this frame's
// renderables — rather than this widget's own former per-frame min/max. A
// mesh rotating in place used to make its own axis breathe; the fixed edges
// are why it no longer does, and why the axis now moves only when the zoom
// slider does.
//
// The card was shipped frozen and marked as a placeholder (COS-226 said "no
// timer, no animation, no random walk", to stop invented data reading as live
// instrumentation). Making it real is what removes both the animation
// objection and the placeholder: nothing here is invented, so nothing has to
// be dimmed.

import { DEPTH_BIN_COUNT } from "@rendering/RenderStats";
import DOMScope from "@ui/DOMScope";

// 10 near / 9 mid / 9 far, the design's own banding at L1447.
const NEAR_BAND_END = 10;
const MID_BAND_END = 19;
// A bin with a couple of triangles in it would round to nothing against a peak
// of several hundred, and a histogram with holes reads as broken rather than as
// sparse. Empty bins stay empty; occupied ones get at least this.
const MIN_OCCUPIED_PERCENT = 4;
const MAX_PERCENT = 100;

class ZBufferWidget {
  private readonly barsRoot: HTMLElement;
  private readonly nearLabel: HTMLElement;
  private readonly farLabel: HTMLElement;
  private readonly bars: HTMLElement[];
  private bins: Uint32Array;
  private near: number;
  private far: number;

  constructor() {
    const scope = new DOMScope(document);
    const missing = "Z-BUFFER node is missing.";

    this.barsRoot = scope.require<HTMLElement>("#zbufferBars", missing);
    this.nearLabel = scope.require<HTMLElement>("#zbufferNear", missing);
    this.farLabel = scope.require<HTMLElement>("#zbufferFar", missing);
    this.bars = [];
    this.bins = new Uint32Array(DEPTH_BIN_COUNT);
    this.near = 0;
    this.far = 0;
  }

  // The 28 bars exist for the life of the console; only their heights change.
  // Rebuilding the nodes each tick would be a layout thrash for nothing.
  public mount() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < DEPTH_BIN_COUNT; index++) {
      const bar = document.createElement("span");
      bar.className = `zbuffer__bar zbuffer__bar--${this.band(index)}`;
      bar.style.height = "0%";
      this.bars.push(bar);
      fragment.appendChild(bar);
    }

    this.barsRoot.replaceChildren(fragment);
  }

  // Keeps the reference, does no work: reflowing 28 bars belongs on the 90ms
  // display tick, not on every one of 60 frames a second. RenderStats.depthBins
  // is the same accumulator every frame, refilled in place by Mesh — held
  // rather than copied for the same reason ZBufferWidget always held its input
  // instead of copying it, and read back before the next frame can overwrite
  // it because both calls happen inside the same synchronous paint.
  public pushFrame(bins: Uint32Array, near: number, far: number) {
    this.bins = bins;
    this.near = near;
    this.far = far;
  }

  public render() {
    if (this.near === this.far) {
      this.bars.forEach((bar) => {
        bar.style.height = "0%";
      });
      this.nearLabel.textContent = "—";
      this.farLabel.textContent = "—";

      return;
    }

    const peak = Math.max(...this.bins);

    this.bars.forEach((bar, index) => {
      const count = this.bins[index];
      const share = peak === 0 ? 0 : (count / peak) * MAX_PERCENT;
      const height = count === 0 ? 0 : Math.max(MIN_OCCUPIED_PERCENT, share);

      bar.style.height = `${height.toFixed(2)}%`;
    });

    // One decimal, not zero: the edges are camera.distance ± the bounding
    // radius, so the zoom slider moves them in fractions of a unit and a
    // rounded label would sit still through most of the slider's travel.
    this.nearLabel.textContent = this.near.toFixed(1);
    this.farLabel.textContent = this.far.toFixed(1);
  }

  private band(index: number): string {
    if (index < NEAR_BAND_END) {
      return "near";
    }

    if (index < MID_BAND_END) {
      return "mid";
    }

    return "far";
  }
}

export default ZBufferWidget;
