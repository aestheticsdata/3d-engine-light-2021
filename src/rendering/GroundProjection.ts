// The ground plane's perspective divide — the mesh's own, now including the
// camera's orientation.
//
// Before COS-246 (E5a) this held its own focal length, eye height and vanishing
// point, none of which was the scene camera. It then projected a ground point
// exactly the way Point3D.convert3D2D projects a vertex, but with the ground's
// y pinned to GROUND_Y and no rotation at all — so the floor and the grid stood
// still while the drag turned the mesh, and the console read as spinning an
// object rather than moving a camera.
//
// It now transforms the world point (x, GROUND_Y, z) by the camera's own matrix
// before dividing, which is the same arithmetic Point3D.setFromSource runs on a
// vertex. The camera matrix is C alone — no turntable in it — because the
// turntable turns the object and must not drag the horizon around with it.
//
// PERSPECTIVE reuses Camera.scaleAt exactly. ORTHOGRAPHIC does not, and the
// reason survives the rotation: Camera.scaleAt correctly drops depth there for a
// mesh vertex, which still looks three-dimensional because each vertex carries
// its own x and y — but the ground is one flat sheet, so the same zero
// dependence collapses it to a band. scaleFor is the one place that exception
// lives; GroundGrid and GroundFloor stay unaware of projection mode.
//
// Constructed fresh once per frame, the same as its predecessor.

import { GROUND_DEPTH_METRES, GROUND_Y, metresToUnits } from "@rendering/worldScale";

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

export interface GroundPoint {
  x: number;
  y: number;
}

// Where the ground's vanishing line falls, in a frame whose origin is the
// render target's centre. `offset` is signed along the line's own normal and
// `tilt` is that normal's roll, so a caller can rotate into the horizon's frame
// and go on thinking in horizontal bands. `groundSign` is +1 while the eye is
// above the plane and -1 once it has passed underneath, which is what tells the
// haze and the floor fade which side of the line to paint on.
export interface GroundHorizon {
  tilt: number;
  offset: number;
  groundSign: number;
}

export interface GroundProjectionOptions {
  renderTarget: RenderTarget;
  camera: Camera;
  cameraTransform: number[][];
}

// The view volume's near plane, expressed as engine-unit depth like Camera's
// own `near`, floored well above it. A mesh vertex at d = 1 is a dot; a ground
// line runs continuously in to the eye, and at d = 1 a single segment would
// cover the screen several times over.
const GROUND_NEAR_DEPTH_FLOOR = 40;

// The share of the eye's own clearance above the ground that the near clip is
// allowed to consume. The floor above is tuned for the resting pose, where the
// eye sits 175 units over the plane and 40 costs nothing; it silently becomes
// the whole plane once a vertical drag brings the two within 40 of each other,
// because every ground point the eye can see is then nearer than the clip. Half
// the clearance keeps the guard doing its job at every height.
const NEAR_CLEARANCE_SHARE = 0.5;

// The clip can shrink, but not to nothing: at the instant the eye crosses the
// plane the clearance is zero, and a ground point at depth zero is the divide
// by zero the near plane exists to prevent.
const GROUND_NEAR_DEPTH_MINIMUM = 1;

// Past this the horizon is far enough off-canvas that the exact number stops
// meaning anything, and at pitch ±90 the divide that produces it goes to
// infinity. Canvas silently drops non-finite geometry, so an unclamped value
// does not throw — it makes the sky quietly disappear, which is much harder to
// diagnose than a horizon parked off-screen.
const HORIZON_OFFSET_LIMIT_PX = 100000;

class GroundProjection {
  private readonly camera: Camera;
  private readonly renderTarget: RenderTarget;
  private readonly transform: number[][];

  // Three collaborators, so a named options object rather than a positional
  // list (R4). It was a positional pair until the camera transform joined it.
  constructor(options: GroundProjectionOptions) {
    this.renderTarget = options.renderTarget;
    this.camera = options.camera;
    this.transform = options.cameraTransform;
  }

