// The fog curve and the class that holds it, asserted at the depths that decide
// what the frame looks like: the near edge of the subject, the far rim of the
// ground, and the amount the console ships at.
//
// The curve is the half worth pinning. It is what three consumers share, so a
// change to the falloff or to where the medium starts moves the mesh, the floor
// and the grid at once — and the one thing this epic will not accept is the
// default frame moving, which is the first assertion below.

import Fog from "@rendering/Fog";
import { FOG_FALLOFF, FOG_THRESHOLD, fogColor, fogFactor } from "@rendering/fogCurve";
import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";
import { chartTokens } from "@ui/chartTokens";
import { describe, expect, it } from "vitest";

const EYE_DISTANCE = 1000;
const SCENE_RADIUS = 100;
const NEAR = EYE_DISTANCE - SCENE_RADIUS;

const fogOf = (amount: number, skyEnabled = true) => {
  const fog = new Fog({ amount, skyEnabled });

  fog.setCamera(EYE_DISTANCE, SCENE_RADIUS);

  return fog;
};

// The veil's alpha, back out of the rgba() string, so a test can assert a
// density rather than a formatting choice.
const alphaOf = (veil: string | null): number => Number(/,\s*([\d.]+)\)$/.exec(veil ?? "")?.[1] ?? 0);

describe("the fog curve", () => {
  it("is exactly zero at every depth while the amount is zero", () => {
    expect(fogFactor(NEAR, NEAR, 0)).toBe(0);
    expect(fogFactor(EYE_DISTANCE, NEAR, 0)).toBe(0);
    expect(fogFactor(100000, NEAR, 0)).toBe(0);
  });

  // The near edge is the front of the subject, not the front of the view volume.
  // Anything at or in front of it is untouched, which is what keeps FOG reading
  // as a distance rather than as a tint over the whole shape.
  it("leaves everything at or in front of the near edge alone", () => {
    expect(fogFactor(NEAR, NEAR, 1)).toBe(0);
    expect(fogFactor(NEAR - 1, NEAR, 1)).toBe(0);
    expect(fogFactor(0, NEAR, 1)).toBe(0);
  });

  // Never quite total, anywhere the scene reaches. exp() does underflow to zero
  // eventually — past about 6.7 km, which is beyond the ground's own 60 m rim by
  // two orders of magnitude — so this is a claim about the console rather than
  // about the exponential.
  it("hides 63% of what is behind it over one falloff, and approaches the amount without reaching it", () => {
    expect(fogFactor(NEAR + FOG_FALLOFF, NEAR, 1)).toBeCloseTo(1 - Math.exp(-1), 10);
    expect(fogFactor(NEAR + 4 * FOG_FALLOFF, NEAR, 1)).toBeCloseTo(1 - Math.exp(-4), 10);
    expect(fogFactor(NEAR + metresToUnits(GROUND_DEPTH_METRES), NEAR, 1)).toBeLessThan(1);
  });

  it("scales linearly with the amount at any one depth", () => {
    const full = fogFactor(NEAR + FOG_FALLOFF, NEAR, 1);

    expect(fogFactor(NEAR + FOG_FALLOFF, NEAR, 0.5)).toBeCloseTo(full / 2, 12);
    expect(fogFactor(NEAR + FOG_FALLOFF, NEAR, 0.18)).toBeCloseTo(full * 0.18, 12);
  });

  // The falloff is tuned against the ground rather than against the shape: the
  // rim of the floor has to read as fully fogged at FOG 100, or the sheet ends
  // in a visible edge instead of dissolving into the horizon.
  it("takes the far rim of the ground to near-total occlusion at full strength", () => {
    expect(fogFactor(NEAR + metresToUnits(GROUND_DEPTH_METRES), NEAR, 1)).toBeGreaterThan(0.99);
  });

  it("fades toward the horizon with the sky up and toward the app background without it", () => {
    expect(fogColor(true)).not.toBe(fogColor(false));
    expect(fogColor(false)).toBe(chartTokens.bgApp);
  });
});

describe("the fog a mesh is veiled by", () => {
  it("veils nothing at all while FOG is 0", () => {
    const fog = fogOf(0);

    expect(fog.isClear).toBe(true);
    expect(fog.meshOverlay(0)).toBeNull();
    expect(fog.meshOverlay(SCENE_RADIUS)).toBeNull();
    expect(fog.groundAlpha(NEAR + FOG_FALLOFF)).toBe(1);
  });

  // z is the triangle's own mean depth, so the eye distance is the class's to
  // add. A face at the subject's near edge sits exactly on the near plane and
  // must come back unfogged even at full strength.
  it("adds the eye distance to a triangle's own z", () => {
    const fog = fogOf(100);

    expect(fog.meshOverlay(-SCENE_RADIUS)).toBeNull();
    expect(alphaOf(fog.meshOverlay(SCENE_RADIUS))).toBeGreaterThan(0);
    expect(alphaOf(fog.meshOverlay(4 * FOG_FALLOFF))).toBeGreaterThan(alphaOf(fog.meshOverlay(FOG_FALLOFF)));
  });

  it("returns nothing below the threshold rather than a transparent fill", () => {
    const fog = fogOf(100);
    const justUnder = NEAR + FOG_FALLOFF * -Math.log(1 - FOG_THRESHOLD / 2);

    expect(fogFactor(justUnder, NEAR, 1)).toBeLessThan(FOG_THRESHOLD);
    expect(fog.meshOverlay(justUnder - EYE_DISTANCE)).toBeNull();
  });

  // Memoised on the quantised factor, so two triangles at the same density get
  // the same string object rather than two equal ones.
  it("hands back one veil per density instead of one per triangle", () => {
    const fog = fogOf(100);
    const z = 2 * FOG_FALLOFF;

    expect(fog.meshOverlay(z)).toBe(fog.meshOverlay(z));
  });

  // The amount moves which slots are asked for; the colour changes what a slot
  // means, and is the only thing that may invalidate one.
  it("rebuilds its veils when the sky toggle changes the colour under them", () => {
    const fog = fogOf(100);
    const lit = fog.meshOverlay(2 * FOG_FALLOFF);

    fog.setValues({ amount: 100, skyEnabled: false });

    expect(fog.meshOverlay(2 * FOG_FALLOFF)).not.toBe(lit);
  });
});

describe("the fog the ground fades under", () => {
  it("reads the projection denominator directly, with no eye distance added", () => {
    const fog = fogOf(100);

    expect(fog.groundAlpha(NEAR)).toBe(1);
    expect(fog.groundAlpha(NEAR + FOG_FALLOFF)).toBeCloseTo(Math.exp(-1), 10);
  });

  it("survives less of a layer the further away it is, and never goes negative", () => {
    const fog = fogOf(100);

    expect(fog.groundAlpha(NEAR + 4 * FOG_FALLOFF)).toBeLessThan(fog.groundAlpha(NEAR + FOG_FALLOFF));
    expect(fog.groundAlpha(NEAR + metresToUnits(GROUND_DEPTH_METRES))).toBeGreaterThan(0);
  });

  // Halving the slider halves the occlusion at every depth, which is what makes
  // the row a percentage rather than a curve number.
  it("keeps a partial amount partial", () => {
    const half = fogOf(50).groundAlpha(NEAR + FOG_FALLOFF);
    const full = fogOf(100).groundAlpha(NEAR + FOG_FALLOFF);

    expect(1 - half).toBeCloseTo((1 - full) / 2, 12);
  });
});
