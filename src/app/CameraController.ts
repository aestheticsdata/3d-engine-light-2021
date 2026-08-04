// The camera: where it sits, how fast the shape turns under it, and the two
// policies that map a slider position onto the projection — zoom to a z offset,
// and field of view to a focal length.
//
// Neither curve is a generic helper. The first encodes this camera's reach —
// 260 at the far end to -220 at the near end — and the second encodes the fact
// that the canvas is a fixed 1024x640, which is what makes degrees convertible
// to a focal length at all. Both belong to the object whose projection they are,
// not to module scope beside a rasteriser.

import Matrix3D from "@primitives/Matrix3D";

import type Mesh from "@primitives/Mesh";

const PITCH_YAW_ROTATION_DIVISOR = 110;
const ROLL_ROTATION_DIVISOR = 500;
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
export const DEFAULT_PITCH = 400;
export const DEFAULT_YAW = 400;
export const DEFAULT_ROLL = 200;
export const DEFAULT_ROTATION_SPEED = 200;
export const ROTATION_SPEED_SLIDER_MAX = 2000;

// Degrees per frame, not radians and not absolute angles. Matrix3D.setAngle
// converts degrees internally, so these are the numbers the renderer actually
// applies each frame — which is why the CAMERA card reads them from here
// rather than re-deriving them from the sliders.
export interface SpinRates {
  pitch: number;
  yaw: number;
  roll: number;
}

class CameraController {
  private readonly matrix3D: Matrix3D;
  private readonly centerX: number;
  private readonly centerY: number;
  // Numerically the same as centerY, and deliberately not that field: centerY is
  // where pitch is measured from, this is the opposite side of the triangle the
  // FOV mapping solves. They are separate so de-mock E1's absolute camera can
  // move the rotation origin without silently widening the field of view.
  private readonly halfHeight: number;
  private focal: number;
  private zOffset: number;
  private pitch: number;
  private yaw: number;
  private roll: number;
  private rotationSpeed: number;

  constructor(canvas: HTMLCanvasElement) {
    this.matrix3D = new Matrix3D();
    // Pitch and yaw are measured as an offset from the canvas centre, which is
    // why the controller needs the dimensions rather than the canvas itself.
    this.centerX = canvas.width >> 1;
    this.centerY = canvas.height >> 1;
    this.halfHeight = canvas.height / 2;
    // Seeded through the same mapping the slider drives rather than from a
    // second focal-length constant: one derivation means the opening frame and
    // the first drag cannot disagree about what 94° means.
    this.focal = this.focalFor(DEFAULT_FOV);
    this.zOffset = this.zoomOffsetFor(DEFAULT_ZOOM_SLIDER_VALUE);
    this.pitch = DEFAULT_PITCH;
    this.yaw = DEFAULT_YAW;
    this.roll = DEFAULT_ROLL;
    this.rotationSpeed = DEFAULT_ROTATION_SPEED;
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

  // Read by the CAMERA card, and by rotate() below — one derivation, so the
  // card cannot print a rate the renderer is not applying. Zero at the canvas
  // centre for pitch and yaw, and at 0 for roll.
  public get spinRates(): SpinRates {
    const speedFactor = this.rotationSpeed / 100;

    return {
      pitch: ((this.pitch - this.centerY) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor,
      yaw: (-(this.yaw - this.centerX) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor,
      roll: (this.roll / ROLL_ROTATION_DIVISOR) * speedFactor,
    };
  }

  public applyTo(mesh: Mesh) {
    mesh.changeFocal(this.focal);
    mesh.changeOffsetZ(this.zOffset);
  }

  public rotate(mesh: Mesh) {
    const rates = this.spinRates;

    this.matrix3D.setAngle(rates.pitch);
    mesh.transformMesh(this.matrix3D.pitch);

    this.matrix3D.setAngle(rates.yaw);
    mesh.transformMesh(this.matrix3D.yaw);

    this.matrix3D.setAngle(rates.roll);
    mesh.transformMesh(this.matrix3D.roll);
  }

  // The four setters below take `number | null` because their only other caller
  // reads a slider through Controls.getNumericValue, which returns null for a
  // missing control. Absorbing that here is what replaces the `?? this.pitch`
  // fallback the call site used to spell out, and it is why the controller needs
  // no getters for these four.
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

  public setPitch(pitch: number | null) {
    if (pitch === null) {
      return;
    }

    this.pitch = pitch;
  }

  public setYaw(yaw: number | null) {
    if (yaw === null) {
      return;
    }

    this.yaw = yaw;
  }

  public setRoll(roll: number | null) {
    if (roll === null) {
      return;
    }

    this.roll = roll;
  }

  public setRotationSpeed(rotationSpeed: number | null) {
    if (rotationSpeed === null) {
      return;
    }

    this.rotationSpeed = rotationSpeed;
  }

  // The engine has a focal length, not a field of view, and the canvas is a
  // fixed 1024x640 — so the two are related exactly by the half-height and are
  // converted here rather than approximated by a table.
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
