// Distance fog: how much of the background has replaced a surface, and the veil
// that says so.
//
// The class half of the pair fogCurve.ts opens, and shaped like Lighting for the
// same reasons. It holds the two values the FOG slider and the SKY DOME toggle
// write, plus the camera the curve is measured against, so the three consumers —
// the mesh, the checker floor and the grid — ask one object rather than each
// keeping its own copy of the amount, the colour and the near edge.
//
// One instance for the whole frame. Main builds it, the render options carry it
// to Triangle and the background request carries it to the ground layers, which
// is what makes a shape and the floor it stands on fog by one curve rather than
// by two that happen to agree.
//
// The veil strings are memoised on the quantised factor, the arrangement
// ShadeCache already argues for at length: building one per drawn triangle per
// frame is 8008 allocations a frame on the torus knot, and 64 steps is finer
// than the eye resolves across a single flat-shaded face.

import { parseCssColor } from "@rendering/cssColor";
import { FOG_THRESHOLD, fogColor, fogFactor } from "@rendering/fogCurve";

import type { RGBA } from "@rendering/cssColor";

export interface FogValues {
  // The FOG slider, 0..100 as the row prints it.
  amount: number;
  // SKY DOME. What the fog fades toward has to be what the frame fades toward,
  // and that is the only thing this toggle changes here.
  skyEnabled: boolean;
}

const PERCENT = 100;
const FOG_STEPS = 64;
const ALPHA_DIGITS = 4;

// Both colours fogCurve can return are compile-time hex constants, so the parse
// below cannot fail. The fallback is what keeps that a fact rather than an
// assumption — and it is white, the one veil that darkens nothing.
const UNPARSED: RGBA = [255, 255, 255, 1];

class Fog {
  private readonly veils: (string | undefined)[];
  private channels: RGBA;
  private amount: number;
  private near: number;
  private eyeDistance: number;
  // Bumped once per setValues call (E3b/COS-242) — never by setCamera, which
  // runs every frame while the loop is playing. Surface3D's background
  // snapshot depends on the FOG slider and the SKY DOME toggle, not on the
  // camera distance a mesh happens to sit at, so this is the cheap signal it
  // reads rather than re-deriving a hash of this class's private state.
  private changeCount: number;

  constructor(values: FogValues) {
    this.veils = [];
    this.channels = parseCssColor(fogColor(values.skyEnabled)) ?? UNPARSED;
    this.amount = values.amount / PERCENT;
    this.near = 0;
    this.eyeDistance = 0;
    this.changeCount = 0;
  }

  // Lets a caller skip the whole fog path rather than calling into it once per
  // cell and once per line to be told zero every time. FOG ships at 0, so this
  // is the default frame's answer and the one worth making cheap.
  public get isClear(): boolean {
    return this.amount <= 0;
  }

  public get version(): number {
    return this.changeCount;
  }

  public setValues(values: FogValues) {
    this.channels = parseCssColor(fogColor(values.skyEnabled)) ?? UNPARSED;
    this.amount = values.amount / PERCENT;
    // The veils are keyed on the factor alone, so a colour change is the one
    // thing that can make a cached string wrong. The amount cannot: it moves
    // which slots get asked for, never what a slot means.
    this.veils.length = 0;
    this.changeCount += 1;
  }

  // Called from Surface3D, which is where both numbers already are: it folds the
  // scene radius over the renderables for E6's depth bins and holds the camera
  // the bins are centred on. The near edge is the front of the subject rather
  // than the front of the view volume, so the shape's own near side reads
  // unfogged and FOG describes a distance instead of tinting everything evenly.
  public setCamera(eyeDistance: number, sceneRadius: number) {
    this.eyeDistance = eyeDistance;
    this.near = eyeDistance - sceneRadius;
  }

  // The mesh's frame: a triangle's own mean z, which is the depth the painter's
  // sort already computed. The eye distance is added here rather than threaded
  // through the render options, because this class holds it and Triangle does
  // not. Null below the threshold, which is both the commonest answer and the
  // one where a second fill would submit a transparent path to the canvas.
  public meshOverlay(z: number): string | null {
    // The clear case is the default frame's, and it runs 3775 times on the torus
    // knot: one field compare rather than the curve, the threshold test and two
    // calls to reach the same null.
    if (this.isClear) {
      return null;
    }

    return this.veilFor(fogFactor(this.eyeDistance + z, this.near, this.amount));
  }

  // The ground's frame: GroundProjection.depthAt already returns the projection
  // denominator, so no eye distance is added. Returns the share of a layer's own
  // alpha that survives — the floor and the grid fade toward the sky behind them
  // rather than being painted over, which at the horizon is the same colour and
  // one fewer pass.
  public groundAlpha(depth: number): number {
    return 1 - fogFactor(depth, this.near, this.amount);
  }

  private veilFor(factor: number): string | null {
    if (factor < FOG_THRESHOLD) {
      return null;
    }

    const step = Math.min(FOG_STEPS, Math.round(factor * FOG_STEPS));
    const cached = this.veils[step];

    if (cached !== undefined) {
      return cached;
    }

    // Built from the quantised value, never the raw one: the string has to be
    // the colour its slot claims to hold, or the second triangle to land in a
    // slot would be painted the first one's density.
    const alpha = (step / FOG_STEPS).toFixed(ALPHA_DIGITS);
    const built = `rgba(${this.channels[0]}, ${this.channels[1]}, ${this.channels[2]}, ${alpha})`;

    this.veils[step] = built;

    return built;
  }
}

export default Fog;
