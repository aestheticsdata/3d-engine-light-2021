// The CAMERA card.
//
// The mockup derives an orbit camera from the pitch / yaw / zoom sliders (design
// L1377-L1381) and reports POSITION / ROTATION / DISTANCE / NEAR / FAR against
// it. Two of those premises were false when this card was built and are true
// now: CameraRig gives the scene an absolute orientation and derives the eye
// position from the very matrix the frame is drawn with, so POSITION is exact
// and ROTATION has reverted from the SPIN RATE relabel to real Euler degrees.
//
// Two departures from the design survive, because their premises are still
// false:
//
//   NEAR/FAR  -> FOCAL / OFFSET the engine has no clip planes; focal and
//                               z-offset are what define this projection, until
//                               de-mock E2 brings real ones
//   DISTANCE    drops the mock's `m` suffix for `u` — there is no metric
//               scale until de-mock E5a lands world units
//
// Every value is read off the rig or the controller rather than recomputed from
// the sliders, and the two strings the viewport HUD also prints go through the
// same formatter it uses. The card cannot describe a camera the renderer does
// not have.

import { eulerDegreesLabel, vector3Label } from "@ui/cameraLabels";

import type CameraController from "@app/CameraController";
import type CameraRig from "@camera/CameraRig";
import type FieldWriter from "@ui/FieldWriter";

// Engine units. The design says `m`; this engine has no metric scale.
const DISTANCE_UNIT = "u";

export interface CameraWidgetOptions {
  fields: FieldWriter;
  camera: CameraController;
  rig: CameraRig;
  canvas: HTMLCanvasElement;
}

class CameraWidget {
  private readonly fields: FieldWriter;
  private readonly camera: CameraController;
  private readonly rig: CameraRig;
  // Aspect really is fixed — the canvas is a 1024x640 backing store that
  // BackgroundRenderer, ShapeTransitionMachine and every Point3D capture at
  // construction, and COS-250 (E9b) is what makes it recomputable.
  private readonly aspect: string;

  constructor(options: CameraWidgetOptions) {
    this.fields = options.fields;
    this.camera = options.camera;
    this.rig = options.rig;
    this.aspect = (options.canvas.width / options.canvas.height).toFixed(2);
  }

  // Seeded as well as rendered: render() runs on a frame, and this card is
  // written once before the loop starts.
  public seed() {
    this.fields.write("camStatFov", this.fovAspect());
  }

  public render() {
    const distance = this.camera.distance;

    // The eye distance comes from the controller because the controller owns the
    // focal length and the zoom curve. The rig turns that scalar into a position
    // using the frame's own rotation, so POSITION and the HUD's cam.pos are one
    // derivation read twice rather than two that have to agree.
    this.fields.write("camStatPosition", vector3Label(this.rig.eyePosition(distance)));
    this.fields.write("camStatRotation", eulerDegreesLabel(this.rig.eulerDegrees()));
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
