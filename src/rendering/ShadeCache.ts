// Shaded colour strings, memoised on the quantised light rather than on the
// triangle that asked for one.
//
// That is the whole idea. A shaded colour is a pure function of (fill, shade
// step, specular step), so nothing here ever goes stale: moving a LIGHTING
// slider or orbiting the camera changes which slots get hit, never what a slot
// means, and there is no invalidation path for a later ticket to forget to call.
// Caching per triangle would have needed one, and would have held one string per
// triangle rather than one per distinct colour.
//
// Two levels, not one string key. Building `${fill}|${shade}|${spec}` to look
// something up would allocate a string per triangle per frame — 7920 of them on
// the torus knot — to avoid allocating a string per triangle per frame. A Map
// hit on a string the caller already holds, then an integer index into a plain
// array, allocates nothing at all.
//
// This class owns the quantisation resolution because the resolution IS the
// table's dimensions; Lighting imports the two step counts rather than declaring
// its own, so the index arithmetic here and the rounding there cannot drift.

import { formatRgba } from "@rendering/cssColor";

import type { RGBA } from "@rendering/cssColor";

// 64 diffuse steps is about a quarter of a channel at full brightness — finer
// than the eye resolves across a flat-shaded face, and it bounds the table. 16
// is enough for the specular: a 32-exponent highlight is a narrow band that is
// either on a face or not, and it rides on top of a colour the diffuse term has
// already placed.
export const SHADE_STEPS = 64;
export const SPECULAR_STEPS = 16;

const SPECULAR_SLOTS = SPECULAR_STEPS + 1;
const CHANNEL_MAX = 255;
const ALPHA_DIGITS = 4;

const shadeChannel = (channel: number, shade: number, highlight: number): number =>
  Math.min(CHANNEL_MAX, Math.round(channel * shade + highlight));

class ShadeCache {
  private readonly fills: Map<string, (string | undefined)[]>;
  private readonly rgbaFills: Map<string, (RGBA | undefined)[]>;
  private readonly overlays: (string | undefined)[];

  constructor() {
    this.fills = new Map();
    this.rgbaFills = new Map();
    this.overlays = [];
  }

  // Four positional arguments on the per-triangle path, the same trade
  // Triangle.render and Lighting.fillFor make: an options literal here would be
  // one object per drawn triangle per frame, which is the allocation this class
  // exists to remove.
  public fillFor(fill: string, rgba: RGBA, shadeStep: number, specularStep: number): string {
    const slots = this.slotsFor(fill);
    const slot = shadeStep * SPECULAR_SLOTS + specularStep;
    const cached = slots[slot];

    if (cached !== undefined) {
      return cached;
    }

    const built = formatRgba(this.shadedRgba(rgba, shadeStep, specularStep));
    slots[slot] = built;

    return built;
  }

  // fillFor's numeric twin, for the rasteriser (E3b/COS-242): the same cache
  // key and quantisation, minus the formatRgba call at the end — a triangle
  // that fills 900 pixels needs three numbers per pixel, not a string parsed
  // back apart 900 times.
  public rgbaFor(fill: string, rgba: RGBA, shadeStep: number, specularStep: number): RGBA {
    const slots = this.rgbaSlotsFor(fill);
    const slot = shadeStep * SPECULAR_SLOTS + specularStep;
    const cached = slots[slot];

    if (cached !== undefined) {
      return cached;
    }

    const built = this.shadedRgba(rgba, shadeStep, specularStep);
    slots[slot] = built;

    return built;
  }

  // The black wash a textured face is darkened by. Null at full brightness,
  // which is both the commonest case and the one where painting a
  // fully-transparent rectangle would be pure waste.
  public overlayFor(shadeStep: number): string | null {
    if (shadeStep >= SHADE_STEPS) {
      return null;
    }

    const cached = this.overlays[shadeStep];

    if (cached !== undefined) {
      return cached;
    }

    const alpha = (SHADE_STEPS - shadeStep) / SHADE_STEPS;
    const built = `rgba(0, 0, 0, ${alpha.toFixed(ALPHA_DIGITS)})`;
    this.overlays[shadeStep] = built;

    return built;
  }

  // Built from the quantised values, never the raw ones. The tuple has to be
  // the colour its slot claims to hold, or the second triangle to land in a slot
  // would be painted the first one's shade.
  private shadedRgba(rgba: RGBA, shadeStep: number, specularStep: number): RGBA {
    const shade = shadeStep / SHADE_STEPS;
    const highlight = (specularStep / SPECULAR_STEPS) * CHANNEL_MAX;

    return [
      shadeChannel(rgba[0], shade, highlight),
      shadeChannel(rgba[1], shade, highlight),
      shadeChannel(rgba[2], shade, highlight),
      rgba[3],
    ];
  }

  private slotsFor(fill: string): (string | undefined)[] {
    const existing = this.fills.get(fill);

    if (existing) {
      return existing;
    }

    // Sparse and grown on demand rather than sized to the full table: a frame
    // touches a band of it, not the whole of it, and most shapes carry between
    // two and six distinct colours.
    const slots: (string | undefined)[] = [];
    this.fills.set(fill, slots);

    return slots;
  }

  private rgbaSlotsFor(fill: string): (RGBA | undefined)[] {
    const existing = this.rgbaFills.get(fill);

    if (existing) {
      return existing;
    }

    const slots: (RGBA | undefined)[] = [];
    this.rgbaFills.set(fill, slots);

    return slots;
  }
}

export default ShadeCache;
