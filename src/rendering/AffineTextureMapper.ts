// -----------------------------------------------------------------------------
// Canvas 2D implementation notes (Affine mapping)
// -----------------------------------------------------------------------------
// The HTML Canvas 2D API does not provide perspective-correct texturing.
// Instead, we approximate texture mapping using an affine transform.
//
// Steps:
// 1) Project 3D points -> 2D screen coordinates (ax,ay) (bx,by) (cx,cy).
// 2) Convert UVs -> pixel coordinates in texture space (x1,y1) (x2,y2) (x3,y3).
// 3) Compute the 2D affine transform that maps texture triangle -> screen triangle.
//    In other words, find matrix M + translation D such that:
//
//      [sx]   [m11 m21 dx] [tx]
//      [sy] = [m12 m22 dy] [ty]
//      [ 1]   [ 0   0   1] [ 1]
//
//    where (tx,ty) are texture-space coordinates and (sx,sy) are screen-space.
//
// 4) Clip to the projected triangle in screen space, then draw the full image
//    through the transform. Only the clipped triangle region becomes visible.
//
// This is fast and simple, but not perspective-correct:
// - rotating faces can show stretching / shearing artifacts.
// - we reduce those artifacts by subdividing faces into many small triangles.
//
// uvDet:
// - uvDet is twice the signed area of the UV triangle.
// - uvDet == 0 means the UV triangle is degenerate, so we skip rendering.
// -----------------------------------------------------------------------------

import type Point2D from "@primitives/Point2D";
import type { UV } from "@data/types";

// Flat rather than two nested triples: this literal is built once per textured
// triangle per frame, and one object costs less than one object holding two
// fresh arrays.
export interface AffineDrawRequest {
  context: CanvasRenderingContext2D;
  a: Point2D;
  b: Point2D;
  c: Point2D;
  uva: UV;
  uvb: UV;
  uvc: UV;
  image: HTMLImageElement;
}

class AffineTextureMapper {
  // Opens exactly one save/restore pair, after the degenerate-UV exit and closed
  // before the return, so this leaves the canvas exactly as it found it.
  // `setTransform` REPLACES the current transform rather than multiplying into
  // it, which is why that restore is not optional: without it the next triangle
  // inherits this one's texture-space basis and the whole mesh comes out
  // skewed. The caller's own save is a separate, outer pair and stays the
  // caller's — taking it over here would let its globalAlpha leak.
  public draw(request: AffineDrawRequest): boolean {
    const { context, a, b, c, image } = request;
    const [u1, v1] = request.uva;
    const [u2, v2] = request.uvb;
    const [u3, v3] = request.uvc;

    const w = image.width;
    const h = image.height;

    // UV in pixels
    const x1 = u1 * w,
      y1 = v1 * h;
    const x2 = u2 * w,
      y2 = v2 * h;
    const x3 = u3 * w,
      y3 = v3 * h;

    // Solve affine transform (UV->Screen)
    const uvDet = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
    if (uvDet === 0) {
      return false;
    }

    const m11 = (a.x * (y2 - y3) + b.x * (y3 - y1) + c.x * (y1 - y2)) / uvDet;
    const m12 = (a.y * (y2 - y3) + b.y * (y3 - y1) + c.y * (y1 - y2)) / uvDet;

    const m21 = (a.x * (x3 - x2) + b.x * (x1 - x3) + c.x * (x2 - x1)) / uvDet;
    const m22 = (a.y * (x3 - x2) + b.y * (x1 - x3) + c.y * (x2 - x1)) / uvDet;

    const dx =
      (a.x * (x2 * y3 - x3 * y2) +
        b.x * (x3 * y1 - x1 * y3) +
        c.x * (x1 * y2 - x2 * y1)) /
      uvDet;

    const dy =
      (a.y * (x2 * y3 - x3 * y2) +
        b.y * (x3 * y1 - x1 * y3) +
        c.y * (x1 * y2 - x2 * y1)) /
      uvDet;

    context.save();

    // clip triangle in screen space
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineTo(c.x, c.y);
    context.closePath();
    context.clip();

    // apply transform and draw image in UV space
    context.setTransform(m11, m12, m21, m22, dx, dy);
    context.drawImage(image, 0, 0);

    context.restore();

    return true;
  }
}

export default AffineTextureMapper;
