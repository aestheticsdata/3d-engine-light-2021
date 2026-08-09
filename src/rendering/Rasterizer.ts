// The depth-buffered backend's own pixel loop (E3b/COS-242): screen bounding
// box, then per candidate pixel an edge test, a depth test, and a shade —
// flat colour for an untextured face, an affine-sampled texel for a textured
// one. Everything it needs is already resolved by Triangle.rasterize() into
// plain numbers before this ever runs; this class never calls Lighting, Fog,
// or Point3D, the same separation Triangle.fill() already keeps between
// "what colour is this face" and "how does a pixel reach the canvas."
//
// E3c/COS-243 added the two per-pixel shading modes and the one per-vertex
// pass, which is what `shading` on the request selects between:
//
//   FLAT     the E3b path — one colour per triangle, fog already blended into
//            it, returned by reference with nothing computed per pixel.
//   GOURAUD  the same colour or texel, multiplied by the diffuse term
//            interpolated from the three vertices' own `shade`. Fog arrives
//            unblended here and is applied AFTER the multiply, or the haze in
//            front of a face would be darkened by the face behind it.
//   DEPTH    no colour at all: the pixel's own interpolated 1/d, reciprocated
//            and ramped between the two edges setDepthRange was given.
//
// NORMALS is not on that list on purpose. It is one colour per face, so it
// reaches here as an ordinary FLAT request and costs nothing per pixel — the
// encoding lives in normalRgba, next to the maths it belongs to.
//
// Nothing in shade() allocates. The composed paths write into one scratch tuple
// held for the life of this class and the FLAT path returns the request's own
// colour untouched: at a megapixel a frame a returned triple is a million
// allocations a second, which is the churn T28/T29 spent this codebase's early
// tickets removing.

import { depthLevel } from "@rendering/depthGrey";
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

// Which of the three per-pixel branches shade() takes. A named union rather
// than the pair of booleans this started as: two booleans are four states for
// three meanings, and the fourth — "gouraud and depth at once" — is exactly the
// unrepresentable-state problem an enum is for.
export type RasterShading = "FLAT" | "GOURAUD" | "DEPTH";

// flatColor is non-null on every untextured request except a DEPTH one, which
// returns before reading it — that is the invariant behind the one cast in
// shade(), and Triangle.rasterize() is the only builder that has to keep it.
// Not a discriminated union even so: the shading mode and "textured or not" are
// independent axes, GOURAUD applies to both, and four interface variants to
// spell out six combinations would be more shape than the two call sites need.
export interface RasterFillRequest {
  shading: RasterShading;
  vertices: [RasterVertex, RasterVertex, RasterVertex];
  texture: RasterTexture | null;
  flatColor: RGBA | null;
  textureWash: RGBA | null;
  // Null on a FLAT untextured request, where Triangle has already blended the
  // veil into flatColor — one blend per triangle instead of one per pixel, and
  // the reason that path can hand its colour back by reference.
  fogVeil: RGBA | null;
  opacity: number;
}

class Rasterizer {
  private readonly buffer: FrameBuffer;
  private readonly textures: TexturePixelCache;
  // The two edges DEPTH ramps between, per frame rather than per triangle:
  // Surface3D sets them on the line after it sets RenderStats' own pair, which
  // is what makes the mode and the Z-BUFFER card's axis describe one window.
  private depthNear: number;
  private depthFar: number;
  private readonly shaded: RGBA;

  constructor(buffer: FrameBuffer, textures: TexturePixelCache) {
    this.buffer = buffer;
    this.textures = textures;
    this.depthNear = 0;
    this.depthFar = 0;
    this.shaded = [0, 0, 0, 1];
  }

