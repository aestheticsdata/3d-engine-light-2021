// The CAMERA card.
//
// The mockup derives an orbit camera from the pitch / yaw / zoom sliders (design
// L1377-L1381) and reports POSITION / ROTATION / DISTANCE / NEAR / FAR against
// it. Every one of those rows is now real. CameraRig gives the scene an absolute
// orientation and derives the eye position from the very matrix the frame is
// drawn with; the camera record carries a view volume, so the NEAR / FAR row has
// reverted from the FOCAL / OFFSET relabel it wore while there were no clip
// planes to print.
//
// One departure from the design survives, because its premise is still false:
// DISTANCE drops the mock's `m` suffix for `u`, since there is no metric scale
// until de-mock E5a lands world units.
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
}

class CameraWidget {
  private readonly fields: FieldWriter;
  private readonly camera: CameraController;
  private readonly rig: CameraRig;

  constructor(options: CameraWidgetOptions) {
    this.fields = options.fields;
    this.camera = options.camera;
    this.rig = options.rig;
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
    this.fields.write("camStatRotation", eulerDegreesLabel(this.rig.angles()));
    this.fields.write("camStatDistance", `${distance.toFixed(1)} ${DISTANCE_UNIT}`);
    // Written every render even though neither plane moves: they are constants
    // of the camera, not of the frame, and a row seeded once is a row that has
    // to be re-seeded by hand the day either becomes a control.
    this.fields.write("camStatClip", `${this.camera.near} / ${this.camera.far}`);
    this.fields.write("camStatFov", this.fovAspect());
  }

  // Vertical, and it has to be said which: the same canvas and focal length give
  // 119.3° horizontally.
  //
  // Both halves come off the controller rather than being re-derived here. The
  // angle for the reason its getter gives — it is the FOV the projection is
  // using, not the one the slider is showing, and the viewport HUD prints the
  // same number. The aspect because the controller is where the render target's
  // dimensions are read, and a second reading here is a second thing to
  // remember when E9b makes them move.
  private fovAspect(): string {
    return `${this.camera.fieldOfViewDegrees.toFixed(1)}° / ${this.camera.aspect.toFixed(2)}`;
  }
}

export default CameraWidget;
