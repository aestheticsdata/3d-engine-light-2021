// A double tap is two touch releases landing within an interval and a
// distance of each other — but a release only counts as a *tap* candidate at
// all if that pointer barely moved between its own down and up. Without that
// check, the release point of an ordinary one-finger drag would seed "last
// tap" state, and a later, unrelated single tap landing near where the drag
// happened to end would read as the second half of a double tap it was never
// part of.

const DOUBLE_TAP_INTERVAL_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 24;

interface PointerPosition {
  x: number;
  y: number;
}

class DoubleTapDetector {
  private readonly downPositions: Map<number, PointerPosition>;
  private lastTapTimestamp: number;
  private lastTapX: number;
  private lastTapY: number;

  constructor() {
    this.downPositions = new Map();
    this.lastTapTimestamp = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;
  }

  public noteDown(pointerId: number, x: number, y: number) {
    this.downPositions.set(pointerId, { x, y });
  }

  // Own-movement is checked first and unconditionally consumes the recorded
  // down position, so a drag's release — however far it travelled — can never
  // leave stale state behind for the next call to compare against.
  public isDoubleTap(pointerId: number, x: number, y: number): boolean {
    const down = this.downPositions.get(pointerId);
    this.downPositions.delete(pointerId);

    if (!down || Math.hypot(x - down.x, y - down.y) > DOUBLE_TAP_DISTANCE_PX) {
      return false;
    }

    const elapsed = performance.now() - this.lastTapTimestamp;
    const distance = Math.hypot(x - this.lastTapX, y - this.lastTapY);

    if (elapsed <= DOUBLE_TAP_INTERVAL_MS && distance <= DOUBLE_TAP_DISTANCE_PX) {
      // Zeroed rather than left standing: a third tap arriving just after
      // would otherwise read as a second double tap against this one.
      this.lastTapTimestamp = 0;
      return true;
    }

    this.lastTapTimestamp = performance.now();
    this.lastTapX = x;
    this.lastTapY = y;
    return false;
  }
}

export default DoubleTapDetector;
