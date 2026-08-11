// The same ground shadow GroundShadow paints, blended into the frame buffer's
// own pixels instead of onto the canvas (E3e/3DE-115).
//
// It exists to fix the draw order, not to go faster — one canvas arc is
// cheaper than this per-pixel loop, and that trade is made deliberately. On the
// depth-buffered backend the shadow used to be drawn after
// FrameBuffer.present(), which put it ON TOP of the mesh: a shape standing on
// the plane was darkened by its own shadow, and the taller the shape the more
// of it the blob crossed. The painter path never had that, because there the
// whole background goes down before a single triangle is filled. A canvas pass
// cannot be moved earlier — the mesh pixels it would have to sit under do not
// reach the canvas until present() — so the shadow has to enter through the
// buffer, where it can be written before the rasteriser runs.
//
// The cost is bounded by the blob and nothing else: one ellipse's bounding box,
// which is a small fraction of the frame and is skipped outright whenever
// GROUND SHADOW is off.
//
// The unit circle is walked in screen space rather than parametrically: invert
// the ellipse's own basis, and every pixel of its bounding box maps back to a
// radius in the circle's frame, which is the radius the gradient ramp is
// written against. That is the same mapping context.transform() applies, run
// backwards.

import { shadowAlphaAt, shadowEllipseFor } from "@rendering/shadowEllipse";

import type Fog from "@rendering/Fog";
import type FrameBuffer from "@rendering/FrameBuffer";
import type GroundProjection from "@rendering/GroundProjection";
import type RenderStats from "@rendering/RenderStats";
import type { ShadowBlob, ShadowEllipse } from "@rendering/shadowEllipse";

class ShadowCompositor {
  private readonly ground: GroundProjection;
  private readonly fog: Fog;

  constructor(ground: GroundProjection, fog: Fog) {
    this.ground = ground;
    this.fog = fog;
  }

  // Counts one draw call per blob that reached the buffer, matching
  // GroundShadow's own accounting exactly: the Z-BUFFER toggle must not move a
  // number on the telemetry card.
  public composite(buffer: FrameBuffer, blobs: readonly ShadowBlob[], stats: RenderStats) {
    for (const blob of blobs) {
      const ellipse = shadowEllipseFor(this.ground, this.fog, blob);

      if (!ellipse) {
        continue;
      }

      this.fill(buffer, ellipse);
      stats.addDrawCall();
    }
  }

  private fill(buffer: FrameBuffer, ellipse: ShadowEllipse) {
    const { ux, uy, vx, vy, centreX, centreY } = ellipse;
    // Non-zero by construction — shadowEllipseFor rejects anything below its own
    // minimum projected area, which is this determinant's absolute value.
    const determinant = ux * vy - uy * vx;
    // The two rows of the inverted basis, so a screen offset maps back to the
    // unit circle in two multiply-adds per pixel.
    const row0X = vy / determinant;
    const row0Y = -vx / determinant;
    const row1X = -uy / determinant;
    const row1Y = ux / determinant;
    // The parametric extent of p = centre + [ux vx; uy vy](cos t, sin t): the
    // widest that ellipse reaches along each screen axis is the length of that
    // axis's own row. A bounding box from the two basis vectors' endpoints
    // instead would clip the ellipse wherever it is rotated.
    const reachX = Math.hypot(ux, vx);
    const reachY = Math.hypot(uy, vy);
    const minX = Math.max(0, Math.floor(centreX - reachX));
    const minY = Math.max(0, Math.floor(centreY - reachY));
    const maxX = Math.min(buffer.bufferWidth - 1, Math.ceil(centreX + reachX));
    const maxY = Math.min(buffer.bufferHeight - 1, Math.ceil(centreY + reachY));

    for (let y = minY; y <= maxY; y += 1) {
      const dy = y + 0.5 - centreY;

      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - centreX;
        const radius = Math.hypot(row0X * dx + row0Y * dy, row1X * dx + row1Y * dy);
        const alpha = shadowAlphaAt(radius, ellipse.alpha);

        if (alpha > 0) {
          buffer.blendPixel(x, y, 0, 0, 0, alpha);
        }
      }
    }
  }
}

export default ShadowCompositor;
