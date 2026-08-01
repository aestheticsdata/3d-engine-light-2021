// The two standalone derivations the console prints in more than one place.
//
// Both are cheap to re-derive at a call site, which is exactly the risk: the
// status bar, the viewport HUD and the shape info panel all print the material
// word, and the scene graph and the status bar both print the row id. A second
// copy of either derivation is how two surfaces start disagreeing about the same
// shape, so these run against the real registry entries rather than fixtures.

import { describe, expect, it } from "vitest";

import cube from "@data/shapes/cube";
import pyramid from "@data/shapes/pyramid";
import { texLabel, textureKeys } from "@ui/texLabel";
import { sceneObjectId } from "@ui/sceneObjectId";

describe("texLabel", () => {
  it("reads the cube as textured and the pyramid as solid", () => {
    expect(texLabel(cube)).toBe("TEXTURED");
    expect(texLabel(pyramid)).toBe("SOLID");
  });

  // The cube's two textured faces are subdivided into a 14x14 grid each, so the
  // keys arrive several hundred times over and the panel needs them once.
  it("lists each texture key once, in the order the faces declare them", () => {
    expect(textureKeys(cube)).toEqual(["galaxy", "dog"]);
    expect(textureKeys(pyramid)).toEqual([]);
  });
});

describe("sceneObjectId", () => {
  it("splits a camelCase key into an upper snake-case row id", () => {
    expect(sceneObjectId("torusKnot")).toBe("TORUS_KNOT_01");
    expect(sceneObjectId("kisRhombicDodecahedron")).toBe(
      "KIS_RHOMBIC_DODECAHEDRON_01",
    );
  });

  it("leaves a single-word key alone", () => {
    expect(sceneObjectId("cube")).toBe("CUBE_01");
  });
});
