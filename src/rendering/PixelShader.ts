// "What colour is this pixel" — the other half of the seam Rasterizer's own
// header names, split out of it by E3d/COS-244 when the dither pass carried that
// file past R17's ~160 lines. The division is the one Triangle already keeps
// between fill() and the colour it fills with: Rasterizer decides WHICH pixels a
// triangle reaches and how they land in the buffer, and this class decides what
// each of them looks like once it gets there. Nothing here knows about the
// buffer, the depth test, coverage or the bounding box, and nothing here calls
// Lighting, Fog or Point3D — everything it reads was resolved into plain numbers
// by Triangle.rasterize() before the frame's first pixel.
//
// The three modes `shading` selects between (E3c/COS-243):
//
//   FLAT     one colour for the whole triangle, fog already blended into it,
//            returned BY REFERENCE with nothing computed per pixel.
//   GOURAUD  the same colour or texel, multiplied by the diffuse term
//            interpolated from the three vertices' own `shade`. Fog arrives
//            unblended here and is applied AFTER the multiply, or the haze in
//            front of a face would be darkened by the face behind it.
//   DEPTH    no colour at all: the pixel's own interpolated 1/d, reciprocated
//            and ramped between the two edges setDepthRange was given.
//
// NORMALS is not on that list on purpose. It is one colour per face, so it
// arrives as an ordinary FLAT request and costs nothing per pixel — the encoding
// lives in normalRgba, next to the maths it belongs to.
//
// DITHERING (E3d/COS-244) quantises to five bits with a 4 x 4 ordered Bayer
// offset, and reaches every path through this class EXCEPT the FLAT untextured
// one — which is the whole of the ticket's "dithering is a no-op on flat
// colour", kept by construction rather than by a test on the mode. That path
// returns the request's own colour by reference, so dithering it would first
// mean copying the colour into the scratch tuple to avoid mutating the caller's:
// paying the fast path's entire cost in order to lay a Bayer pattern over a face
// with no gradient to hide. The two paths that DO compute a colour of their own
// hand it back through quantised(), which is where the pass attaches.
//
// Nothing here allocates. The composed paths write into one scratch tuple held
// for the life of the class: at a megapixel a frame, a returned triple is a
// million allocations a second, which is the churn T28/T29 spent this codebase's
// early tickets removing. The per-triangle inputs are held for the same reason —
// beginTriangle() sets them once so the pixel loop can call shade() with four
// arguments instead of passing the same nine down a megapixel of iterations.

import { depthLevel } from "@rendering/depthGrey";
import { interpolate } from "@rendering/edgeFunction";
import { ditherBias, ditherChannel } from "@rendering/orderedDither";
import { sampleTexel } from "@rendering/texelSampling";

import type { RasterVertex } from "@primitives/Triangle";
import type { RGBA } from "@rendering/cssColor";
import type { EdgeWeights } from "@rendering/edgeFunction";
import type { RasterFillRequest, RasterTexture } from "@rendering/Rasterizer";
import type TexturePixelCache from "@rendering/TexturePixelCache";

class PixelShader {
  private readonly textures: TexturePixelCache;
  private readonly shaded: RGBA;
  // The two edges DEPTH ramps between, per frame rather than per triangle:
  // Surface3D sets them on the line after it sets RenderStats' own pair, which
  // is what makes the mode and the Z-BUFFER card's axis describe one window.
  private depthNear: number;
  private depthFar: number;
  private dithering: boolean;
  // Per triangle, set by beginTriangle immediately before the loop that reads
  // them. Held rather than passed because none of the five changes across a
  // triangle's pixels, and Rasterizer walks a great many of those.
  private request: RasterFillRequest | null;
  private area: number;
  private v0: RasterVertex | null;
  private v1: RasterVertex | null;
  private v2: RasterVertex | null;

  constructor(textures: TexturePixelCache) {
    this.textures = textures;
    this.shaded = [0, 0, 0, 1];
    this.depthNear = 0;
    this.depthFar = 0;
    this.dithering = false;
    this.request = null;
    this.area = 0;
    this.v0 = null;
    this.v1 = null;
    this.v2 = null;
  }

  public setDepthRange(near: number, far: number) {
    this.depthNear = near;
    this.depthFar = far;
  }

  public setDither(on: boolean) {
    this.dithering = on;
  }

