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
  edgeFeatherReach,
  edgeReciprocals,
  edgeRowTerm,
  edgeSlope,
  edgeSpanBound,
  edgeWeightAt,
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

    // The three edge functions, split into the part that is constant for the
    // whole triangle and the part that moves (E3f/3DE-116). w0 belongs to edge
    // B→C, w1 to C→A, w2 to A→B — the same rotation the weights themselves
    // follow, and each edge's own first vertex is the origin its row term and
    // its per-pixel term are both measured from.
    //
    // This is the ticket's largest single win and the reason `raster` was 92% of
    // a heavy frame: the old loop rebuilt all three weights from the six vertex
    // coordinates at every pixel, which is five subtractions and two
    // multiplications per edge, and boxed the result in a fresh object. What is
    // left below is one subtraction and one multiplication per edge, against
    // numbers held in registers.
    const e0x = v2.x - v1.x;
    const e0y = v2.y - v1.y;
    const e1x = v0.x - v2.x;
    const e1y = v0.y - v2.y;
    const e2x = v1.x - v0.x;
    const e2y = v1.y - v0.y;
    // The three edges' slopes, folded here so the span below costs a multiply
    // and an add per row rather than a division. Three divisions a scanline was
    // measurably worse than the bounding box it replaced on a mesh of small
    // triangles — the sphere's raster went UP by a third — because a short
    // triangle pays that setup on every one of its few rows and saves almost
    // nothing per row in return.
    const s0 = edgeSlope(e0x, e0y);
    const s1 = edgeSlope(e1x, e1y);
    const s2 = edgeSlope(e2x, e2y);
    // Zero with the feather off, which is what makes the span below the plain
    // edge bound in that case rather than a special-cased one.
    const f0 = reciprocals ? edgeFeatherReach(e0y, reciprocals.r0) : 0;
    const f1 = reciprocals ? edgeFeatherReach(e1y, reciprocals.r1) : 0;
    const f2 = reciprocals ? edgeFeatherReach(e2y, reciprocals.r2) : 0;
    const width = this.buffer.bufferWidth;

    this.shader.beginTriangle(request, area);

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      const py = y + 0.5;
      const t0 = edgeRowTerm(e0x, py, v1.y);
      const t1 = edgeRowTerm(e1x, py, v2.y);
      const t2 = edgeRowTerm(e2x, py, v0.y);
      // The row's own base index, so the depth test and the write below step
      // along it instead of each recomputing y * width + x per pixel.
      const rowIndex = y * width;

      // The stretch of this row the triangle can actually reach (E3f/3DE-116).
      // A triangle covers about half its own bounding box whatever its shape, so
      // walking the box means roughly one wasted iteration per useful one — and
      // on a thin diagonal it is far worse than that.
      //
      // This only ever NARROWS the walk. Every pixel it still visits gets the
      // same isInside / coverage / depth test it always did, and the bounds are
      // rounded outward by a whole pixel so a rounding error cannot drop one the
      // old loop would have kept. That is what makes it a skip rather than a
      // second, subtly different definition of "inside" — the edge test remains
      // the only thing that decides.
      if (
        this.rowIsOutside(t0, e0y, reciprocals?.r0) ||
        this.rowIsOutside(t1, e1y, reciprocals?.r1) ||
        this.rowIsOutside(t2, e2y, reciprocals?.r2)
      ) {
        continue;
      }

      let from = bounds.minX;
      let to = bounds.maxX;

      // Each edge widened by its OWN feather reach rather than by a shared
      // margin — see edgeFeatherReach. f0/f1/f2 are zero with the pass off, so
      // this is the bare edge bound then.
      if (e0y > 0) {
        to = Math.min(to, Math.ceil(edgeSpanBound(v1.x, s0, py, v1.y) + f0));
      } else if (e0y < 0) {
        from = Math.max(from, Math.floor(edgeSpanBound(v1.x, s0, py, v1.y) - f0) - 1);
      }

      if (e1y > 0) {
        to = Math.min(to, Math.ceil(edgeSpanBound(v2.x, s1, py, v2.y) + f1));
      } else if (e1y < 0) {
        from = Math.max(from, Math.floor(edgeSpanBound(v2.x, s1, py, v2.y) - f1) - 1);
      }

      if (e2y > 0) {
        to = Math.min(to, Math.ceil(edgeSpanBound(v0.x, s2, py, v0.y) + f2));
      } else if (e2y < 0) {
        from = Math.max(from, Math.floor(edgeSpanBound(v0.x, s2, py, v0.y) - f2) - 1);
      }

      // Clamped back to the box AFTER the feather's widening, and not before it:
      // bounds.maxX can be the last column of the buffer, and a `to` one past it
      // would index the first pixel of the NEXT row — the buffer is a flat array
      // with no per-row guard, so that is a write into the wrong scanline rather
      // than an out-of-range no-op.
      const last = Math.min(to, bounds.maxX);

      for (let x = Math.max(from, bounds.minX); x <= last; x += 1) {
        const px = x + 0.5;
        const w0 = edgeWeightAt(t0, e0y, px, v1.x);
        const w1 = edgeWeightAt(t1, e1y, px, v2.x);
        const w2 = edgeWeightAt(t2, e2y, px, v0.x);
        // Whole for every pixel the edge test itself accepted, so an interior
        // pixel never pays for a coverage estimate it already knows the answer
        // to: the feather's cost scales with a triangle's perimeter, not its area.
        let covered = 1;

        if (!isInside(w0, w1, w2)) {
          if (!reciprocals) {
            continue;
          }

          covered = edgeCoverage(w0, w1, w2, reciprocals);

          if (covered <= 0) {
            continue;
          }
        }

        const index = rowIndex + x;
        const invD = interpolate(w0, w1, w2, area, v0.invD, v1.invD, v2.invD);

        if (!this.buffer.depthTestPassesAt(index, invD)) {
          continue;
        }

        const colour = this.shader.shade(x, y, w0, w1, w2, invD);

        if (covered < 1) {
          // Deliberately not counted as a write. `wrote` carries the drawn-triangle
          // contract, and a triangle too small to cover a single pixel centre must
          // not begin counting as drawn the moment EDGE ANTIALIAS goes on: a
          // rendering toggle that moves a telemetry number is precisely the
          // disagreement this console is being de-mocked to stop.
          this.buffer.blendPixelAt(index, colour[0], colour[1], colour[2], request.opacity * covered);
          continue;
        }

        this.buffer.writePixelAt(index, invD, colour[0], colour[1], colour[2], request.opacity);
        wrote = true;
      }
    }

    return wrote;
  }

  // Whether one edge puts the whole of the current scanline outside the
  // triangle. Only a horizontal edge can: any other varies along the row, and
  // the span bounds handle it.
  //
  // "Outside" means outside the EDGE with the feather off, and outside the
  // feather's own half-pixel reach with it on. An edge weight divided by its
  // edge length is the perpendicular distance — the same quantity edgeCoverage
  // reads — so the test is the distance test edgeCoverage would have applied to
  // every pixel of the row. Skipping on the bare sign instead loses the soft
  // edge along every horizontal silhouette, which is what the pixel diff against
  // master caught.
  private rowIsOutside(rowTerm: number, edgeDy: number, reciprocal: number | undefined): boolean {
    if (edgeDy !== 0) {
      return false;
    }

    return reciprocal === undefined ? rowTerm < 0 : rowTerm * reciprocal <= -0.5;
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
