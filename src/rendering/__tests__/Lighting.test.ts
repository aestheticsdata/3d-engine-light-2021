// The key light, on faces whose normals are known by construction.
//
// Two triangles carry the whole file. FACING_EYE lies in the z = 0 plane with an
// outward normal of (0, 0, -1) — straight back at an eye that sits at negative z
// — and EDGE_ON has a normal of (-1, 0, 0), perpendicular to it. With the light
// pointed down -z as well, the first is fully lit and the second gets ambient
// and nothing else, so every term below can be read off without trusting a
// second piece of arithmetic to set the scene up.
//
// The normals are stated rather than derived here because the derivation is
// tested where it belongs: projection.test.ts asserts that the sign convention
// this class uses is the same one Triangle.isFrontFacing already culled by.

import Camera from "@primitives/Camera";
import Point3D from "@primitives/Point3D";
import RenderTarget from "@primitives/RenderTarget";
import { parseCssColor } from "@rendering/cssColor";
import Lighting from "@rendering/Lighting";
import { describe, expect, it } from "vitest";

import type { LightingValues } from "@rendering/Lighting";
import type { ResolvedMaterial } from "@rendering/material";

const EYE_DISTANCE = 1000;

const IDENTITY = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

// Azimuth 90 with no elevation points the light down -z, straight at the eye.
const HEADLIGHT: LightingValues = { azimuth: 90, elevation: 0, ambient: 0, specular: 0, enabled: true };

const target = new RenderTarget({ width: 1024, height: 640 });
const camera = new Camera({ focal: 300, magnification: 1 });

const at = (x: number, y: number, z: number) => new Point3D(x, y, z, target, camera);

// Outward normal (0, 0, -1): toward the eye, fully facing the headlight.
const FACING_EYE = [at(0, 0, 0), at(1, 0, 0), at(0, 1, 0)] as const;
// Outward normal (-1, 0, 0): perpendicular to it, so the diffuse term is zero.
const EDGE_ON = [at(0, 0, 0), at(0, 1, 0), at(0, 0, 1)] as const;
const DEGENERATE = [at(0, 0, 0), at(0, 0, 0), at(0, 0, 0)] as const;

// uvScale is on every fixture below and read by none of them: it is the texture
// path's field (E4b/COS-245), and the light never sees a UV. Stated once here
// rather than explained four times.
const ORANGE: ResolvedMaterial = {
  fill: "rgba(200, 100, 40, 1)",
  rgba: [200, 100, 40, 1],
  textureKey: null,
  uvScale: 1,
};
const TEXTURED: ResolvedMaterial = { fill: "dog", rgba: null, textureKey: "dog", uvScale: 1 };

const lightingOf = (patch: Partial<LightingValues> = {}) => {
  const lighting = new Lighting({ ...HEADLIGHT, ...patch });

  lighting.setCamera(IDENTITY, EYE_DISTANCE);

  return lighting;
};

const fill = (lighting: Lighting, face: readonly Point3D[], material = ORANGE) =>
  lighting.fillFor(material, face[0], face[1], face[2]);

describe("Lighting diffuse", () => {
  it("leaves a fully lit face at its own colour and takes an unlit one down to ambient", () => {
    const lighting = lightingOf({ ambient: 0 });

    expect(fill(lighting, FACING_EYE)).toBe("rgba(200, 100, 40, 1)");
    expect(fill(lighting, EDGE_ON)).toBe("rgba(0, 0, 0, 1)");
  });

  it("lifts the floor to the ambient term without touching the fully lit face", () => {
    const lighting = lightingOf({ ambient: 50 });

    expect(fill(lighting, FACING_EYE)).toBe("rgba(200, 100, 40, 1)");
    expect(fill(lighting, EDGE_ON)).toBe("rgba(100, 50, 20, 1)");
  });

  // The acceptance criterion, verbatim: AMBIENT at 100 flattens shading
  // completely. Two faces at right angles must come out the same colour, and it
  // must be the authored one rather than a dimmed version of it.
  it("flattens every face to its authored colour at ambient 100", () => {
    const lighting = lightingOf({ ambient: 100 });

    expect(fill(lighting, FACING_EYE)).toBe("rgba(200, 100, 40, 1)");
    expect(fill(lighting, EDGE_ON)).toBe("rgba(200, 100, 40, 1)");
  });

  // Hiding the KEY_LIGHT row. Both faces fall to ambient, including the one
  // pointing straight at where the light used to be.
  it("drops to ambient everywhere when the light is disabled", () => {
    const lighting = lightingOf({ ambient: 50, specular: 100, enabled: false });

    expect(fill(lighting, FACING_EYE)).toBe("rgba(100, 50, 20, 1)");
    expect(fill(lighting, EDGE_ON)).toBe("rgba(100, 50, 20, 1)");
  });

  it("follows the light around rather than the face", () => {
    const lighting = lightingOf({ ambient: 0 });
    const lit = fill(lighting, FACING_EYE);

    // Swung a quarter turn away, so the headlight now grazes the same face.
    lighting.setValues({ ...HEADLIGHT, ambient: 0, azimuth: 0 });

    expect(fill(lighting, FACING_EYE)).toBe("rgba(0, 0, 0, 1)");
    expect(lit).toBe("rgba(200, 100, 40, 1)");
  });
});

