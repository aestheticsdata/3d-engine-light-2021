// The projection itself: one record, shared by every vertex of every mesh.
//
// It replaces two public fields on Point3D that Triangle wrote through Mesh —
// 3960 writes per zoom tick on the torus knot, and it would have been five
// fields per vertex once the mode and the two planes joined them. A shared
// mutable record makes a camera change cost nothing per vertex at all: the
// points hold the reference, so moving a slider moves one number here.
//
// The parameterisation is this module's whole content. The engine used to divide
// by `fl + z + zOffset`, a focal length plus a push-back with no meaning of its
// own. Replace the offset with the MAGNIFICATION k — the scale the subject gets
// at its own centre plane, z = 0:
//
//     k = fl / (fl + zOffset)   <=>   zOffset = fl · (1 − k) / k
//
// and, with `d = z + fl/k` the vertex's depth in front of the eye, both
// projections become one expression:
//
//     perspective    scale(z) = k · fl / (fl + k · z) = fl / d
//     orthographic   scale(z) = k
//
// Orthographic is not a second pipeline. It is the fl -> infinity limit of the
// same expression at fixed k: as the eye recedes while the magnification is
// held, every ray becomes parallel and the scale stops depending on z. That is
// what "parallel projection" means, written out.
//
// Two things fall out of it for free. Holding k while fl moves is a dolly zoom —
// the subject keeps its size at its centre plane while the perspective falloff
// around it opens or flattens — which is what a field-of-view control is
// supposed to feel like. And fl/k IS the eye distance, so every camera readout
// comes off one derivation instead of re-adding a focal length to an offset.

// Uppercase, and the same two words the chips are labelled with. The alternative
// is a lowercase engine enum plus a table mapping it to the labels the HUD, the
// status bar and the CAMERA card print — a table whose only job would be to be
// kept in sync with this union.
export type ProjectionMode = "PERSPECTIVE" | "ORTHOGRAPHIC";

export interface CameraOptions {
  focal: number;
  magnification: number;
  mode?: ProjectionMode;
  near?: number;
  far?: number;
}

const DEFAULT_MODE: ProjectionMode = "PERSPECTIVE";

// The view volume, in the depth `d` the projection actually divides by.
//
// Near is not inert and is the reason this class has planes at all: `scale` is
// singular at d = 0 and changes sign below it, so a vertex behind the eye used
// to land mirrored across the vanishing point instead of disappearing. At zoom
// 100 the eye sits 80 units out and every shape in the registry reaches past it.
//
// Far is inert by construction, which is what a far plane should be here: the
// deepest the camera can be pushed is the FOV 15° focal (2430.6) over the zoom
// slider's smallest magnification (0.5357), an eye distance of 4537, and the
// registry's widest vertex is the Menger sponge's 182 from the origin. 5000
// clears the sum with room to spare. It is not the ticket's 2000 — that number
// was derived at the default FOV, where the eye never leaves 560, and the dolly
// compensation this class introduces is exactly what carries it past it.
const DEFAULT_NEAR = 1;
const DEFAULT_FAR = 5000;

class Camera {
  private focal: number;
  private magnification: number;
  private projection: ProjectionMode;
  // fl/k, held rather than divided for. It is read twice per vertex — once by
  // the view-volume test and once by the projection — so on the torus knot's
  // 3960 points that is 7920 divisions a frame to save two assignments in the
  // two methods that can change it. Derived state in a class that otherwise has
  // none, and worth it exactly here.
  private eyeDistance: number;
  // Readouts, not controls: the console prints them and nothing writes them.
  private readonly nearPlane: number;
  private readonly farPlane: number;

  constructor(options: CameraOptions) {
    this.focal = options.focal;
    this.magnification = options.magnification;
    this.eyeDistance = options.focal / options.magnification;
    this.projection = options.mode ?? DEFAULT_MODE;
    this.nearPlane = options.near ?? DEFAULT_NEAR;
    this.farPlane = options.far ?? DEFAULT_FAR;
  }

  public get focalLength(): number {
    return this.focal;
  }

  // Defined in both modes, and deliberately so: the eye does not stop being
  // somewhere when the rays go parallel, it only stops governing apparent size.
  // The camera rig turns this scalar into a world position.
  public get distance(): number {
    return this.eyeDistance;
  }

  public get near(): number {
    return this.nearPlane;
  }

  public get far(): number {
    return this.farPlane;
  }

  public get mode(): ProjectionMode {
    return this.projection;
  }

  public setFocal(value: number) {
    this.focal = value;
    this.eyeDistance = value / this.magnification;
  }

  // The zoom control writes this rather than a push-back, which is what makes
  // the dolly compensation free: a focal change leaves k alone, so the subject
  // holds its size at the centre plane without anything recomputing an offset.
  public setMagnification(value: number) {
    this.magnification = value;
    this.eyeDistance = this.focal / value;
  }

  public setMode(mode: ProjectionMode) {
    this.projection = mode;
  }

  public scaleAt(z: number): number {
    if (this.projection === "ORTHOGRAPHIC") {
      return this.magnification;
    }

    return this.focal / this.depthAt(z);
  }

  // Whole-vertex, and the caller rejects the whole triangle: a triangle
  // straddling the near plane is dropped rather than split, so the artefact is a
  // hole rather than the smear a mirrored vertex used to paint. Splitting it
  // properly means Sutherland-Hodgman with UV interpolation, which is COS-418
  // (E2b).
  public clips(z: number): boolean {
    const depth = this.depthAt(z);

    return depth < this.nearPlane || depth > this.farPlane;
  }

  private depthAt(z: number): number {
    return z + this.eyeDistance;
  }
}

export default Camera;