  public setDepthRange(near: number, far: number) {
    this.depthNear = near;
    this.depthFar = far;
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

        const colour = this.shade(request, weights, area, invD, v0, v1, v2);

        this.buffer.writePixel(x, y, invD, colour[0], colour[1], colour[2], request.opacity);
        wrote = true;
      }
    }

    return wrote;
  }

  // POINTS mode's whole raster pass (E3c/COS-243): a square block around one
  // projected vertex, depth-tested per pixel like any other.
  //
  // Five positional arguments, on the reading of R4 Lighting.fillFor already
  // records — the line in this codebase falls between per-mesh calls, which get
  // an options object, and per-primitive calls, which do not. A vertex is on the
  // second side of it, and the largest mesh in the registry submits 4224 of them
  // a frame.
  //
  // Every pixel is floored and bounds-checked individually rather than the
  // block being clamped once. FrameBuffer indexes y * width + x with no guard of
  // its own, so a fractional coordinate reads undefined — every comparison
  // against which is false, and the point would silently never draw — while an
  // x past the right edge wraps into the next row and paints there. The triangle
  // path never meets either because screenBounds floors and clamps for it.
  public fillPoint(x: number, y: number, invD: number, colour: RGBA, size: number): boolean {
    const originX = Math.round(x) - (size >> 1);
    const originY = Math.round(y) - (size >> 1);
    let wrote = false;

    for (let py = originY; py < originY + size; py += 1) {
      if (py < 0 || py >= this.buffer.bufferHeight) {
        continue;
      }

      for (let px = originX; px < originX + size; px += 1) {
        if (px < 0 || px >= this.buffer.bufferWidth || !this.buffer.depthTestPasses(px, py, invD)) {
          continue;
        }

        this.buffer.writePixel(px, py, invD, colour[0], colour[1], colour[2], colour[3]);
        wrote = true;
      }
    }

    return wrote;
  }

  private shade(
    request: RasterFillRequest,
    weights: EdgeWeights,
    area: number,
    invD: number,
    v0: RasterVertex,
    v1: RasterVertex,
    v2: RasterVertex,
  ): RGBA {
    if (request.shading === "DEPTH") {
      // The buffer holds 1/d because that is what interpolates linearly in
      // screen space; the ramp is linear in d, so the reciprocal is undone here
      // rather than the buffer storing something the depth test cannot use.
      const level = depthLevel(1 / invD, this.depthNear, this.depthFar);

      this.shaded[0] = level;
      this.shaded[1] = level;
      this.shaded[2] = level;

      return this.shaded;
    }

    // The E3b path, unchanged and by reference: one colour for the whole
    // triangle, its fog already blended in, and nothing to compute per pixel.
    if (request.shading === "FLAT" && !request.texture) {
      return request.flatColor as RGBA;
    }

    if (request.texture) {
      this.sampleInto(request, request.texture, weights, area, v0, v1, v2);
    } else {
      // Non-null on every untextured request that reaches here — see the
      // invariant on RasterFillRequest above.
      const flat = request.flatColor as RGBA;

      this.shaded[0] = flat[0];
      this.shaded[1] = flat[1];
      this.shaded[2] = flat[2];
    }

    if (request.shading === "GOURAUD") {
      const shade = interpolate(weights, area, v0.shade, v1.shade, v2.shade);

      this.shaded[0] *= shade;
      this.shaded[1] *= shade;
      this.shaded[2] *= shade;
    }

    if (request.fogVeil) {
      this.veil(request.fogVeil);
    }

    return this.shaded;
  }

  private sampleInto(
    request: RasterFillRequest,
    texture: RasterTexture,
    weights: EdgeWeights,
    area: number,
    v0: RasterVertex,
    v1: RasterVertex,
    v2: RasterVertex,
  ) {
    const decoded = this.textures.get(texture.key, texture.image);
    const u = interpolate(weights, area, v0.u, v1.u, v2.u) * texture.uvScale;
    const v = interpolate(weights, area, v0.v, v1.v, v2.v) * texture.uvScale;
    const texel = sampleTexel(decoded.pixels, decoded.width, decoded.height, u, v);

    this.shaded[0] = texel.r;
    this.shaded[1] = texel.g;
    this.shaded[2] = texel.b;

    // The flat path's own shade, as a wash: a texel cannot be modulated by a
    // canvas fill, so E3a darkens a textured face with a black overlay and this
    // reproduces it per pixel. GOURAUD sends none — its multiply below is the
    // better answer to the same question, and applying both would shade twice.
    if (request.textureWash) {
      this.veil(request.textureWash);
    }
  }

  private veil(over: RGBA) {
    const alpha = over[3];
    const inverse = 1 - alpha;

    this.shaded[0] = over[0] * alpha + this.shaded[0] * inverse;
    this.shaded[1] = over[1] * alpha + this.shaded[1] * inverse;
    this.shaded[2] = over[2] * alpha + this.shaded[2] * inverse;
  }
}

export default Rasterizer;
