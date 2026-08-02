// The framerate card's ring buffer, its MIN/AVG/MAX/DROPPED tiles and its
// canvas sparkline — an exact port of the pre-refonte drawFps(). Every value
// here is real; there is no placeholder in this card.
//
// History and the redraw are deliberately split into two entry points.
// pushSample() runs once per rendered frame so the 90-sample buffer really is
// 90 frames of history, matching the header's "90 frames" literal. render()
// — the DOM writes and the canvas repaint — only runs on the same 90ms
// throttle FPSMeter already applies to the toolbar's single FPS number, for
// the same reason the throttle exists there: redrawing six times per hundred
// milliseconds is unreadable and wasted work.

import { chartTokens } from "@ui/chartTokens";
import DOMScope from "@ui/DOMScope";

const HISTORY_LENGTH = 90;
const DROP_THRESHOLD_FPS = 40;
const CHART_MAX_FPS = 68;
const CHART_DPR = 2;
const GRIDLINE_VALUES_FPS = [30, 60];

class FramerateWidget {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly minNode: HTMLElement;
  private readonly avgNode: HTMLElement;
  private readonly maxNode: HTMLElement;
  private readonly droppedNode: HTMLElement;
  private readonly history: number[];
  private dropped: number;

  constructor() {
    const scope = new DOMScope(document);
    const missing = "FRAMERATE node is missing.";

    this.canvas = scope.require<HTMLCanvasElement>("#fpsChart", missing);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available for the framerate chart.");
    }

    this.ctx = ctx;
    this.minNode = scope.require<HTMLElement>("#framerateMin", missing);
    this.avgNode = scope.require<HTMLElement>("#framerateAvg", missing);
    this.maxNode = scope.require<HTMLElement>("#framerateMax", missing);
    this.droppedNode = scope.require<HTMLElement>("#framerateDropped", missing);
    this.history = [];
    this.dropped = 0;
  }

  // Cheap bookkeeping only, safe to call on every rAF frame regardless of the
  // display throttle: an array push/shift and one comparison. render() is
  // what costs a reflow and a canvas repaint.
  public pushSample(fps: number) {
    this.history.push(fps);
    if (this.history.length > HISTORY_LENGTH) {
      this.history.shift();
    }

    if (fps < DROP_THRESHOLD_FPS) {
      this.dropped += 1;
    }
  }

  public render() {
    this.renderStats();
    this.draw();
  }

  // The design's reset() zeroes DROPPED only (L1306): MIN/AVG/MAX and the
  // sparkline are derived from the live buffer and need no restoring of their
  // own — they already read whatever the last 90 frames were.
  public reset() {
    this.dropped = 0;
    this.setValue(this.droppedNode, 0);
  }

  private renderStats() {
    if (this.history.length === 0) {
      return;
    }

    const min = Math.round(Math.min(...this.history));
    const max = Math.round(Math.max(...this.history));
    const avg = Math.round(this.history.reduce((total, value) => total + value, 0) / this.history.length);

    this.setValue(this.minNode, min);
    this.setValue(this.avgNode, avg);
    this.setValue(this.maxNode, max);
    this.setValue(this.droppedNode, this.dropped);
  }

  // Exact port of drawFps(): a DPR-2 backing store resized on either
  // dimension changing, a 68fps ceiling, gridlines at 30/60 offset by 0.5 so
  // they land on a device pixel, a gradient area fill, the sparkline itself
  // and a 3x3 last-sample marker.
  private draw() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    if (this.canvas.width !== width * CHART_DPR || this.canvas.height !== height * CHART_DPR) {
      this.canvas.width = width * CHART_DPR;
      this.canvas.height = height * CHART_DPR;
    }

    const ctx = this.ctx;
    ctx.setTransform(CHART_DPR, 0, 0, CHART_DPR, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = chartTokens.fill;
    ctx.fillRect(0, 0, width, height);

    const y = (value: number) => height - (value / CHART_MAX_FPS) * height;

    ctx.strokeStyle = chartTokens.gridline;
    ctx.lineWidth = 1;
    GRIDLINE_VALUES_FPS.forEach((value) => {
      const lineY = y(value) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();
    });

    ctx.fillStyle = chartTokens.axisLabel;
    ctx.font = chartTokens.font;
    GRIDLINE_VALUES_FPS.forEach((value) => {
      ctx.fillText(String(value), 3, y(value) - 3);
    });

    if (this.history.length < 2) {
      return;
    }

    const step = width / (this.history.length - 1);

    ctx.beginPath();
    ctx.moveTo(0, height);
    this.history.forEach((value, index) => {
      ctx.lineTo(index * step, y(value));
    });
    ctx.lineTo(width, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, chartTokens.gradientTop);
    gradient.addColorStop(1, chartTokens.gradientBottom);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    this.history.forEach((value, index) => {
      if (index === 0) {
        ctx.moveTo(0, y(value));
        return;
      }
      ctx.lineTo(index * step, y(value));
    });
    ctx.strokeStyle = chartTokens.line;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const last = this.history[this.history.length - 1];
    ctx.fillStyle = chartTokens.dot;
    ctx.fillRect(width - 3, y(last) - 1.5, 3, 3);
  }

  private setValue(node: HTMLElement, value: number) {
    node.textContent = String(value);
  }
}

export default FramerateWidget;
