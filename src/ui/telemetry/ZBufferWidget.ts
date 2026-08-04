// The depth histogram: 28 bins over the triangle depths actually submitted this
// frame, rebuilt as the shape turns.
//
// It is NOT a z-buffer, and the card no longer claims to be one. This renderer
// has no depth buffer — Mesh.renderMesh sorts whole triangles by their mean z
// and paints back to front — so there is no per-pixel depth to bucket. What
// there is, every frame and already hot, is one depth per triangle: the sort
// reads it, so walking it a second time to bin it costs a pass over an array
// the renderer has just touched. That distribution is a real property of the
// scene, it moves when the mesh rotates, and it is honest about what it is.
//
// The card was shipped frozen and marked as a placeholder (COS-226 said "no
// timer, no animation, no random walk", to stop invented data reading as live
// instrumentation). Making it real is what removes both the animation objection
// and the placeholder: nothing here is invented, so nothing has to be dimmed.
//
// The axis is the measured depth range rather than the design's 0.1 / 1000.0,
// which were clip planes this engine does not have.

import DOMScope from "@ui/DOMScope";

import type { MeshRenderRequest } from "@primitives/Surface3D";

const BIN_COUNT = 28;
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
  private readonly bins: number[];
  private renderables: readonly MeshRenderRequest[];

  constructor() {
    const scope = new DOMScope(document);
    const missing = "Z-BUFFER node is missing.";

    this.barsRoot = scope.require<HTMLElement>("#zbufferBars", missing);
    this.nearLabel = scope.require<HTMLElement>("#zbufferNear", missing);
    this.farLabel = scope.require<HTMLElement>("#zbufferFar", missing);
    this.bars = [];
    // Allocated once and refilled in place: this is rewritten every display
    // tick, and a fresh array per tick is garbage for no gain.
    this.bins = new Array<number>(BIN_COUNT).fill(0);
    this.renderables = [];
  }

  // The 28 bars exist for the life of the console; only their heights change.
  // Rebuilding the nodes each tick would be a layout thrash for nothing.
  public mount() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < BIN_COUNT; index++) {
      const bar = document.createElement("span");
      bar.className = `zbuffer__bar zbuffer__bar--${this.band(index)}`;
      bar.style.height = "0%";
      this.bars.push(bar);
      fragment.appendChild(bar);
    }

    this.barsRoot.replaceChildren(fragment);
  }

  // Keeps the reference, does no work: binning 7920 depths belongs on the 90ms
  // display tick, not on every one of 60 frames a second. The array is the
  // transition machine's live list and the two calls happen inside the same
  // synchronous frame, so it cannot go stale between them.
  public pushFrame(renderables: readonly MeshRenderRequest[]) {
    this.renderables = renderables;
  }

  public render() {
    const range = this.measureRange();

    if (!range) {
      this.bars.forEach((bar) => {
        bar.style.height = "0%";
      });
      this.nearLabel.textContent = "—";
      this.farLabel.textContent = "—";

      return;
    }

    this.fillBins(range);

    const peak = Math.max(...this.bins);

    this.bars.forEach((bar, index) => {
      const count = this.bins[index];
      const share = peak === 0 ? 0 : (count / peak) * MAX_PERCENT;
      const height = count === 0 ? 0 : Math.max(MIN_OCCUPIED_PERCENT, share);

      bar.style.height = `${height.toFixed(2)}%`;
    });

    this.nearLabel.textContent = range.near.toFixed(0);
    this.farLabel.textContent = range.far.toFixed(0);
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

  // Larger depth is farther: Point3D divides by `focal + z + zOffset`, and
  // Mesh.sortByDepth paints descending so the far faces go down first. So bin 0
  // is the near end, which is the direction the header note promises.
  private measureRange(): { near: number; far: number } | null {
    let near = Number.POSITIVE_INFINITY;
    let far = Number.NEGATIVE_INFINITY;
    let seen = 0;

    this.renderables.forEach((renderable) => {
      renderable.mesh.forEachTriangleDepth((depth) => {
        seen += 1;
        if (depth < near) {
          near = depth;
        }
        if (depth > far) {
          far = depth;
        }
      });
    });

    return seen === 0 ? null : { near, far };
  }

  private fillBins(range: { near: number; far: number }) {
    this.bins.fill(0);

    // A flat mesh seen edge-on can collapse the range to a single value; without
    // this the scale divides by zero and every triangle lands in one bin at NaN.
    const span = range.far - range.near || 1;

    this.renderables.forEach((renderable) => {
      renderable.mesh.forEachTriangleDepth((depth) => {
        const position = ((depth - range.near) / span) * BIN_COUNT;
        const index = Math.min(BIN_COUNT - 1, Math.floor(position));

        this.bins[index] += 1;
      });
    });
  }
}

export default ZBufferWidget;