describe("Lighting specular", () => {
  it("adds no highlight at specular 0", () => {
    expect(fill(lightingOf({ ambient: 0, specular: 0 }), FACING_EYE)).toBe("rgba(200, 100, 40, 1)");
  });

  // The face is normal to both the light and the view, so the half vector lands
  // on the normal and the highlight is at its maximum — which at full strength
  // is enough to take every channel to white.
  it("blows a mirror-aligned face out to white at specular 100", () => {
    expect(fill(lightingOf({ ambient: 0, specular: 100 }), FACING_EYE)).toBe("rgba(255, 255, 255, 1)");
  });

  it("places no highlight on a face turned away from the light", () => {
    expect(fill(lightingOf({ ambient: 50, specular: 100 }), EDGE_ON)).toBe("rgba(100, 50, 20, 1)");
  });
});

describe("Lighting fallbacks", () => {
  // The sphere's poles, which are thirteen coincident points each. A NaN written
  // into a colour string paints nothing and shows up in no stack trace.
  it("hands back the unlit fill for a face with no area", () => {
    expect(fill(lightingOf({ ambient: 0 }), DEGENERATE)).toBe("rgba(200, 100, 40, 1)");
  });

  it("hands back the unlit fill for a texture key, without computing a normal", () => {
    expect(fill(lightingOf({ ambient: 0 }), FACING_EYE, TEXTURED)).toBe("dog");
  });

  it("hands back the unlit fill for a colour cssColor could not read", () => {
    const unreadable: ResolvedMaterial = { fill: "hsl(200 50% 40%)", rgba: null, textureKey: null, uvScale: 1 };

    expect(fill(lightingOf({ ambient: 0 }), FACING_EYE, unreadable)).toBe("hsl(200 50% 40%)");
  });
});

describe("Lighting cache", () => {
  // Identity, not equality. Two triangles at the same shade must get the same
  // string OBJECT back, because a cache that returns an equal-but-fresh string
  // has allocated one per triangle per frame and bought nothing.
  it("returns the same string instance for two faces at the same shade", () => {
    const lighting = lightingOf({ ambient: 30 });

    expect(fill(lighting, FACING_EYE)).toBe(fill(lighting, FACING_EYE));
  });

  it("keeps two colours at the same shade apart", () => {
    const lighting = lightingOf({ ambient: 30 });
    const blue: ResolvedMaterial = { fill: "rgba(0, 89, 150, 1)", rgba: [0, 89, 150, 1], textureKey: null, uvScale: 1 };

    expect(fill(lighting, EDGE_ON)).not.toBe(fill(lighting, EDGE_ON, blue));
  });

  // The slot is what a colour is keyed by, so a slider that changes which slot a
  // face lands in must change the colour it comes out. This is the case a cache
  // keyed on the triangle would get wrong.
  it("follows the ambient slider rather than serving the first answer forever", () => {
    const lighting = lightingOf({ ambient: 0 });
    const dark = fill(lighting, EDGE_ON);

    lighting.setValues({ ...HEADLIGHT, ambient: 100 });

    expect(dark).toBe("rgba(0, 0, 0, 1)");
    expect(fill(lighting, EDGE_ON)).toBe("rgba(200, 100, 40, 1)");
  });
});

describe("Lighting texture overlay", () => {
  it("asks for no wash on a fully lit face", () => {
    expect(lightingOf({ ambient: 0 }).overlayFor(...FACING_EYE)).toBeNull();
    expect(lightingOf({ ambient: 100 }).overlayFor(...EDGE_ON)).toBeNull();
  });

  it("washes an unlit face to black and a half-lit one halfway", () => {
    expect(lightingOf({ ambient: 0 }).overlayFor(...EDGE_ON)).toBe("rgba(0, 0, 0, 1.0000)");
    expect(lightingOf({ ambient: 50 }).overlayFor(...EDGE_ON)).toBe("rgba(0, 0, 0, 0.5000)");
  });

  it("asks for no wash on a face with no area", () => {
    expect(lightingOf({ ambient: 0 }).overlayFor(...DEGENERATE)).toBeNull();
  });
});

describe("Lighting.fillRgba", () => {
  it("agrees exactly with fillFor's own string, parsed back apart, for a lit face", () => {
    const css = lightingOf().fillFor(ORANGE, ...FACING_EYE);
    const rgba = lightingOf().fillRgba(ORANGE, ...FACING_EYE);

    expect(rgba).toEqual(parseCssColor(css));
  });

  it("returns the authored colour unchanged for a degenerate face, same as fillFor", () => {
    expect(lightingOf().fillRgba(ORANGE, ...DEGENERATE)).toEqual(ORANGE.rgba);
  });

  it("falls back to white for a texture-keyed material with no rgba", () => {
    expect(lightingOf().fillRgba(TEXTURED, ...FACING_EYE)).toEqual([255, 255, 255, 1]);
  });
});
