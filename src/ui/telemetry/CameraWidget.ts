// The CAMERA card — and the substance of this card is not its layout, it is
// refusing to print the design's camera.
//
// The mockup derives an orbit camera from the pitch / yaw / zoom sliders
// (design L1377–L1381) and reports POSITION / ROTATION / DISTANCE / NEAR / FAR
// against it. Every premise of that is false here. There is no camera
// transform: Point3D.convert3D2D is a bare perspective divide about a focal
// length — one the WORLD tab's FOV slider now moves, which is why the FOV row
// is rendered rather than seeded, but still not a camera that goes anywhere.
// Zoom is not a distance either: the slider moves the *object's* z.
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

class CameraWidget {
  private readonly fields: FieldWriter;
  private readonly camera: CameraController;
  // The two halves of the FOV / ASPECT row have different lifetimes now. Aspect
  // really is fixed — the canvas is a 1024x640 backing store that
  // BackgroundRenderer, ShapeTransitionMachine and every Point3D capture at
  // construction, and COS-250 (E9b) is what makes it recomputable. The half-height
  // is kept for the same reason: it is the constant the live FOV is derived
  // against.
  private readonly aspect: string;

  constructor(fields: FieldWriter, camera: CameraController, canvas: HTMLCanvasElement) {
    this.fields = fields;
    this.camera = camera;
    this.aspect = (canvas.width / canvas.height).toFixed(2);
  }

  // Seeded as well as rendered: render() runs on a frame, and this card is
  // written once before the loop starts.
  public seed() {
    this.fields.write("camStatFov", this.fovAspect());
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
    // One decimal, because the focal length stopped being an integer when
    // COS-231 made FOV a control: 94° maps to 298.4, and the raw float would
    // print seventeen digits into a stat row.
    this.fields.write("camStatFocal", `${this.camera.focalLength.toFixed(1)} / ${this.camera.zoomOffset.toFixed(1)}`);
    this.fields.write("camStatFov", this.fovAspect());
  }

  // Vertical, and it has to be said which: the same canvas and focal length give
  // 119.3° horizontally.
  //
  // The angle comes off the controller rather than being re-derived here, for
  // the reason its getter gives: it is the FOV the projection is using, not the
  // one the slider is showing, and the viewport HUD prints the same number.
  private fovAspect(): string {
    return `${this.camera.fieldOfViewDegrees.toFixed(1)}° / ${this.aspect}`;
  }
}

export default CameraWidget;
