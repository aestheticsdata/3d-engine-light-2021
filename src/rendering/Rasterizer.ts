// The depth-buffered backend's own pixel loop (E3b/COS-242): screen bounding
// box, then per candidate pixel an edge test, a depth test, and a shade —
// flat colour for an untextured face, an affine-sampled texel for a textured
// one. Everything it needs is already resolved by Triangle.rasterize() into
// plain numbers before this ever runs; this class never calls Lighting, Fog,
// or Point3D, the same separation Triangle.fill() already keeps between
// "what colour is this face" and "how does a pixel reach the canvas."
//
// flatColor/textureWash/textureFogVeil arrive pre-blended per TRIANGLE, not
// per pixel — "flat shade," which is what this ticket's own file list calls
// it. A textured face still samples its texel per pixel (the one thing a
// CanvasPattern fill could never do at all), then composites the same
// wash-then-fog chain fill()'s own drawTexture+shadeTexture+veilWithFog
// sequence already applies, collapsed into two multiplies instead of two
// more context.fill() calls.

import { edgeWeights, interpolate, isInside, screenBounds, signedArea2 } from "@rendering/edgeFunction";
import { sampleTexel } from "@rendering/texelSampling";

import type { RasterVertex } from "@primitives/Triangle";
import type { RGBA } from "@rendering/cssColor";
import type { EdgeWeights } from "@rendering/edgeFunction";
import type FrameBuffer from "@rendering/FrameBuffer";
import type TexturePixelCache from "@rendering/TexturePixelCache";
import type { TextureSource } from "@textures/TextureRegistry";

export interface RasterTexture {
  key: string;
  image: TextureSource;
  uvScale: number;
}

// Exactly one of flatColor or texture is set — Triangle.rasterize() builds
// one or the other, never both, which is why this is not a discriminated
// union: the two call sites already branch, and a union here would only
// move that branch from one file to two.
export interface RasterFillRequest {
  vertices: [RasterVertex, RasterVertex, RasterVertex];
  texture: RasterTexture | null;
  flatColor: RGBA | null;
  textureWash: RGBA | null;
  textureFogVeil: RGBA | null;
  opacity: number;
}

class Rasterizer {
  private readonly buffer: FrameBuffer;
  private readonly textures: TexturePixelCache;

  constructor(buffer: FrameBuffer, textures: TexturePixelCache) {
    this.buffer = buffer;
    this.textures = textures;
  }

  // True the moment at least one pixel passed both the edge test and the
  // depth test — the same "did this end up drawn" contract Triangle.fill()
  // already returns, which is what lets Mesh.renderMesh's drawn-count
  // bookkeeping stay identical for either backend's return value.
  public fillTriangle(request: RasterFillRequest): boolean {
    const [v0, v1, v2] = request.vertices;
    const bounds = screenBounds(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, this.buffer.bufferWidth, this.buffer.bufferHeight);

    if (!bounds) {
      return false;
    }

    const area = signedArea2(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);

    // Zero-area or the rare degenerate reversed triangle project() can still
    // hand this class before a backface test elsewhere has caught it — see
    // Mesh's raster pass, which only calls rasterize() on survivors of
    // clipToNear's own front-facing test, so this is a defensive floor
    // rather than the primary guard.
    if (area <= 0) {
      return false;
    }

    let wrote = false;

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const weights = edgeWeights(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, px, py);

        if (!isInside(weights)) {
          continue;
        }

        const invD = interpolate(weights, area, v0.invD, v1.invD, v2.invD);

        if (!this.buffer.depthTestPasses(x, y, invD)) {
          continue;
        }

        const colour = this.shade(request, weights, area, v0, v1, v2);

        this.buffer.writePixel(x, y, invD, colour[0], colour[1], colour[2], request.opacity);
        wrote = true;
      }
    }

    return wrote;
  }

  private shade(
    request: RasterFillRequest,
    weights: EdgeWeights,
    area: number,
    v0: RasterVertex,
    v1: RasterVertex,
    v2: RasterVertex,
  ): RGBA {
    if (!request.texture) {
      // flatColor is always set on the untextured path — Triangle.rasterize()
      // never builds a request with neither.
      return request.flatColor as RGBA;
    }

    const decoded = this.textures.get(request.texture.key, request.texture.image);
    const u = interpolate(weights, area, v0.u, v1.u, v2.u) * request.texture.uvScale;
    const v = interpolate(weights, area, v0.v, v1.v, v2.v) * request.texture.uvScale;
    const texel = sampleTexel(decoded.pixels, decoded.width, decoded.height, u, v);

    let r = texel.r;
    let g = texel.g;
    let b = texel.b;

    if (request.textureWash) {
      const [wr, wg, wb, wa] = request.textureWash;

      r = wr * wa + r * (1 - wa);
      g = wg * wa + g * (1 - wa);
      b = wb * wa + b * (1 - wa);
    }

    if (request.textureFogVeil) {
      const [fr, fg, fb, fa] = request.textureFogVeil;

      r = fr * fa + r * (1 - fa);
      g = fg * fa + g * (1 - fa);
      b = fb * fa + b * (1 - fa);
    }

    return [r, g, b, 1];
  }
}

export default Rasterizer;
