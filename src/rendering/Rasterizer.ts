// The depth-buffered backend's own pixel loop (E3b/COS-242): screen bounding
// box, then per candidate pixel an edge test, a depth test, and a colour asked
// of PixelShader. "Which pixels does this triangle reach, and how do they land
// in the buffer" is the whole of this class's job; "what colour is each of
// them" is PixelShader's, and E3d/COS-244 moved that half into its own file
// when the dither pass carried this one past R17's ~160 lines. Everything
// either half needs is already resolved by Triangle.rasterize() into plain
// numbers before this ever runs.
//
// E3d hung two optional passes off the loop, each behind its own PIPELINE
// toggle and each costing an off frame nothing at all. DITHERING belongs to the
// colour and lives in PixelShader. EDGE ANTIALIAS belongs to coverage and lives
// here.
//
// EDGE ANTIALIAS pays back the aliasing this backend introduced: context.fill()
// is antialiased by the browser and a hand-written rasteriser is not, so E3b
// made the frame worse in order to make it correct. The repair feathers OUTWARD
// only. A pixel whose centre lands inside the triangle is written opaque exactly
// as before; a pixel up to half a pixel outside is blended in at its own
// coverage. Feathering inward as well is the better coverage estimate and is
// deliberately not done: two triangles meeting along an interior edge would then
// each blend a partial colour into the same pixel, 0.6 over 0.6 leaves a quarter
// of the background showing, and the mesh would wear a crack along every shared
// edge — a far worse artefact than the staircase being repaired. Outward-only
// cannot crack a seam, because every pixel it touches is one the neighbouring
// triangle has already written opaque.
//
// A feathered pixel writes colour but NOT depth (see FrameBuffer.blendPixel), so
// the pass is not depth-correct at a silhouette and is not meant to be. Two
// consequences worth expecting rather than discovering: feathered pixels
// composite in submission order, which is why Mesh.renderMesh's back-to-front
// sort outlived the depth buffer; and a triangle drawn later but standing
// further away still passes the depth test at a feathered pixel and paints over
// the soft edge, because nothing claimed that pixel's depth. Both are the
// standard price of coverage blending without a coverage buffer.

import {
  edgeCoverage,
  edgeReciprocals,
  edgeWeights,
  interpolate,
  isInside,
  screenBounds,
  signedArea2,
} from "@rendering/edgeFunction";
import PixelShader from "@rendering/PixelShader";

import type { RasterVertex } from "@primitives/Triangle";
import type { RGBA } from "@rendering/cssColor";
import type FrameBuffer from "@rendering/FrameBuffer";
import type TexturePixelCache from "@rendering/TexturePixelCache";
import type { TextureSource } from "@textures/TextureRegistry";

export interface RasterTexture {
  key: string;
  image: TextureSource;
  uvScale: number;
}

// Which of the three per-pixel branches PixelShader.shade() takes. A named union
// rather than the pair of booleans this started as: two booleans are four states
// for three meanings, and the fourth — "gouraud and depth at once" — is exactly
// the unrepresentable-state problem an enum is for.
export type RasterShading = "FLAT" | "GOURAUD" | "DEPTH";

// flatColor is non-null on every untextured request except a DEPTH one, which
// returns before reading it — that is the invariant behind the one cast in
// PixelShader.shade(), and Triangle.rasterize() is the only builder that has to
// keep it. Not a discriminated union even so: the shading mode and "textured or
// not" are independent axes, GOURAUD applies to both, and four interface variants
// to spell out six combinations would be more shape than the two call sites need.
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

// The two E3d/COS-244 passes, named for the PIPELINE toggles that own them
// rather than for the fields they land in, so the one call site a frame reads as
// the pair of switches it is rather than as two bare booleans in an order. They
// arrive together and are then split apart, because only one of them is this
// class's business.
export interface RasterPasses {
  dither: boolean;
  edgeAA: boolean;
}

class Rasterizer {
  private readonly buffer: FrameBuffer;
  private readonly shader: PixelShader;
  private antialiasing: boolean;

  constructor(buffer: FrameBuffer, textures: TexturePixelCache) {
    this.buffer = buffer;
    this.shader = new PixelShader(textures);
    this.antialiasing = false;
  }

  public setDepthRange(near: number, far: number) {
    this.shader.setDepthRange(near, far);
  }

  // Per frame, beside setDepthRange and for the same reason: every triangle in
  // the frame reads both, and no triangle owns either.
  public setPasses(passes: RasterPasses) {
    this.antialiasing = passes.edgeAA;
    this.shader.setDither(passes.dither);
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

    // Folded once per triangle, and only when the pass that reads them is on:
    // three square roots each for a torus knot's 7920 triangles is not a cost to
    // pay for a switch that is off. The existing bounding box already holds every
    // pixel a half-pixel feather can reach — screenBounds floors its minimum, and
    // a pixel centre one whole pixel outside the box is more than half a pixel
    // from the nearest edge — so the outward feather visits no pixel this loop
    // was not already walking.
    const reciprocals = this.antialiasing ? edgeReciprocals(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y) : null;
    let wrote = false;

    this.shader.beginTriangle(request, area);

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const weights = edgeWeights(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, px, py);
        // Whole for every pixel the edge test itself accepted, so an interior
        // pixel never pays for a coverage estimate it already knows the answer
        // to: the feather's cost scales with a triangle's perimeter, not its area.
        let covered = 1;

        if (!isInside(weights)) {
          if (!reciprocals) {
            continue;
          }

          covered = edgeCoverage(weights, reciprocals);

          if (covered <= 0) {
            continue;
          }
        }

        const invD = interpolate(weights, area, v0.invD, v1.invD, v2.invD);

        if (!this.buffer.depthTestPasses(x, y, invD)) {
          continue;
        }

        const colour = this.shader.shade(x, y, weights, invD);

        if (covered < 1) {
          // Deliberately not counted as a write. `wrote` carries the drawn-triangle
          // contract, and a triangle too small to cover a single pixel centre must
          // not begin counting as drawn the moment EDGE ANTIALIAS goes on: a
          // rendering toggle that moves a telemetry number is precisely the
          // disagreement this console is being de-mocked to stop.
          this.buffer.blendPixel(x, y, colour[0], colour[1], colour[2], request.opacity * covered);
          continue;
        }

        this.buffer.writePixel(x, y, invD, colour[0], colour[1], colour[2], request.opacity);
        wrote = true;
      }
    }

    return wrote;
  }

  // POINTS mode's whole raster pass (E3c/COS-243): a square block around one
  // projected vertex, depth-tested per pixel like any other. It carries its own
  // colour and never reaches PixelShader — a point has no interior to shade and
  // no edge to feather, so neither E3d pass applies to it.
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
}

export default Rasterizer;
