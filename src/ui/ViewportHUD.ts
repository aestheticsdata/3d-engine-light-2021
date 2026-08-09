// The viewport HUD's writers.
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
//   * the resolution string, read off the canvas rather than typed,
//   * fov, zoom and dist, and the camera readouts the rig feeds,
//   * the axis gizmo.
//
// A data-shading-mode attribute on the viewport card used to be on that list. It
// drove no CSS and was kept as the seam de-mock E3 would key real shading off —
// E3c (COS-243) is that ticket, and it turned out to need nothing of the kind:
// the six modes are branches in the rasteriser, not selectors, so the attribute
// went rather than finally acquiring a reader.
//
// The projection chip is not on that list and belongs on the first one: it is a
// `projection` field the status bar publishes, so the overlay and the bar cannot
// print two different projections for the same camera.
//
// Everything numeric here is handed in rather than derived: the camera owns the
// projection arithmetic and the rig owns the orientation, so the overlay cannot
// print a camera the renderer is not using.
//
// Two update rates, and the split is deliberate. setCamera rides Main's existing
// 90ms display gate, because four decimal readouts changing sixty times a second
// are unreadable. setGizmo runs every frame: it is a picture rather than a
// number, and once E1b makes the viewport draggable it has to track the drag
// without a tenth of a second of lag.

import { eulerDegreesLabel, vector3Label } from "@ui/cameraLabels";
import DOMScope from "@ui/DOMScope";

import type { AxisScreenDirection, EulerDegrees, Vector3 } from "@camera/CameraRig";
import type FieldWriter from "@ui/FieldWriter";

// Unit is `u`, not the design's `m`: the engine has no metric scale, and
// COS-246 (E5a) is what introduces world units.
const DISTANCE_UNIT = "u";

// The gizmo's three bars, in the order CameraRig hands out its axis columns.
// viewport.css reads --axis-<key>-angle and --axis-<key>-foreshorten, so this
// list is the contract between the two files.
const AXIS_KEYS = ["x", "y", "z"];

class ViewportHUD {
  private readonly canvas: HTMLCanvasElement;
  private readonly fields: FieldWriter;
  private readonly gizmo: HTMLElement;

  constructor(canvas: HTMLCanvasElement, fields: FieldWriter) {
    const card = canvas.closest<HTMLElement>(".viewport");

    if (!card) {
      throw new Error("Viewport card not found.");
    }

    this.canvas = canvas;
    this.fields = fields;
    this.gizmo = new DOMScope(card).require<HTMLElement>(".viewport-hud__gizmo", "Viewport gizmo is missing.");
  }

  // The backing store, not the CSS box. The design's 848 x 530 is the size of
  // the stage at its own 1440 frame; what the rasteriser works at is the canvas
  // buffer, and that is the number worth showing.
  public seed() {
    this.setResolution(this.canvas.width, this.canvas.height);
  }

  // Main's resize path calls this directly (E9b/COS-250) rather than re-seeding
  // from the canvas: the write has to land in the same call that already
  // resized the backing store, not on whatever cadence a render happens to run.
  public setResolution(width: number, height: number) {
    this.fields.write("resolution", `${width} × ${height}`);
  }

  // FOV left the placeholder list in COS-231. It used to be seeded above as a
  // constant "60°" annotated "fixed focal length, no FOV control" — true until
  // the WORLD tab made the focal length a slider, and a lie the moment it did.
  //
  // The angle is passed in rather than read off the slider, for the same reason
  // distance is: it is the field of view the projection is using, derived from
  // the applied focal length. The CAMERA card prints this same number, and two
  // readouts of one camera disagreeing is exactly the kind of lie this rebuild
  // exists to remove. The two used to part company above roughly 102°, where the
  // focal was clamped; the camera's near plane removed the clamp and they now
  // agree at every slider position.
  public setFov(degrees: number) {
    this.fields.write("fov", `${Math.round(degrees)}°`);
  }

  // The distance is passed in rather than recomputed: Main owns the focal
  // length and the zoom curve, and a second copy of that arithmetic here is
  // how the readout ends up disagreeing with the camera.
  public setZoom(sliderValue: number, distance: number) {
    this.fields.write("zoom", `${Math.round(sliderValue)}%`);
    this.fields.write("camDist", `${Math.round(distance)} ${DISTANCE_UNIT}`);
  }

  public setCamera(position: Vector3, rotation: EulerDegrees, target: Readonly<Vector3>) {
    this.fields.write("camPos", vector3Label(position));
    this.fields.write("camRot", eulerDegreesLabel(rotation));
    this.fields.write("camTarget", vector3Label(target));
  }

  // Custom properties rather than a computed `transform` string, and that is
  // what keeps the layout in the styles layer: the bar length, its 2px floor and
  // the mobile step are all CSS, so this method never learns a pixel value. The
  // angle goes out in radians because atan2 produces radians and CSS accepts
  // them — converting would put a `180 / Math.PI` in a widget.
  public setGizmo(axes: AxisScreenDirection[]) {
    AXIS_KEYS.forEach((key, index) => {
      const axis = axes[index];

      this.gizmo.style.setProperty(`--axis-${key}-angle`, `${axis.angleRadians}rad`);
      this.gizmo.style.setProperty(`--axis-${key}-foreshorten`, String(axis.foreshortening));
    });
  }
}

export default ViewportHUD;
