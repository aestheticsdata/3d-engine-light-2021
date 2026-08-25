// Pointer, wheel and touch input for the viewport canvas: drag orbit, wheel /
// trackpad zoom, and — via PinchZoomTracker and DoubleTapDetector — two-finger
// pinch and a double-tap reset. E1a built the rig this drives — absolute
// pitch/yaw/roll, a magnification-based zoom and a paused-repaint path — so
// every gesture here is a coordinate conversion into one of three callbacks,
// never new camera maths of its own.
//
// Pointer Events rather than separate mouse/touch listeners, so a mouse drag,
// a pen drag and a one-finger touch drag share one code path. setPointerCapture
// on every pointer down is what keeps a drag tracking once the cursor leaves
// the canvas.
//
// Drag sensitivity is degrees per CSS pixel, not per backing-store pixel: the
// canvas element's own box is what PointerEvent.clientX/Y already measure
// against, and scaling by the render target's resolution would turn the same
// physical drag into a different rotation depending on the canvas's backing
// size. Do not add that conversion here.
//
// Orbit and pinch never run at once — activePointers.size is what decides
// which of the two a move belongs to — but either can hand off to the other
// mid-gesture: a second finger landing during a drag ends the drag and starts
// a pinch, and a finger lifting out of a pinch resumes a drag with whichever
// finger is left. Both handoffs happen in endPointer, re-arming orbit or
// re-baselining the pinch against the pointers that are actually still down,
// rather than the pair a pinch happened to begin with.

import DoubleTapDetector from "@input/DoubleTapDetector";
import PinchZoomTracker from "@input/PinchZoomTracker";

import type { EulerDegrees } from "@camera/CameraRig";

const DRAG_DEGREES_PER_PIXEL = 0.4;
const WHEEL_ZOOM_PER_UNIT = 0.05;
// Firefox reports wheel deltas in lines rather than pixels, and there is no way
// to ask it for the line height it used — 16 is the constant every other
// wheel-normalising library converges on.
const WHEEL_LINE_HEIGHT_PX = 16;
const ZOOM_SLIDER_MIN = 0;
const ZOOM_SLIDER_MAX = 100;

interface PointerPosition {
  x: number;
  y: number;
}

export interface PointerOrbitOptions {
  canvas: HTMLCanvasElement;
  getAngles: () => EulerDegrees;
  getZoom: () => number;
  onOrbit: (pitch: number, yaw: number) => void;
  onZoom: (sliderValue: number) => void;
  onReset: () => void;
}

class PointerOrbit {
  private readonly canvas: HTMLCanvasElement;
  private readonly getAngles: () => EulerDegrees;
  private readonly getZoom: () => number;
  private readonly onOrbit: (pitch: number, yaw: number) => void;
  private readonly onZoom: (sliderValue: number) => void;
  private readonly onReset: () => void;
  // Every pointer currently down on the canvas, keyed by id and kept current
  // on every move — including while pinching, which is what lets orbit resume
  // from a live position rather than a stale one when a pinch ends.
  private readonly activePointers: Map<number, PointerPosition>;
  private readonly pinch: PinchZoomTracker;
  private readonly doubleTap: DoubleTapDetector;
  private orbitPointerId: number | null;
  private orbitLastX: number;
  private orbitLastY: number;
  private orbitPitch: number;
  private orbitYaw: number;
  // Independent per axis: a user flipping vertical drag should not also flip
  // horizontal, and the reverse. Off by default — current drag direction is
  // unchanged until one is switched on.
  private invertPitch: boolean;
  private invertYaw: boolean;

