// The ground plane's perspective divide — now the mesh's own, with one
// deliberate exception for ORTHOGRAPHIC.
//
// Before COS-246 (E5a) this held its own focal length, eye height and vanishing
// point, none of which was the scene camera: the checker floor and every mesh
// vertex disagreed about where the horizon was the moment either FOV or
// ORTHOGRAPHIC was live. It now projects a ground point exactly the way
// Point3D.convert3D2D projects a vertex — same RenderTarget centre and scale —
// with the ground's own y pinned to the constant GROUND_Y instead of a
// per-vertex value. That single shared idea is what makes the floor and the
// grid answer to zoom and FOV for free.
//
// PERSPECTIVE reuses Camera.scaleAt(z) exactly, unchanged. ORTHOGRAPHIC does
// not: Camera.scaleAt correctly drops z there for a mesh vertex, which still
// looks three-dimensional because each vertex carries its own x and y — but a
// ground point's y is the single constant GROUND_Y, so the same zero
// dependence collapses the whole plane onto the render-target centre. scaleFor
// below is the one place that exception lives — GroundGrid and GroundFloor
// stay entirely unaware of projection mode, calling project(x, z) exactly as
// they would in PERSPECTIVE.
//
// Constructed fresh once per frame, the same as its predecessor — the four
// numbers this used to hoist out of a closure are now two live collaborators
// instead, one of which (Camera) the caller may have just moved a slider on.

import { GROUND_DEPTH_METRES, GROUND_Y, metresToUnits } from "@rendering/worldScale";

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

export interface GroundPoint {
  x: number;
  y: number;
}

// The view volume's near plane, expressed as engine-unit depth like Camera's
// own `near`, floored well above it. A mesh vertex at d = 1 is a dot; a ground
// line runs continuously in to the eye, and at d = 1 a single segment would
// cover the screen several times over. 40 is the floor, not the default — a
// wider near plane than this (a tighter zoom) still wins. Bounds both
// projection branches equally: PERSPECTIVE for the divide it always guarded,
// ORTHOGRAPHIC so the two modes show the same ground extent even though the
// curve within it now has a different shape.
const GROUND_NEAR_DEPTH_FLOOR = 40;

class GroundProjection {
  private readonly camera: Camera;
  private readonly renderTarget: RenderTarget;

  // Positional, mirroring MeshFactory's own (renderTarget, camera) pair
  // (src/primitives/MeshFactory.ts): two required collaborators, neither
  // optional, below R4's three-argument threshold for a named options object.
  constructor(renderTarget: RenderTarget, camera: Camera) {
    this.renderTarget = renderTarget;
    this.camera = camera;
  }

  // The world z at which depth crosses the near plane, in the same z a ground
  // point is projected with below — depth(z) = z + camera.distance, so the
  // boundary is nearDepth - camera.distance. Callers clip a line's near end to
  // this rather than dropping the whole line, which is what keeps a grid line
  // that starts behind the eye trimmed instead of missing.
  public get nearZ(): number {
    const nearDepth = Math.max(this.camera.near, GROUND_NEAR_DEPTH_FLOOR);

    return nearDepth - this.camera.distance;
  }

  public project(x: number, z: number): GroundPoint {
    const scale = this.scaleFor(z) * this.renderTarget.scale;

    return {
      x: this.renderTarget.centerX + x * scale,
      y: this.renderTarget.centerY + GROUND_Y * scale,
    };
  }

  // PERSPECTIVE: Camera.scaleAt(z) unchanged, the exact divide every mesh
  // vertex already uses.
  //
  // ORTHOGRAPHIC: the tangent line to that same divide at z = 0 — the subject's
  // own centre plane, the one point PERSPECTIVE and ORTHOGRAPHIC already agree
  // on exactly (Camera.ts's own "keeps the centre plane fixed when the mode
  // changes"). scale(z) = focal/(z+distance) has derivative
  // -focal/distance² = -magnification/distance at z = 0, so its tangent line is
  // magnification·(1 - z/reach) — matching Camera.scaleAt(0)'s value at the
  // reference plane and continuing in a straight line rather than curving away,
  // instead of the flat "z stops mattering at all" a mesh vertex gets.
  //
  // reach is camera.distance floored at the ground's own designed depth, not
  // camera.distance alone: at the zoom slider's near end distance can shrink
  // to under 50 units, and a line's own slope is -magnification/distance —
  // steep enough that the whole 6000-unit visible ground would already have
  // clamped to the render-target centre a few dozen units past the eye,
  // nowhere near the far edge GroundGrid and GroundFloor are drawing out to.
  // Flooring the reach is the ORTHOGRAPHIC-side reason the ground is visible
  // at every zoom, not only the ones where distance happens to be large.
  //
  // Floored at zero past reach: beyond it the line would go negative and
  // mirror the ground across the render-target centre, the same fault E2's
  // near plane exists to prevent in PERSPECTIVE — clamping is the
  // ORTHOGRAPHIC-side equivalent of that guarantee, not a second copy of the
  // near clip above.
  private scaleFor(z: number): number {
    if (this.camera.mode !== "ORTHOGRAPHIC") {
      return this.camera.scaleAt(z);
    }

    const magnification = this.camera.scaleAt(z);
    const reach = Math.max(this.camera.distance, metresToUnits(GROUND_DEPTH_METRES));

    return Math.max(0, magnification * (1 - z / reach));
  }
}

export default GroundProjection;
