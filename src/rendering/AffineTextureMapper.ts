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
// 4) Give that transform to a repeating pattern and fill the projected triangle
//    with it.
//
// This is fast and simple, but not perspective-correct:
// - rotating faces can show stretching / shearing artifacts.
// - we reduce those artifacts by subdividing faces into many small triangles.
//
// uvDet:
// - uvDet is twice the signed area of the UV triangle.
// - uvDet == 0 means the UV triangle is degenerate, so we skip rendering.
// -----------------------------------------------------------------------------
//
// Step 4 used to be a clip to the triangle followed by one drawImage through the
// transform, and E4b (COS-245) changed it for two reasons. The first is that it
// could not tile: a UV outside [0..1] maps the triangle outside the drawn image,
// so the face comes out blank, and UV SCALE is exactly tiling. The second is the
// seam it left — clipping antialiases the triangle edge and drawImage
// antialiases the image edge, and the two attenuate the same pixels twice, which
// is the crosshatch the cube's 14x14 subdivided faces have always shown.
//
// One instance for the whole surface, not one per triangle, which reverses what
// E6 chose. That was right while this class held nothing: an empty object per
// triangle at mesh-build time cost nothing per frame. It holds a pattern cache
// now, and 8192 copies of a two-entry cache is not a trade. It arrives through
// TriangleRenderOptions, the seam textures and lighting already use.
//
// Nothing here allocates per frame beyond the caller's own request literal. The
// pattern is cached, and setTransform copies the matrix it is handed rather than
// keeping it, so one mutable DOMMatrix is rewritten for every triangle in the
// scene. The screen coordinates arrive as six scalars rather than three Point2D
// instances for the same reason — in a procedural mode every triangle takes this
// path, and D8's own arithmetic about the options literal points the same way
// about the points inside it.

import type { UV } from "@data/types";
import type { TextureSource } from "@textures/TextureRegistry";

// Flat, and one object per textured triangle per frame — which D8 settled is
// cheaper than the positional form's two fresh tuples, and cheaper still now
// that the three Point2D instances have gone with them.
export interface AffineDrawRequest {
  context: CanvasRenderingContext2D;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  uva: UV;
  uvb: UV;
  uvc: UV;
  // The key as well as the source: the cache is keyed by name rather than by
  // identity because the procedural canvases are repainted in place and stay the
  // same two objects for the life of the console.
  key: string;
  image: TextureSource;
  uvScale: number;
}

class AffineTextureMapper {
  private readonly patterns: Map<string, CanvasPattern>;
  private readonly transform: DOMMatrix;

  constructor() {
    this.patterns = new Map();
    this.transform = new DOMMatrix();
  }

  // createPattern takes a COPY of its source, so a pattern built from a
  // procedural canvas goes on painting the colour that canvas held when it was
  // built. ProceduralTextures repaints in place, which means the swatch that
  // repaints it has to call this — it is the one moment a cached pattern can be
  // wrong, and nothing about the frame says so.
  public invalidate() {
    this.patterns.clear();
  }

  public draw(request: AffineDrawRequest): boolean {
    const { context } = request;
    const [u1, v1] = request.uva;
    const [u2, v2] = request.uvb;
    const [u3, v3] = request.uvc;

    // The scale rides in the texture's dimensions rather than being applied to
    // the UVs, which is the same multiply written once instead of six times: a
    // face spanning one unit of UV now covers uvScale tiles of a pattern that
    // repeats every image.width pixels.
    const w = request.image.width * request.uvScale;
    const h = request.image.height * request.uvScale;

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

    const pattern = this.patternFor(context, request.key, request.image);
    if (!pattern) {
      return false;
    }

    const m11 = (request.ax * (y2 - y3) + request.bx * (y3 - y1) + request.cx * (y1 - y2)) / uvDet;
    const m12 = (request.ay * (y2 - y3) + request.by * (y3 - y1) + request.cy * (y1 - y2)) / uvDet;

    const m21 = (request.ax * (x3 - x2) + request.bx * (x1 - x3) + request.cx * (x2 - x1)) / uvDet;
    const m22 = (request.ay * (x3 - x2) + request.by * (x1 - x3) + request.cy * (x2 - x1)) / uvDet;

    const dx =
      (request.ax * (x2 * y3 - x3 * y2) + request.bx * (x3 * y1 - x1 * y3) + request.cx * (x1 * y2 - x2 * y1)) / uvDet;

    const dy =
      (request.ay * (x2 * y3 - x3 * y2) + request.by * (x3 * y1 - x1 * y3) + request.cy * (x1 * y2 - x2 * y1)) / uvDet;

    this.transform.a = m11;
    this.transform.b = m12;
    this.transform.c = m21;
    this.transform.d = m22;
    this.transform.e = dx;
    this.transform.f = dy;
    pattern.setTransform(this.transform);

    // No save/restore and no context transform: the pattern carries the
    // texture-space basis, so the path below is traced in the screen
    // coordinates the caller already holds and the canvas is left exactly as it
    // was found. That is what lets the key light's wash trace the same three
    // points straight afterwards.
    context.fillStyle = pattern;
    context.beginPath();
    context.moveTo(request.ax, request.ay);
    context.lineTo(request.bx, request.by);
    context.lineTo(request.cx, request.cy);
    context.closePath();
    context.fill();

    return true;
  }

  private patternFor(context: CanvasRenderingContext2D, key: string, image: TextureSource): CanvasPattern | null {
    const cached = this.patterns.get(key);

    if (cached) {
      return cached;
    }

    // Null for a source with no decoded pixels yet. Returning it rather than
    // caching it is what lets the next frame try again once the bitmap lands.
    const built = context.createPattern(image, "repeat");

    if (built) {
      this.patterns.set(key, built);
    }

    return built;
  }
}

export default AffineTextureMapper;