  constructor(options: PointerOrbitOptions) {
    this.canvas = options.canvas;
    this.getAngles = options.getAngles;
    this.getZoom = options.getZoom;
    this.onOrbit = options.onOrbit;
    this.onZoom = options.onZoom;
    this.onReset = options.onReset;
    this.activePointers = new Map();
    this.pinch = new PinchZoomTracker(options.getZoom);
    this.doubleTap = new DoubleTapDetector();
    this.orbitPointerId = null;
    this.orbitLastX = 0;
    this.orbitLastY = 0;
    this.orbitPitch = 0;
    this.orbitYaw = 0;
    this.invertPitch = false;
    this.invertYaw = false;

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    // Non-passive: preventDefault is what stops the page scrolling under the
    // cursor, and stops macOS trackpad pinch — which arrives as a wheel event
    // with ctrlKey true — from page-zooming instead of moving the slider.
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  public setInvertPitch(invert: boolean) {
    this.invertPitch = invert;
  }

  public setInvertYaw(invert: boolean) {
    this.invertYaw = invert;
  }

  private beginOrbit(pointerId: number, x: number, y: number) {
    this.orbitPointerId = pointerId;
    this.orbitLastX = x;
    this.orbitLastY = y;

    const angles = this.getAngles();
    this.orbitPitch = angles.pitch;
    this.orbitYaw = angles.yaw;
  }

  private continueOrbit(event: PointerEvent) {
    const dx = event.clientX - this.orbitLastX;
    const dy = event.clientY - this.orbitLastY;

    this.orbitLastX = event.clientX;
    this.orbitLastY = event.clientY;
    // Subtracted, not added: Matrix3D's yaw sends the front-facing vertex
    // (0, 0, -r) to (-r·sinθ, …), so a positive yaw swings the face the user is
    // grabbing to the *left*. The cursor has to subtract for the shape to
    // follow the drag rather than run away from it.
    this.orbitYaw -= dx * DRAG_DEGREES_PER_PIXEL * (this.invertYaw ? -1 : 1);
    // Unclamped, and deliberately so on both axes now. The rig used to stop
    // pitch at ±89 and this total was left running against that clamp; it no
    // longer clamps at all, because a drag that hits a wall after 178° while
    // yaw spins freely is the one gesture in the console that cannot be
    // repeated indefinitely. The PITCH row still saturates at its own ±89 —
    // a range input has to be bounded — while the camera carries on past it.
    this.orbitPitch -= dy * DRAG_DEGREES_PER_PIXEL * (this.invertPitch ? -1 : 1);

    this.onOrbit(this.orbitPitch, this.orbitYaw);
  }

  // Reads the live pair from activePointers rather than taking one, so the
  // same call re-baselines correctly whether it is starting a fresh pinch or
  // recovering from a third finger lifting out of one.
  private beginPinch() {
    const [a, b] = [...this.activePointers.values()];

    this.pinch.begin(a, b);
  }

  private clampZoom(value: number): number {
    return Math.min(ZOOM_SLIDER_MAX, Math.max(ZOOM_SLIDER_MIN, value));
  }

  private normalizeWheelDelta(event: WheelEvent): number {
    return event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE_HEIGHT_PX : event.deltaY;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (event.pointerType === "touch") {
      this.doubleTap.noteDown(event.pointerId, event.clientX, event.clientY);
    }

    if (this.activePointers.size === 1) {
      this.beginOrbit(event.pointerId, event.clientX, event.clientY);
      return;
    }

    if (this.activePointers.size === 2) {
      // A second finger landing hands orbit off to pinch outright — the two
      // gestures never run at once.
      this.orbitPointerId = null;
      this.beginPinch();
    }

    // A third finger and beyond changes nothing: it is tracked so its own
    // pointerup does not desync the map, but pinch keeps reading whichever two
    // pointers are current until the count drops back to two.
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      this.onZoom(this.clampZoom(this.pinch.update(a, b)));
      return;
    }

    if (event.pointerId !== this.orbitPointerId) {
      return;
    }

    this.continueOrbit(event);
  };

  private onPointerUp = (event: PointerEvent) => {
    this.endPointer(event);

    if (event.pointerType === "touch" && this.doubleTap.isDoubleTap(event.pointerId, event.clientX, event.clientY)) {
      this.onReset();
    }
  };

  private onPointerCancel = (event: PointerEvent) => {
    this.endPointer(event);
  };

  private endPointer(event: PointerEvent) {
    this.activePointers.delete(event.pointerId);

    if (event.pointerId === this.orbitPointerId) {
      this.orbitPointerId = null;
    }

    if (this.activePointers.size === 1) {
      const [[remainingId, position]] = this.activePointers.entries();
      this.beginOrbit(remainingId, position.x, position.y);
      return;
    }

    if (this.activePointers.size === 2) {
      // A pinch pointer or a third finger just left a three-finger hold: the
      // remaining pair needs a fresh baseline, since it may not be the pair
      // the pinch actually began with.
      this.beginPinch();
    }
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();

    const deltaY = this.normalizeWheelDelta(event);
    const next = this.getZoom() - deltaY * WHEEL_ZOOM_PER_UNIT;

    this.onZoom(this.clampZoom(next));
  };
}

export default PointerOrbit;
