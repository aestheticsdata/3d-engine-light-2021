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
// BUFFER and COLOR BUFFER read the canvas once at boot the same way every
// other seed-time row does, and recompute through setBuffer() whenever Main's
// resize path changes the backing store (E9b/COS-250) — a live push, not a
// second read of the canvas on some other cadence, so this card cannot
// describe a buffer the renderer just moved past.
//
// JS HEAP prefers measureUserAgentSpecificMemory() (E6/COS-239): unlike
// performance.memory it is unquantised and not Chromium-only by spec, but it
// is only actually implemented in Chromium today, it is async, and the
// platform rate-limits it — so it is polled on its own ten-second clock
// rather than the 90ms display gate, and a rejected or still-pending read
// holds the last value rather than blanking the row. It is also only
// available when the page is cross-origin isolated, which vite.config.js's
// dev-only COOP/COEP headers make true in dev; production isolation depends
// on the static host and is out of scope here. Everywhere else falls back to
// performance.memory on the 90ms gate, unchanged.

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
// The spec rate-limits calls per origin; ten seconds is comfortably under
// every browser's documented limit while still being far more often than
// this row needs to move for a reader to trust it as live.
const ISOLATED_MEMORY_POLL_INTERVAL_MS = 10000;

// Non-standard and Chromium-only: absent in Firefox and Safari, and quantised
// on pages that are not cross-origin isolated. Declared here rather than
// widened globally, because nothing else in the console may assume it exists.
interface PerformanceMemory {
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

interface MemoryMeasurement {
  bytes: number;
}

// Also non-standard: shipped behind crossOriginIsolated in Chromium, absent
// everywhere else. A second local interface rather than widening the one
// above — the two APIs answer different questions (a live snapshot vs. an
// awaited, rate-limited measurement) and nothing but this class reads either.
interface PerformanceWithMemoryMeasurement extends Performance {
  measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>;
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

export interface SystemWidgetOptions {
  fields: FieldWriter;
  canvas: HTMLCanvasElement;
  // Re-runs Main's resize path when the display's own pixel ratio changes
  // (E9b/COS-250) — dragging the window to another screen without resizing it
  // does not fire ResizeObserver, and this is the one listener in the tree
  // already keyed to devicePixelRatio, so a second one is not added beside it.
  onDprChange?: () => void;
}

class SystemWidget {
  private readonly fields: FieldWriter;
  private readonly canvas: HTMLCanvasElement;
  private readonly notifyDprChange: (() => void) | undefined;
  private readonly heapNodes: HTMLElement[];
  private readonly bootTime: number;
  private intervalId: number;
  private dprQuery: MediaQueryList | null;
  // The isolated path's own cache: awaited once every ten seconds and read
  // synchronously from render(), which cannot itself become async without
  // changing every other widget's render() contract on the same tick.
  private isolatedMemoryMb: number | null;
  private lastIsolatedPollAt: number;
  private pollingIsolatedMemory: boolean;

  constructor(options: SystemWidgetOptions) {
    this.fields = options.fields;
    this.canvas = options.canvas;
    this.notifyDprChange = options.onDprChange;
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
    this.isolatedMemoryMb = null;
    this.lastIsolatedPollAt = 0;
    this.pollingIsolatedMemory = false;
  }

  // U+00D7, as the design draws it — not the letter x. Called from seed() and
  // again from Main's resize path (E9b/COS-250), so both writes go through one
  // derivation rather than two that could disagree about BYTES_PER_PIXEL.
  public setBuffer(width: number, height: number) {
    const megabytes = (width * height * BYTES_PER_PIXEL) / BYTES_PER_MB;

    this.fields.write("sysBuffer", `${width} × ${height} × ${BITS_PER_PIXEL}`);
    // COLOR BUFFER, not the design's COLOR + DEPTH: that label's 3.43 MB counts
    // four bytes of depth this renderer does not allocate (see the z-buffer
    // card, which is a placeholder for exactly that reason).
    this.fields.write("sysColorBuffer", `${megabytes.toFixed(2)} MB`);
  }

  public seed() {
    this.setBuffer(this.canvas.width, this.canvas.height);

    // Unavailable only when neither path answers — the isolated path is a
    // pending promise at this point, not an absent one, and marking the row
    // here would flash the dimmed state for the ten seconds before its first
    // read resolves.
    if (!this.readHeapMegabytes() && !this.hasIsolatedMemoryApi()) {
      this.markHeapUnavailable();
    }

    if (this.hasIsolatedMemoryApi()) {
      this.pollIsolatedMemory();
    }

    this.writeDpr();
    this.armDprListener();
    this.writeUptime();
    this.intervalId = window.setInterval(this.writeUptime, UPTIME_TICK_MS);
  }

  // Only the heap moves per frame, so this is the only row on the 90ms gate.
  public render() {
    if (this.hasIsolatedMemoryApi()) {
      this.maybePollIsolatedMemory();

      if (this.isolatedMemoryMb !== null) {
        this.fields.write("jsHeap", `${this.isolatedMemoryMb.toFixed(2)} MB`);
      }

      return;
    }

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

  // crossOriginIsolated is the platform's own signal that the two response
  // headers below actually took: vite.config.js sets them in dev, but a
  // production host that drops COOP/COEP silently falls this back to
  // performance.memory rather than calling an API the platform will reject.
  private hasIsolatedMemoryApi(): boolean {
    return (
      window.crossOriginIsolated === true &&
      typeof (performance as PerformanceWithMemoryMeasurement).measureUserAgentSpecificMemory === "function"
    );
  }

  private maybePollIsolatedMemory() {
    const now = performance.now();

    if (this.pollingIsolatedMemory || now - this.lastIsolatedPollAt < ISOLATED_MEMORY_POLL_INTERVAL_MS) {
      return;
    }

    this.pollIsolatedMemory();
  }

  private pollIsolatedMemory() {
    const measure = (performance as PerformanceWithMemoryMeasurement).measureUserAgentSpecificMemory;

    if (!measure) {
      return;
    }

    this.pollingIsolatedMemory = true;
    this.lastIsolatedPollAt = performance.now();

    measure
      .call(performance)
      .then((measurement) => {
        this.isolatedMemoryMb = measurement.bytes / BYTES_PER_MB;
      })
      // Rate-limited or refused mid-session: hold the last reading rather
      // than blanking a row that was working a moment ago.
      .catch(() => {})
      .finally(() => {
        this.pollingIsolatedMemory = false;
      });
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
    this.notifyDprChange?.();
  };

  private writeUptime = () => {
    this.fields.write("uptime", formatUptime(performance.now() - this.bootTime));
  };
}

export default SystemWidget;