  // The depth the near plane is compared against, in the same units Camera.near
  // is expressed in. Callers clip against depthAt() rather than against a world
  // z: once the plane rotates, a segment's near end in world space is not its
  // near end in front of the eye.
  public get nearDepth(): number {
    // The camera's own near plane still wins: it is the view volume the mesh is
    // clipped against, and a ground drawn nearer than that is the floor and the
    // solid disagreeing about where the world starts, which is the fault
    // COS-246 removed. What scales is only this class's own extra guard.
    const affordable = Math.abs(this.elevation()) * NEAR_CLEARANCE_SHARE;
    const guard = Math.max(GROUND_NEAR_DEPTH_MINIMUM, Math.min(GROUND_NEAR_DEPTH_FLOOR, affordable));

    return Math.max(this.camera.near, guard);
  }

  // Affine in (x, z), which is what makes the near-plane crossing solvable in
  // closed form instead of by subdivision: depth is a plane over the ground's
  // own coordinates, so `depth >= nearDepth` is a half-plane.
  public depthAt(x: number, z: number): number {
    const m = this.transform;

    return m[2][0] * x + m[2][1] * GROUND_Y + m[2][2] * z + m[2][3] + this.camera.distance;
  }

  public project(x: number, z: number): GroundPoint {
    const m = this.transform;
    const cx = m[0][0] * x + m[0][1] * GROUND_Y + m[0][2] * z + m[0][3];
    const cy = m[1][0] * x + m[1][1] * GROUND_Y + m[1][2] * z + m[1][3];
    const cz = m[2][0] * x + m[2][1] * GROUND_Y + m[2][2] * z + m[2][3];
    const scale = this.scaleFor(cz) * this.renderTarget.scale;

    return {
      x: this.renderTarget.centerX + cx * scale,
      y: this.renderTarget.centerY + cy * scale,
    };
  }

  // The plane's vanishing line. A plane whose normal in camera space is n has
  // the screen line n.x·X + n.y·Y + n.z·f = 0 through the principal point, so
  // its distance from the centre is -n.z·f/|n.xy| along the unit normal and its
  // tilt is that normal's own angle. The ground's world normal is +y, so n is
  // simply column 1 of the camera matrix — which under the rig's roll·pitch·yaw
  // order is free of yaw entirely: turning left and right slides the floor
  // without ever tipping the horizon.
  public horizon(): GroundHorizon {
    const m = this.transform;
    const nx = m[0][1];
    const ny = m[1][1];
    const nz = m[2][1];
    const planar = Math.hypot(nx, ny);
    const focalPx = this.camera.focalLength * this.renderTarget.scale;
    const elevation = this.elevation();

    if (planar === 0) {
      // Straight down or straight up: every direction in the plane projects to
      // a finite point, so there is no horizon on the canvas at all.
      return { tilt: 0, offset: HORIZON_OFFSET_LIMIT_PX, groundSign: Math.sign(elevation) || 1 };
    }

    const offset = (-nz * focalPx) / planar;

    return {
      tilt: Math.atan2(nx, ny),
      offset: Math.min(HORIZON_OFFSET_LIMIT_PX, Math.max(-HORIZON_OFFSET_LIMIT_PX, offset)),
      groundSign: Math.sign(elevation) || 1,
    };
  }

  // True once a vertical drag has carried the camera under the ground plane.
  // The caller needs it for painting order, not for shading: from below, the
  // floor lies between the eye and everything standing on it, so it has to be
  // painted over the meshes rather than behind them.
  public get isEyeBelowGround(): boolean {
    return this.elevation() < 0;
  }

  // How far the eye stands off the ground, along the plane's own normal. It
  // passes through zero and changes sign when a vertical drag carries the camera
  // underneath, which is both where the near clip has to give way and where the
  // sky changes sides.
  private elevation(): number {
    return GROUND_Y + this.camera.distance * this.transform[2][1];
  }

  // PERSPECTIVE: Camera.scaleAt unchanged, the exact divide every mesh vertex
  // already uses.
  //
  // ORTHOGRAPHIC: the tangent line to that same divide at the subject's own
  // centre plane, the one depth the two modes already agree on exactly. Floored
  // at zero past its reach, where the line would go negative and mirror the
  // ground across the render-target centre — the same fault E2's near plane
  // exists to prevent in PERSPECTIVE.
  private scaleFor(depth: number): number {
    if (this.camera.mode !== "ORTHOGRAPHIC") {
      return this.camera.scaleAt(depth);
    }

    const magnification = this.camera.scaleAt(depth);
    const reach = Math.max(this.camera.distance, metresToUnits(GROUND_DEPTH_METRES));

    return Math.max(0, magnification * (1 - depth / reach));
  }
}

export default GroundProjection;