  public beginTriangle(request: RasterFillRequest, area: number) {
    this.request = request;
    this.area = area;
    this.v0 = request.vertices[0];
    this.v1 = request.vertices[1];
    this.v2 = request.vertices[2];
  }

  // x and y are the pixel's own buffer coordinates, read only by the dither
  // offset; weights and invD are what the caller already computed to place and
  // depth-test the pixel, handed on rather than derived twice.
  //
  // The casts stand on beginTriangle having run — Rasterizer calls it once per
  // triangle, before the loop, and there is no other caller.
  public shade(x: number, y: number, weights: EdgeWeights, invD: number): RGBA {
    const request = this.request as RasterFillRequest;

    if (request.shading === "DEPTH") {
      // The buffer holds 1/d because that is what interpolates linearly in
      // screen space; the ramp is linear in d, so the reciprocal is undone here
      // rather than the buffer storing something the depth test cannot use.
      const level = depthLevel(1 / invD, this.depthNear, this.depthFar);

      this.shaded[0] = level;
      this.shaded[1] = level;
      this.shaded[2] = level;

      return this.quantised(x, y);
    }

    // The E3b path, unchanged and by reference: one colour for the whole
    // triangle, its fog already blended in, nothing computed per pixel — and
    // therefore nothing for the dither pass to attach to. See the header.
    if (request.shading === "FLAT" && !request.texture) {
      return request.flatColor as RGBA;
    }

    if (request.texture) {
      this.sampleInto(request, request.texture, weights);
    } else {
      // Non-null on every untextured request that reaches here — see the
      // invariant on RasterFillRequest.
      const flat = request.flatColor as RGBA;

      this.shaded[0] = flat[0];
      this.shaded[1] = flat[1];
      this.shaded[2] = flat[2];
    }

    if (request.shading === "GOURAUD") {
      const v0 = this.v0 as RasterVertex;
      const v1 = this.v1 as RasterVertex;
      const v2 = this.v2 as RasterVertex;
      const shade = interpolate(weights, this.area, v0.shade, v1.shade, v2.shade);

      this.shaded[0] *= shade;
      this.shaded[1] *= shade;
      this.shaded[2] *= shade;
    }

    if (request.fogVeil) {
      this.veil(request.fogVeil);
    }

    return this.quantised(x, y);
  }

  private sampleInto(request: RasterFillRequest, texture: RasterTexture, weights: EdgeWeights) {
    const v0 = this.v0 as RasterVertex;
    const v1 = this.v1 as RasterVertex;
    const v2 = this.v2 as RasterVertex;
    const decoded = this.textures.get(texture.key, texture.image);
    const u = interpolate(weights, this.area, v0.u, v1.u, v2.u) * texture.uvScale;
    const v = interpolate(weights, this.area, v0.v, v1.v, v2.v) * texture.uvScale;
    const texel = sampleTexel(decoded.pixels, decoded.width, decoded.height, u, v);

    this.shaded[0] = texel.r;
    this.shaded[1] = texel.g;
    this.shaded[2] = texel.b;

    // The flat path's own shade, as a wash: a texel cannot be modulated by a
    // canvas fill, so E3a darkens a textured face with a black overlay and this
    // reproduces it per pixel. GOURAUD sends none — its multiply above is the
    // better answer to the same question, and applying both would shade twice.
    if (request.textureWash) {
      this.veil(request.textureWash);
    }
  }

  // The one exit every computed colour takes, so the dither pass attaches in one
  // place rather than at each branch that might have been the last one. In place
  // on the scratch tuple, for the same reason nothing else here allocates, and
  // the Bayer offset is looked up once for all three channels because it is a
  // property of where the pixel is rather than of which channel it is quantising.
  private quantised(x: number, y: number): RGBA {
    if (this.dithering) {
      const bias = ditherBias(x, y);

      this.shaded[0] = ditherChannel(this.shaded[0], bias);
      this.shaded[1] = ditherChannel(this.shaded[1], bias);
      this.shaded[2] = ditherChannel(this.shaded[2], bias);
    }

    return this.shaded;
  }

  private veil(over: RGBA) {
    const alpha = over[3];
    const inverse = 1 - alpha;

    this.shaded[0] = over[0] * alpha + this.shaded[0] * inverse;
    this.shaded[1] = over[1] * alpha + this.shaded[1] * inverse;
    this.shaded[2] = over[2] * alpha + this.shaded[2] * inverse;
  }
}

export default PixelShader;
