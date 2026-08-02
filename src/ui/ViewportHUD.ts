// The viewport HUD's writers, and the home of its placeholder constants.
//
// Like the status bar, this widget owns no state. Most of what the HUD shows is
// already published by someone else through the FieldWriter — the shading mode,
// the texture label, the selected id, the run state, the drawn-triangle count
// and the frame time all reach the overlay because write() touches *every*
// [data-field] node, and the HUD's nodes carry the same names as the status bar
// and the telemetry cards. That is deliberate: the viewport cannot print a
// different triangle count from the geometry card, because there is only one
// write.
//
// What is left over, and therefore what this class owns:
//   * the placeholder constants, each annotated with the de-mock ticket that
//     replaces it,
//   * the resolution string, read off the canvas rather than typed,
//   * the data-shading-mode attribute on the viewport card,
//   * zoom and dist, the two live camera readouts the engine can actually feed.
//
// There is deliberately no per-frame update() method, and becoming a class must
// not tempt anyone into adding one. Everything the HUD shows per frame is
// already written by Main's own writes, and a second pass over the same nodes
// would be work that changes nothing.

import { modeLabel } from "@ui/modeLabel";

import type FieldWriter from "@ui/FieldWriter";

// Placeholders. Each is a constant, never derived from engine state — a value
// computed from the wrong source is worse than an obvious mock, because it
// looks live.

// de-mock E1a (COS-237): the engine rotates the mesh and has no camera
// transform, so there is no position to read.
const CAM_POS = "0.0 1.2 12.0";

// de-mock E1a (COS-237): pitch / yaw / roll are rotation *rates* offset from the
// canvas centre, not camera Euler angles (D9 keeps those semantics). The design
// draws degrees, so the mock does too — but it must stay a constant. Deriving it
// from the sliders would print a rate and label it an angle.
const CAM_ROT = "0.0° 0.0° 0.0°";

// de-mock E1a (COS-237): hardcoded in the design as well.
const CAM_TARGET = "0.0 1.2 0.0";

// de-mock E2 (COS-236): fixed focal length, no FOV control.
const FOV = "60°";

// Unit is `u`, not the design's `m`: the engine has no metric scale, and
// COS-246 (E5a) is what introduces world units.
const DISTANCE_UNIT = "u";

class ViewportHUD {
  private readonly card: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly fields: FieldWriter;

  constructor(canvas: HTMLCanvasElement, fields: FieldWriter) {
    const card = canvas.closest<HTMLElement>(".viewport");

    if (!card) {
      throw new Error("Viewport card not found.");
    }

    this.card = card;
    this.canvas = canvas;
    this.fields = fields;
  }

  // The backing store, not the CSS box. The design's 848 x 530 is the size of
  // the stage at its own 1440 frame; what the rasteriser works at is the canvas
  // buffer, and that is the number worth showing.
  public seed() {
    this.fields.write("resolution", `${this.canvas.width} × ${this.canvas.height}`);
    this.fields.write("camPos", CAM_POS);
    this.fields.write("camRot", CAM_ROT);
    this.fields.write("camTarget", CAM_TARGET);
    this.fields.write("fov", FOV);
  }

  // Owns the attribute only. The chip's text is the same modeLabel() the status
  // bar pushes through the writer, so the two cannot drift — there is one
  // derivation and one write.
  public setMode(wireframeEnabled: boolean) {
    this.card.setAttribute("data-shading-mode", modeLabel(wireframeEnabled).toLowerCase());
  }

  // The distance is passed in rather than recomputed: Main owns the focal
  // length and the zoom curve, and a second copy of that arithmetic here is
  // how the readout ends up disagreeing with the camera.
  public setZoom(sliderValue: number, distance: number) {
    this.fields.write("zoom", `${Math.round(sliderValue)}%`);
    this.fields.write("camDist", `${Math.round(distance)} ${DISTANCE_UNIT}`);
  }
}

export default ViewportHUD;
