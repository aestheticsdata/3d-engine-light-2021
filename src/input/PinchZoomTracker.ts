// Two-finger pinch-to-zoom, factored out of PointerOrbit so a pinch's own
// start distance and start zoom — measured once when the second finger lands,
// compared against on every move after — do not compete with drag-orbit's
// per-frame running total for space in the same file.

interface PointerPosition {
  x: number;
  y: number;
}

// Doubling the finger separation moves the slider this many points; the log2
// is what makes spreading the fingers and pinching them back by the same
// factor move the slider by the same amount in both directions.
const PINCH_ZOOM_SPAN = 30;
// A floor under the start distance, not a real gesture size: two touch points
// reported at (or within a pixel of) the same coordinate would otherwise divide
// by zero on the very next update and hand onZoom a NaN that poisons the store.
const MIN_START_DISTANCE_PX = 1;

class PinchZoomTracker {
  private readonly getZoom: () => number;
  private startDistance: number;
  private startZoom: number;

  constructor(getZoom: () => number) {
    this.getZoom = getZoom;
    this.startDistance = MIN_START_DISTANCE_PX;
    this.startZoom = 0;
  }

  public begin(a: PointerPosition, b: PointerPosition) {
    this.startDistance = Math.max(MIN_START_DISTANCE_PX, this.distanceBetween(a, b));
    this.startZoom = this.getZoom();
  }

  // The caller clamps: this returns the raw value so the 0..100 clamp lives in
  // one place, beside the wheel handler's own.
  public update(a: PointerPosition, b: PointerPosition): number {
    const distance = this.distanceBetween(a, b);

    return this.startZoom + PINCH_ZOOM_SPAN * Math.log2(distance / this.startDistance);
  }

  private distanceBetween(a: PointerPosition, b: PointerPosition): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

export default PinchZoomTracker;
