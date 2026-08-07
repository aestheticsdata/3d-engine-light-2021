// The shape's shadow on the ground: one soft blob per mesh, not a projected
// solid.
//
// Projecting the geometry would mean filling a second copy of every face — 8008
// of them on the torus knot, doubling the rasteriser's work — to produce
// something the eye reads as a smudge. A blob costs one arc.
//
// It is an ellipse only in the sense that a circle on the ground projects to
// one. The shape is built from the ground's own basis rather than from a
// closed-form semi-axis pair: project the circle's centre and two points a
// radius away along +x and +z, and the two difference vectors ARE the projected
// ellipse's axes. Under `transform` a unit circle then lands on it exactly for
// the affine part of the projection, tilting with roll and foreshortening with
// pitch and zoom without any of that being written down here. The closed form
// this replaces assumed an axis-aligned ellipse about a fixed vanishing point,
// which is what the ground was before COS-246 gave it the scene camera.
//
// Its own file for the reason GroundFloor and GroundGrid have theirs (R17):
// BackgroundRenderer owns layer flags and pass order, not the derivation of
// every layer's geometry.

import { GROUND_Y, metresToUnits } from "@rendering/worldScale";

import type { MeshBounds } from "@primitives/Mesh";
import type Fog from "@rendering/Fog";
import type GroundProjection from "@rendering/GroundProjection";
import type RenderStats from "@rendering/RenderStats";

// One posed mesh's contribution. The offsets are screen-space and come straight
// from the transition machine: mid-switch there are two meshes sliding across
// the frame, and a shadow drawn without them detaches from the shape it belongs
// to and sits under the middle of the canvas.
export interface ShadowBlob {
  bounds: MeshBounds;
  offsetX: number;
  offsetY: number;
}

const TAU = Math.PI * 2;

// Directly under a resting shape, and at its faintest once the shape has risen
// a fade's worth above the plane. A contact shadow is what says an object is
// standing on something; one that never lightens says it is welded there.
const CONTACT_ALPHA = 0.42;
const RISEN_ALPHA = 0.1;
const RISE_FADE = metresToUnits(4);

// The core stays dense over the inner half and gives up the rest, which is what
// makes the blob read as a shadow rather than as a grey disc with a hard edge.
const CORE_STOP = 0.5;
const CORE_SHARE = 0.82;

// Below this the projected basis has collapsed — the blob is edge-on, or the
// circle straddles the near plane — and `transform` would either paint a line or
// mirror the gradient through a degenerate matrix.
const MIN_PROJECTED_AREA = 1e-3;

class GroundShadow {
  private readonly ground: GroundProjection;
  private readonly fog: Fog;

  constructor(ground: GroundProjection, fog: Fog) {
    this.ground = ground;
    this.fog = fog;
  }

  // Counts its own submissions rather than reporting a number for the caller to
  // add up, the arrangement Mesh already uses for drawn triangles: a shadow the
  // near plane rejected is not a canvas submission, and this is the only place
  // that knows which ones those were.
  public draw(context: CanvasRenderingContext2D, blobs: readonly ShadowBlob[], stats: RenderStats) {
    for (const blob of blobs) {
      if (this.drawBlob(context, blob)) {
        stats.addDrawCall();
      }
    }
  }

  private drawBlob(context: CanvasRenderingContext2D, blob: ShadowBlob): boolean {
    const { bounds } = blob;
    const centreX = (bounds.minX + bounds.maxX) / 2;
    const centreZ = (bounds.minZ + bounds.maxZ) / 2;
    // The mean of the two horizontal half-extents, so a long shape casts one
    // round shadow of its average width rather than an oval fighting the one
    // perspective already gives it. An empty mesh folds to an inverted box and
    // fails this test as NaN, which is the intent.
    const radius = (bounds.maxX - bounds.minX + (bounds.maxZ - bounds.minZ)) / 4;

    if (!(radius > 0) || this.ground.depthAt(centreX, centreZ) < this.ground.nearDepth) {
      return false;
    }

    const centre = this.ground.project(centreX, centreZ);
    const alongX = this.ground.project(centreX + radius, centreZ);
    const alongZ = this.ground.project(centreX, centreZ + radius);
    const ux = alongX.x - centre.x;
    const uy = alongX.y - centre.y;
    const vx = alongZ.x - centre.x;
    const vy = alongZ.y - centre.y;

    if (Math.abs(ux * vy - uy * vx) < MIN_PROJECTED_AREA) {
      return false;
    }

    context.save();
    context.transform(ux, uy, vx, vy, centre.x + blob.offsetX, centre.y + blob.offsetY);
    context.fillStyle = this.gradient(context, this.alphaFor(bounds));
    context.beginPath();
    context.arc(0, 0, 1, 0, TAU);
    context.fill();
    context.restore();

    return true;
  }

  // Built inside the transformed frame, so the unit circle and the gradient share
  // one coordinate system and a single radial covers both axes of the ellipse.
  private gradient(context: CanvasRenderingContext2D, alpha: number): CanvasGradient {
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);

    gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    gradient.addColorStop(CORE_STOP, `rgba(0, 0, 0, ${alpha * CORE_SHARE})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    return gradient;
  }

  // y is DOWN in this engine, so the mesh's LARGEST y is its lowest point and
  // GROUND_Y is a positive number below the origin. The gap between the two is
  // the height the shape is hovering at, which is what the density answers to.
  //
  // Fogged by the same curve as everything else on the ground: a shadow that
  // stayed black while the floor around it dissolved would be the one mark in the
  // frame that the weather does not reach.
  private alphaFor(bounds: MeshBounds): number {
    const height = Math.max(0, GROUND_Y - bounds.maxY);
    const risen = Math.min(1, height / RISE_FADE);
    const centreZ = (bounds.minZ + bounds.maxZ) / 2;
    const survives = this.fog.groundAlpha(this.ground.depthAt((bounds.minX + bounds.maxX) / 2, centreZ));

    return (CONTACT_ALPHA + (RISEN_ALPHA - CONTACT_ALPHA) * risen) * survives;
  }
}

export default GroundShadow;
