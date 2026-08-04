// The camera's projection: the two policies that map a slider position onto it —
// zoom to a z offset, and field of view to a focal length — and the numbers
// those two produce.
//
// Neither curve is a generic helper. The first encodes this camera's reach —
// 260 at the far end to -220 at the near end — and the second encodes the
// canvas half-height, which is what makes degrees convertible to a focal length
// at all. Both belong to the object whose projection they are, not to module
// scope beside a rasteriser.
//
// Where the camera is *pointing* is not here. That is CameraRig, which owns the
// scene's absolute orientation and derives the eye position from the same
// matrix the frame is drawn with; this class owns only how far away the eye is
// and how wide it sees.

import type Mesh from "@primitives/Mesh";

const ZOOM_SLIDER_MIN = 0;
const ZOOM_SLIDER_MAX = 100;
const ZOOM_ZOFFSET_FAR = 260;
const ZOOM_ZOFFSET_NEAR = -220;

// `scale` in Point3D.convert3D2D is `fl / (fl + z + zOffset)`, which flips sign
// when the denominator crosses zero — and that already happens today at maximum
// zoom for the largest meshes (focal 300, zOffset -220, z -173 gives -93). A
// shorter focal only makes it easier to reach, so the applied focal stops here.
// FOV values above roughly 102° are therefore clamped, and stay clamped until
// de-mock E2 brings a real near plane to clip against instead.
const MIN_FOCAL_LENGTH = 260;
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
  // The opposite side of the triangle the FOV mapping solves. The canvas is read
  // for it once here rather than held, so nothing in this class can start
  // depending on a live canvas dimension E9b is going to move.
  private readonly halfHeight: number;
  private focal: number;
  private zOffset: number;

  constructor(canvas: HTMLCanvasElement) {
    this.halfHeight = canvas.height / 2;
    // Seeded through the same mapping the slider drives rather than from a
    // second focal-length constant: one derivation means the opening frame and
    // the first drag cannot disagree about what 94° means.
    this.focal = this.focalFor(DEFAULT_FOV);
    this.zOffset = this.zoomOffsetFor(DEFAULT_ZOOM_SLIDER_VALUE);
  }

  // What the HUD prints, and it is the distance rather than the raw offset: the
  // offset alone runs 260 -> -220 across the slider and would print a negative
  // distance. Focal plus offset stays positive at every combination the two
  // controls can reach, and that is now a property of the clamp rather than of a
  // fixed focal: MIN_FOCAL_LENGTH is 260 and the largest negative offset is
  // -220, so the sum bottoms out at 40 and rises from there.
  public get distance(): number {
    return this.focal + this.zOffset;
  }

  // The field of view the projection is actually using, which is not always the
  // one the slider is showing — past roughly 102° the clamp holds the focal at
  // 260 and this stops climbing. Every readout of the FOV goes through here, so
  // the HUD chip and the CAMERA card cannot print two different numbers for one
  // camera.
  public get fieldOfViewDegrees(): number {
    return 2 * Math.atan(this.halfHeight / this.focal) * DEGREES_PER_RADIAN;
  }

  // The two numbers that actually define this projection, for the CAMERA card's
  // FOCAL / OFFSET row. There are no clip planes to report instead.
  public get focalLength(): number {
    return this.focal;
  }

  public get zoomOffset(): number {
    return this.zOffset;
  }

  public applyTo(mesh: Mesh) {
    mesh.changeFocal(this.focal);
    mesh.changeOffsetZ(this.zOffset);
  }

  // Both setters below take `number | null` because their only other caller
  // reads a slider through Controls.getNumericValue, which returns null for a
  // missing control. Absorbing that here is what replaces the `?? this.zOffset`
  // fallback the call site used to spell out, and it is why the controller needs
  // no getters for these two.
  public setZoomFromSlider(sliderValue: number | null) {
    if (sliderValue === null) {
      return;
    }

    this.zOffset = this.zoomOffsetFor(sliderValue);
  }

  public setFovDegrees(fovDegrees: number | null) {
    if (fovDegrees === null) {
      return;
    }

    this.focal = this.focalFor(fovDegrees);
  }

  // The engine has a focal length, not a field of view, so the two are related
  // exactly by the half-height and are converted here rather than approximated
  // by a table.
  //
  // There is no dolly compensation: a shorter focal magnifies the subject as
  // well as widening the frame, so this control behaves like a second zoom
  // rather than a true FOV. De-mock E2 owns compensating zOffset to keep the
  // subject framed; until then the coupling is real and visible.
  private focalFor(fovDegrees: number): number {
    const halfAngle = (fovDegrees * Math.PI) / 180 / 2;

    return Math.max(MIN_FOCAL_LENGTH, this.halfHeight / Math.tan(halfAngle));
  }

  // Written as one interpolation rather than through a shared `lerp`: the two
  // other copies in the repo are module-private to their own files, and adding a
  // third here to save one expression is how a fourth appears next.
  private zoomOffsetFor(sliderValue: number): number {
    const raw = (sliderValue - ZOOM_SLIDER_MIN) / (ZOOM_SLIDER_MAX - ZOOM_SLIDER_MIN);
    const progress = Math.min(1, Math.max(0, raw));

    return ZOOM_ZOFFSET_FAR + (ZOOM_ZOFFSET_NEAR - ZOOM_ZOFFSET_FAR) * progress;
  }
}

export default CameraController;
