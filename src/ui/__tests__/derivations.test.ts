// The two standalone derivations the console prints in more than one place.
//
// Both are cheap to re-derive at a call site, which is exactly the risk: the
// status bar, the viewport HUD and the shape info panel all print the material
// word, and the scene graph and the status bar both print the row id. A second
// copy of either derivation is how two surfaces start disagreeing about the same
// shape, so these run against the real registry entries rather than fixtures.

import cube from "@data/shapes/cube";
import pyramid from "@data/shapes/pyramid";
import { DEFAULT_MESH_MATERIAL } from "@rendering/material";
import MaterialSummary from "@ui/MaterialSummary";
import { sceneObjectId } from "@ui/sceneObjectId";
import { describe, expect, it } from "vitest";

import type { Object3D } from "@data/types";

const AUTHORED = DEFAULT_MESH_MATERIAL;
const SOLID = { ...DEFAULT_MESH_MATERIAL, mode: "solid" as const };
const CHECKER = { ...DEFAULT_MESH_MATERIAL, mode: "checker" as const };
const UV_GRID = { ...DEFAULT_MESH_MATERIAL, mode: "uvGrid" as const };

describe("MaterialSummary", () => {
  it("reads the cube as textured and the pyramid as solid", () => {
    expect(new MaterialSummary(cube, AUTHORED).label).toBe("TEXTURED");
    expect(new MaterialSummary(pyramid, AUTHORED).label).toBe("SOLID");
  });

  // The cube's two textured faces are subdivided into a 14x14 grid each, so the
  // keys arrive several hundred times over and the panel needs them once.
  it("lists each texture key once, in the order the faces declare them", () => {
    expect(new MaterialSummary(cube, AUTHORED).textureKeys).toEqual(["galaxy", "dog"]);
    expect(new MaterialSummary(pyramid, AUTHORED).textureKeys).toEqual([]);
  });

  // The runtime half of the derivation, and the case the console gets wrong if
  // this class only ever reads geometry: SOLID overrides the cube's two textured
  // faces, so the panel, the HUD chip and the status bar must all stop calling
  // it textured in the same click.
  it("reports a solid mesh as solid even when the shape authors textures", () => {
    const material = new MaterialSummary(cube, SOLID);

    expect(material.label).toBe("SOLID");
    expect(material.textureKeys).toEqual([]);
  });

  it("returns to the authored answer when the mode does", () => {
    expect(new MaterialSummary(cube, AUTHORED).label).toBe("TEXTURED");
  });

  // The two words the console could not say until E4b generated the textures
  // behind them. They are a property of the material, not of the shape, so the
  // pyramid — which authors no texture at all — reports them too.
  it("names the generated texture in the two procedural modes, on any shape", () => {
    expect(new MaterialSummary(cube, CHECKER).label).toBe("CHECKER");
    expect(new MaterialSummary(pyramid, CHECKER).label).toBe("CHECKER");
    expect(new MaterialSummary(pyramid, UV_GRID).label).toBe("UV GRID");
  });

  // SHAPE INFO prints the key list rather than the label, so the two have to
  // agree: a mesh the bar calls CHECKER samples exactly one texture, and it is
  // not the two the cube authored.
  it("lists the generated key alone, replacing the ones the shape authored", () => {
    expect(new MaterialSummary(cube, CHECKER).textureKeys).toEqual(["checker"]);
    expect(new MaterialSummary(cube, UV_GRID).textureKeys).toEqual(["uvGrid"]);
  });

  // The whole reason this is a class: one pipeline behind both readings, and a
  // list no caller can reorder under the panel that is about to print it.
  it("derives once and hands out a list that cannot be mutated", () => {
    const material = new MaterialSummary(cube, AUTHORED);

    expect(material.textureKeys).toBe(material.textureKeys);
    expect(Object.isFrozen(material.textureKeys)).toBe(true);
    expect(() => (material.textureKeys as string[]).sort()).toThrow(TypeError);
    expect(material.label).toBe("TEXTURED");
  });

  // Nothing here runs under strictNullChecks, so a fourth slot that is missing
  // or not a string is a runtime possibility rather than a compile error. The
  // type predicate has to keep behaving exactly as the old `typeof` filter did.
  it("ignores a fourth slot that is missing or not a texture key", () => {
    const malformed = {
      points: [],
      triangles: [
        [0, 1, 2, undefined],
        [0, 1, 2, "rgba(0, 0, 0, 1)"],
        [0, 1, 2, 42],
      ],
    } as unknown as Object3D;

    const material = new MaterialSummary(malformed, AUTHORED);

    expect(material.textureKeys).toEqual([]);
    expect(material.label).toBe("SOLID");
  });
});

describe("sceneObjectId", () => {
  it("splits a camelCase key into an upper snake-case row id", () => {
    expect(sceneObjectId("torusKnot")).toBe("TORUS_KNOT_01");
    expect(sceneObjectId("kisRhombicDodecahedron")).toBe("KIS_RHOMBIC_DODECAHEDRON_01");
  });

  it("leaves a single-word key alone", () => {
    expect(sceneObjectId("cube")).toBe("CUBE_01");
  });
});
