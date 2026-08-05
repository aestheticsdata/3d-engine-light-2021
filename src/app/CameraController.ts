// The camera's policy: the three mappings that turn a console control into
// projection state — field of view to a focal length, zoom to a magnification,
// and a chip to a projection mode — and the readouts those produce.
//
// The projection itself is Camera, which every vertex holds; this class owns
// what the renderer must not know about. Sliders, degrees and the canvas
// half-height are console concerns, and a primitive that knew about them could
// not be built in the node test environment.
//
// Neither curve is a generic helper. The first encodes the canvas half-height,
// which is what makes degrees convertible to a focal length at all; the second
// encodes this camera's reach — 260 at the far end to -220 at the near end.
//
// Where the camera is *pointing* is not here either. That is CameraRig, which
// owns the scene's absolute orientation and derives the eye position from the
// same matrix the frame is drawn with; this class owns only how far away the eye
// is and how wide it sees.

import Camera from "@primitives/Camera";

import type { ProjectionMode } from "@primitives/Camera";

const ZOOM_SLIDER_MIN = 0;
const ZOOM_SLIDER_MAX = 100;
const ZOOM_ZOFFSET_FAR = 260;
const ZOOM_ZOFFSET_NEAR = -220;

// The focal length the zoom curve was authored against, and the reason the whole
// slider range still projects exactly as it did before the magnification
// existed. The curve below stays the definition of the push-back AT THIS FOCAL,
// and k is read off it:
//
//     k(v) = FL_REF / (FL_REF + zoomOffsetFor(v))
//
// which at fl = FL_REF collapses the new expression back into the old one:
//
//     k·fl / (fl + k·z) = 300/(300+zo) · 300 / (300 + 300z/(300+zo))
//                       = 300 / (300 + zo + z)
//
// the exact divide `fl / (fl + zOffset + z)` this replaced. Change FL_REF and
// every zoom position moves; it is a reference, not a default.
const REFERENCE_FOCAL_LENGTH = 300;
const DEGREES_PER_RADIAN = 180 / Math.PI;

// The defaults the toolbar's RESET path and the first paint both need, so they
// are exported rather than duplicated as literals at the call site.
export const DEFAULT_ZOOM_SLIDER_VALUE = 50;

// The console ran at a fixed focal length of 300 before FOV became a control,
// and 94 is the nearest integer step to the field of view that reproduces it:
// 2 · atan(320 / 300) ≈ 93.7°, which the integer-stepped slider cannot express.
// 94 yields focal 298.4, so the first frame is about 0.5% larger in projected
// scale than it used to be. Accepted rather than hidden — the alternative is a
// fractional default nobody can dial back to.
export const DEFAULT_FOV = 94;

class CameraController {
  // The opposite side of the triangle the FOV mapping solves, and the aspect the
  // CAMERA card prints. The canvas is read for both once here rather than held,
  // so nothing in this class can start depending on a live canvas dimension E9b
  // is going to move — and when it does, this constructor is the single call
  // site that has to start following it.
  private readonly halfHeight: number;
  private readonly aspectRatio: number;
  private readonly camera: Camera;

  constructor(canvas: HTMLCanvasElement) {
    this.halfHeight = canvas.height / 2;
    this.aspectRatio = canvas.width / canvas.height;
    // Seeded through the same two mappings the sliders drive rather than from a
    // second pair of constants: one derivation means the opening frame and the
    // first drag cannot disagree about what 94° and 50% mean.
    this.camera = new Camera({
      focal: this.focalFor(DEFAULT_FOV),
      magnification: this.magnificationFor(DEFAULT_ZOOM_SLIDER_VALUE),
    });
  }

  // What every mesh is built under. Handed out rather than copied from, because
  // the point of the record is that the meshes see this class's writes without
  // anyone pushing them through.
  public get projection(): Camera {
    return this.camera;
  }

  // Eye distance, and it is fl/k rather than the focal plus a push-back — one
  // derivation now that the offset is gone. Positive at every reachable
  // combination, since the zoom curve bottoms out at -220 against a reference
  // focal of 300 and the magnification therefore never reaches zero.
  public get distance(): number {
    return this.camera.distance;
  }

  // The vertical field of view — the same canvas and focal length give 119.3°
  // horizontally, so it is always worth saying which.
  //
  // It comes off the applied focal rather than off the slider, which used to
  // matter because the focal was clamped and the two could part company. The
  // near plane removed the clamp, so today they agree at every position; the
  // derivation stays this way round because the readouts describe the
  // projection, not the control.
  public get fieldOfViewDegrees(): number {
    return 2 * Math.atan(this.halfHeight / this.camera.focalLength) * DEGREES_PER_RADIAN;
  }

  public get aspect(): number {
    return this.aspectRatio;
  }

  public get near(): number {
    return this.camera.near;
  }

  public get far(): number {
    return this.camera.far;
  }

  public get projectionMode(): ProjectionMode {
    return this.camera.mode;
  }

  // The three setters below take `number | null` because their only other caller
  // reads a slider through Controls.getNumericValue, which returns null for a
  // missing control. Absorbing that here is what replaces the `?? this.zOffset`
  // fallback the call site used to spell out.
  public setZoomFromSlider(sliderValue: number | null) {
    if (sliderValue === null) {
      return;
    }

    this.camera.setMagnification(this.magnificationFor(sliderValue));
  }

  // Only the focal moves. The magnification is left exactly where the zoom
  // slider put it, and that is the whole of the dolly compensation: holding k
  // holds the subject's size at its own centre plane while the perspective
  // falloff around it opens or flattens. The push-back this used to need
  // recomputing — zOffset = fl·(1−k)/k — is not stored anywhere any more.
  public setFovDegrees(fovDegrees: number | null) {
    if (fovDegrees === null) {
      return;
    }

    this.camera.setFocal(this.focalFor(fovDegrees));
  }

  public setProjection(mode: ProjectionMode) {
    this.camera.setMode(mode);
  }

  // The engine has a focal length, not a field of view, so the two are related
  // exactly by the half-height and are converted here rather than approximated
  // by a table. Unclamped: the focal used to stop at 260 because a shorter one
  // pushed the near cap of a large mesh behind the eye, where it projected
  // mirrored. Camera's near plane clips it away instead, which is what makes the
  // slider's whole 15..120 range usable.
  private focalFor(fovDegrees: number): number {
    const halfAngle = (fovDegrees * Math.PI) / 180 / 2;

    return this.halfHeight / Math.tan(halfAngle);
  }

  // Written as one interpolation rather than through a shared `lerp`: the two
  // other copies in the repo are module-private to their own files, and adding a
  // third here to save one expression is how a fourth appears next.
  private magnificationFor(sliderValue: number): number {
    const raw = (sliderValue - ZOOM_SLIDER_MIN) / (ZOOM_SLIDER_MAX - ZOOM_SLIDER_MIN);
    const progress = Math.min(1, Math.max(0, raw));
    const zoomOffset = ZOOM_ZOFFSET_FAR + (ZOOM_ZOFFSET_NEAR - ZOOM_ZOFFSET_FAR) * progress;

    return REFERENCE_FOCAL_LENGTH / (REFERENCE_FOCAL_LENGTH + zoomOffset);
  }
}

export default CameraController;
