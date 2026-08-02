// The camera: where it sits, how fast the shape turns under it, and the policy
// that maps a slider position to a z offset.
//
// The zoom curve is not a generic helper. It encodes this camera's reach —
// 260 at the far end to -220 at the near end — and belongs to the object whose
// reach it is, not to module scope beside a rasteriser.

import Matrix3D from "@primitives/Matrix3D";

import type Mesh from "@primitives/Mesh";

const PITCH_YAW_ROTATION_DIVISOR = 110;
const ROLL_ROTATION_DIVISOR = 500;
const DEFAULT_FOCAL_LENGTH = 300;
const ZOOM_SLIDER_MIN = 0;
const ZOOM_SLIDER_MAX = 100;
const ZOOM_ZOFFSET_FAR = 260;
const ZOOM_ZOFFSET_NEAR = -220;

// The defaults the toolbar's RESET path and the first paint both need, so they
// are exported rather than duplicated as literals at the call site.
export const DEFAULT_ZOOM_SLIDER_VALUE = 50;
export const DEFAULT_PITCH = 400;
export const DEFAULT_YAW = 400;
export const DEFAULT_ROLL = 200;
export const DEFAULT_ROTATION_SPEED = 200;
export const ROTATION_SPEED_SLIDER_MAX = 2000;

class CameraController {
  private readonly matrix3D: Matrix3D;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly focal: number;
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
    this.focal = DEFAULT_FOCAL_LENGTH;
    this.zOffset = this.zoomOffsetFor(DEFAULT_ZOOM_SLIDER_VALUE);
    this.pitch = DEFAULT_PITCH;
    this.yaw = DEFAULT_YAW;
    this.roll = DEFAULT_ROLL;
    this.rotationSpeed = DEFAULT_ROTATION_SPEED;
  }

  // What the HUD prints, and it is the distance rather than the raw offset: the
  // offset alone runs 260 -> -220 across the slider and would print a negative
  // distance. Focal plus offset stays positive throughout (560 -> 80).
  public get distance(): number {
    return this.focal + this.zOffset;
  }

  public applyTo(mesh: Mesh) {
    mesh.changeFocal(this.focal);
    mesh.changeOffsetZ(this.zOffset);
  }

  public rotate(mesh: Mesh) {
    const speedFactor = this.rotationSpeed / 100;

    this.matrix3D.setAngle(((this.pitch - this.centerY) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor);
    mesh.transformMesh(this.matrix3D.pitch);

    this.matrix3D.setAngle((-(this.yaw - this.centerX) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor);
    mesh.transformMesh(this.matrix3D.yaw);

    this.matrix3D.setAngle((this.roll / ROLL_ROTATION_DIVISOR) * speedFactor);
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
