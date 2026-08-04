// The SYSTEM card: what the renderer draws into, and what it is running on.
//
// This class also owns the console's uptime clock, which is why it is the one
// telemetry widget with a timer. The clock is a dedicated setInterval and NOT
// the 90ms display gate, and that is load-bearing rather than incidental:
// RenderLoop.stop() cancels rAF on pause, and the gate only runs from inside
// the rAF callback — so a clock driven by it would freeze the moment someone
// pressed PAUSE, while the design keeps counting (L1223). The status bar's
// uptime segment reads the field this class writes and starts no timer of its
// own.
//
// Three of the five rows are computed once at boot. The canvas is a fixed
// 1024x640 backing store that BackgroundRenderer, ShapeTransitionMachine and
// every Point3D capture at construction, and there is no CSS scaling of the
// backing store, so BUFFER and COLOR BUFFER cannot change while the console is
// open. COS-250 (E9b) is what makes them recomputable.

import type FieldWriter from "@ui/FieldWriter";

// Both branches' rows carry it, and the unavailable case marks every one — so
// this is a list, which is the one case DOMScope's single-node require() does
// not cover.
const HEAP_SELECTOR = "[data-field='jsHeap']";
const BYTES_PER_PIXEL = 4;
const BITS_PER_PIXEL = 32;
// The design divides by 1048576 and calls the result MB; keep both, so the
// number on screen matches the mockup rather than being quietly 5% smaller.
const BYTES_PER_MB = 1048576;
const UPTIME_TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const HEAP_UNAVAILABLE_NOTE = "JS heap size is not exposed by this browser.";

// Non-standard and Chromium-only: absent in Firefox and Safari, and quantised
// on pages that are not cross-origin isolated. Declared here rather than
// widened globally, because nothing else in the console may assume it exists.
interface PerformanceMemory {
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

// Minutes unpadded, seconds padded — the design's own formatting (L1452).
// Exported because the format is the contract between this clock and anything
// that later needs to render the same elapsed time.
export const formatUptime = (elapsedMs: number): string => {
  const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

class SystemWidget {
  private readonly fields: FieldWriter;
  private readonly canvas: HTMLCanvasElement;
  private readonly heapNodes: HTMLElement[];
  private readonly bootTime: number;
  private intervalId: number;
  private dprQuery: MediaQueryList | null;

  constructor(fields: FieldWriter, canvas: HTMLCanvasElement) {
    this.fields = fields;
    this.canvas = canvas;
    // Resolved as nodes rather than reached through the writer because the
    // unavailable branch sets attributes and a class, not text.
    this.heapNodes = Array.from(document.querySelectorAll<HTMLElement>(HEAP_SELECTOR));

    if (this.heapNodes.length === 0) {
      throw new Error(`SYSTEM node is missing — no element matches ${HEAP_SELECTOR}.`);
    }

    // Recorded here rather than read as a bare performance.now() later: that
    // clock starts at navigation, so the card would open at 0:01 or worse on a
    // cold load instead of at 0:00.
    this.bootTime = performance.now();
    this.intervalId = 0;
    this.dprQuery = null;
  }

  public seed() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const megabytes = (width * height * BYTES_PER_PIXEL) / BYTES_PER_MB;

    // U+00D7, as the design draws it — not the letter x.
    this.fields.write("sysBuffer", `${width} × ${height} × ${BITS_PER_PIXEL}`);
    // COLOR BUFFER, not the design's COLOR + DEPTH: that label's 3.43 MB counts
    // four bytes of depth this renderer does not allocate (see the z-buffer
    // card, which is a placeholder for exactly that reason).
    this.fields.write("sysColorBuffer", `${megabytes.toFixed(2)} MB`);

    if (!this.readHeapMegabytes()) {
      this.markHeapUnavailable();
    }

    this.writeDpr();
    this.armDprListener();
    this.writeUptime();
    this.intervalId = window.setInterval(this.writeUptime, UPTIME_TICK_MS);
  }

  // Only the heap moves per frame, so this is the only row on the 90ms gate.
  public render() {
    const megabytes = this.readHeapMegabytes();

    if (megabytes === null) {
      return;
    }

    this.fields.write("jsHeap", `${megabytes.toFixed(2)} MB`);
  }

  public dispose() {
    window.clearInterval(this.intervalId);
    this.dprQuery?.removeEventListener("change", this.onDprChange);
  }

  private readHeapMegabytes(): number | null {
    const memory = (performance as PerformanceWithMemory).memory;

    return memory ? memory.usedJSHeapSize / BYTES_PER_MB : null;
  }

  // The row stays, dimmed and marked, rather than being removed: dropping it
  // would change the card's height and row count between browsers, and the
  // reason it is empty is "your browser does not expose this", not "unbuilt".
  private markHeapUnavailable() {
    this.heapNodes.forEach((node) => {
      node.classList.add("stat-row__value--dim");
      node.setAttribute("data-placeholder", "true");
      node.setAttribute("title", HEAP_UNAVAILABLE_NOTE);
      node.setAttribute("aria-describedby", "ph-js-heap");
    });
  }

  private writeDpr() {
    this.fields.write("sysDpr", window.devicePixelRatio.toFixed(2));
  }

  // A resolution media query fires once, when the ratio leaves the value it was
  // armed with — so it has to be re-armed against the new one each time. A
  // plain resize listener misses the case this exists for: dragging the window
  // to a display with a different pixel ratio without changing its size.
  private armDprListener() {
    this.dprQuery?.removeEventListener("change", this.onDprChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener("change", this.onDprChange);
  }

  // Arrow properties, and both are the case R9 sanctions: one is handed to
  // addEventListener and the other to setInterval, and each needs its `this`.
  private onDprChange = () => {
    this.writeDpr();
    this.armDprListener();
  };

  private writeUptime = () => {
    this.fields.write("uptime", formatUptime(performance.now() - this.bootTime));
  };
}

export default SystemWidget;
