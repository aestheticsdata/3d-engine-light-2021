// The CAMERA card — and the substance of this card is not its layout, it is
// refusing to print the design's camera.
//
// The mockup derives an orbit camera from the pitch / yaw / zoom sliders
// (design L1377–L1381) and reports POSITION / ROTATION / DISTANCE / NEAR / FAR
// against it. Every premise of that is false here. There is no camera
// transform: Point3D.convert3D2D is a bare perspective divide about a fixed
// focal length. Zoom is not a distance: the slider moves the *object's* z.
// Pitch / yaw / roll are per-frame rotation *rates* offset from the canvas
// centre, not Euler angles. And there are no clip planes at all.
//
// So two rows are relabelled against the design and one suffix is dropped:
//
//   ROTATION  -> SPIN RATE      the row is degrees per frame, and calling a
//                               rate an angle is the lie that invites someone
//                               to "fix" a camera that does not exist
//   NEAR/FAR  -> FOCAL / OFFSET the engine has no clip planes; focal and
//                               z-offset are what define this projection
//   DISTANCE    drops the mock's `m` suffix for `u` — there is no metric
//               scale until de-mock E5a lands world units
//
// The absolute-angle camera rig is de-mock E1. Until then every value here is
// engine-truthful, which is the whole point of the card.
//
// The rates are read off CameraController rather than recomputed from the
// slider values: the controller applies them to the mesh from the same getter,
// so the card cannot print a spin the renderer is not performing.

import type CameraController from "@app/CameraController";
import type FieldWriter from "@ui/FieldWriter";

// Engine units. The design says `m`; this engine has no metric scale.
const DISTANCE_UNIT = "u";
const DEGREES_PER_RADIAN = 180 / Math.PI;

class CameraWidget {
  private readonly fields: FieldWriter;
  private readonly camera: CameraController;
  private readonly fovAspect: string;

  constructor(fields: FieldWriter, camera: CameraController, canvas: HTMLCanvasElement) {
    this.fields = fields;
    this.camera = camera;
    this.fovAspect = this.deriveFovAspect(canvas);
  }

  // FOV and aspect cannot change while the console is open: the canvas is a
  // fixed 1024x640 backing store that BackgroundRenderer, ShapeTransitionMachine
  // and every Point3D capture at construction, and the focal length is a
  // constant. COS-250 (E9b) is what makes this recomputable.
  public seed() {
    this.fields.write("camStatFov", this.fovAspect);
  }

  public render() {
    const distance = this.camera.distance;
    const rates = this.camera.spinRates;

    // The equivalent eye position, and the only honest one: moving the object
    // back by zOffset is the same transform as moving an eye forward, so the
    // camera this projection behaves like sits `focal + zOffset` units down -Z
    // with no x or y component at all.
    this.fields.write("camStatPosition", `0.0 0.0 ${(-distance).toFixed(1)}`);
    this.fields.write(
      "camStatSpin",
      `${rates.pitch.toFixed(2)}°/f ${rates.yaw.toFixed(2)}°/f ${rates.roll.toFixed(2)}°/f`,
    );
    this.fields.write("camStatDistance", `${distance.toFixed(1)} ${DISTANCE_UNIT}`);
    this.fields.write("camStatFocal", `${this.camera.focalLength} / ${this.camera.zoomOffset.toFixed(1)}`);
  }

  // Vertical, and it has to be said which: the same canvas and focal length
  // give 119.3° horizontally. Both numbers come off the element rather than
  // being typed, so a future resize path cannot leave them stale silently.
  private deriveFovAspect(canvas: HTMLCanvasElement): string {
    const fov = 2 * Math.atan(canvas.height / 2 / this.camera.focalLength) * DEGREES_PER_RADIAN;
    const aspect = canvas.width / canvas.height;

    return `${fov.toFixed(1)}° / ${aspect.toFixed(2)}`;
  }
}

export default CameraWidget;
