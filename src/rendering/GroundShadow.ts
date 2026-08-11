// The shape's shadow on the ground, painted onto the canvas: one soft blob per
// mesh, not a projected solid.
//
// Projecting the geometry would mean filling a second copy of every face — 8008
// of them on the torus knot, doubling the rasteriser's work — to produce
// something the eye reads as a smudge. A blob costs one arc.
//
// The ellipse itself is shadowEllipse's, not this class's: E3e gave the
// depth-buffered backend its own compositor for the same blob, and the geometry
// that used to live here now sits where both can read it. What is left is one
// painter — the transform, the gradient and the arc.
//
// Its own file for the reason GroundFloor and GroundGrid have theirs (R17):
// BackgroundRenderer owns layer flags and pass order, not the derivation of
// every layer's geometry.

import { CORE_SHARE, CORE_STOP, shadowEllipseFor } from "@rendering/shadowEllipse";

import type Fog from "@rendering/Fog";
import type GroundProjection from "@rendering/GroundProjection";
import type RenderStats from "@rendering/RenderStats";
import type { ShadowBlob } from "@rendering/shadowEllipse";

const TAU = Math.PI * 2;

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
      const ellipse = shadowEllipseFor(this.ground, this.fog, blob);

      if (!ellipse) {
        continue;
      }

      context.save();
      context.transform(ellipse.ux, ellipse.uy, ellipse.vx, ellipse.vy, ellipse.centreX, ellipse.centreY);
      context.fillStyle = this.gradient(context, ellipse.alpha);
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      context.fill();
      context.restore();
      stats.addDrawCall();
    }
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
}

export default GroundShadow;
