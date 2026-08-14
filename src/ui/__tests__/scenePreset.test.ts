// The preset format, which is the half of E8b a walkthrough cannot check.
//
// Two things are worth pinning here and neither is visible from the console. The
// first is the round trip: SAVE PRESET and LOAD are one function apart, so a
// scene that does not survive the pair is a scene the user loses. The second is
// what happens to a file nobody wrote by hand — the format is on disk, so the
// next thing it is handed is a truncated download, an edited number or another
// app's JSON, and "leaves the scene untouched" has to be true for all three.
//
// The validator is asserted against the hostile cases rather than the happy one
// for that reason: every test below that passes garbage is a test that the
// console did NOT act on it.

import {
  PRESET_APP,
  PRESET_VERSION,
  parsePreset,
  RESERVED_PRESET_KEYS,
  sceneFileName,
  sceneSnippet,
  serialisePreset,
} from "@ui/scenePreset";
import { describe, expect, it } from "vitest";

import type { SceneSnapshot } from "@ui/scenePreset";

// A stand-in for the live console, and the reference every parse degrades
// toward. The store half deliberately carries one of each shape the validator
// distinguishes: a number, a boolean, a string union and an array.
const scene = (overrides: Partial<SceneSnapshot> = {}): SceneSnapshot => ({
  primitive: "cuboctahedron",
  wireframe: false,
  backfaceCulling: true,
  opacity: 100,
  store: {
    pitch: 0,
    spin: 24,
    sky: true,
    shadingMode: "FLAT",
    sceneHidden: [],
    // Registered like any other slice, and renderer output all the same — the
    // case the format has to special-case because the store cannot.
    drawnTriangles: 2112,
  },
  ...overrides,
});

const PRIMITIVES = ["cube", "cuboctahedron", "sphere"];

const fileFor = (state: Record<string, unknown>) => ({
  app: PRESET_APP,
  version: PRESET_VERSION,
  savedAt: "2026-08-15T00:00:00.000Z",
  state,
});

describe("serialisePreset", () => {
  it("writes the envelope the accounts epic also syncs", () => {
    const preset = serialisePreset(scene(), new Date(Date.UTC(2026, 7, 15, 12, 30)));

    expect(preset.app).toBe(PRESET_APP);
    expect(preset.version).toBe(PRESET_VERSION);
    expect(preset.savedAt).toBe("2026-08-15T12:30:00.000Z");
  });

  it("flattens the slices in beside the four values that have none", () => {
    const state = serialisePreset(scene(), new Date()).state;

    expect(state).toEqual({
      primitive: "cuboctahedron",
      wireframe: false,
      backfaceCulling: true,
      opacity: 100,
      pitch: 0,
      spin: 24,
      sky: true,
      shadingMode: "FLAT",
      sceneHidden: [],
    });
  });

  // A count the next frame overwrites is not part of the scene: two identical
  // scenes have to save as identical files, and the accounts epic must not sync
  // a triangle count between machines as though it described something.
  it("leaves renderer output out of the file", () => {
    const state = serialisePreset(scene(), new Date()).state;

    expect(state).not.toHaveProperty("drawnTriangles");
  });

  it("ignores it on the way back in too", () => {
    const parsed = parsePreset(fileFor({ drawnTriangles: 999, spin: 12 }), scene(), PRIMITIVES);

    expect(parsed?.store).toEqual({ spin: 12 });
  });

  // The four are reserved precisely because the file is flat. A slice registered
  // under one of these names would be shadowed silently, so the collision is
  // worth a failing test rather than a comment alone.
  it("keeps every reserved key in the flattened state", () => {
    const state = serialisePreset(scene(), new Date()).state;

    for (const key of RESERVED_PRESET_KEYS) {
      expect(Object.keys(state)).toContain(key);
    }
  });
});

describe("parsePreset", () => {
  it("returns the same scene it was given, through a save and a load", () => {
    const original = scene({ primitive: "sphere", wireframe: true, backfaceCulling: false, opacity: 40 });
    const preset = serialisePreset(original, new Date());

    expect(parsePreset(preset, scene(), PRIMITIVES)).toEqual({
      ...original,
      // Everything survives the round trip except the renderer output the format
      // drops on the way out; the store hands it back at its default instead.
      store: { pitch: 0, spin: 24, sky: true, shadingMode: "FLAT", sceneHidden: [] },
    });
  });

  // The two outright rejections. Everything inside `state` degrades instead, so
  // these are the only two shapes that can make LOAD do nothing at all.
  it.each([
    ["a non-object", 42],
    ["null", null],
    ["an array", []],
    ["another app's file", { ...fileFor({}), app: "not-halcyon" }],
    ["a future version", { ...fileFor({}), version: PRESET_VERSION + 1 }],
    ["a missing state", { app: PRESET_APP, version: PRESET_VERSION, savedAt: "" }],
    ["a non-object state", fileFor(null as unknown as Record<string, unknown>)],
  ])("rejects %s outright", (_label, raw) => {
    expect(parsePreset(raw, scene(), PRIMITIVES)).toBeNull();
  });

  it("falls back to the current primitive when the file names one the registry does not have", () => {
    const parsed = parsePreset(fileFor({ primitive: "dodecahedron" }), scene(), PRIMITIVES);

    expect(parsed?.primitive).toBe("cuboctahedron");
  });

  it("keeps the current value for a flag the file gets wrong", () => {
    const parsed = parsePreset(fileFor({ wireframe: "yes", backfaceCulling: 1 }), scene(), PRIMITIVES);

    expect(parsed?.wireframe).toBe(false);
    expect(parsed?.backfaceCulling).toBe(true);
  });

  it.each([
    ["above the range", 400, 100],
    ["below it", -80, 0],
    ["not a number", "50", 100],
    ["not finite", Number.POSITIVE_INFINITY, 100],
  ])("handles an opacity that is %s", (_label, value, expected) => {
    const parsed = parsePreset(fileFor({ opacity: value }), scene(), PRIMITIVES);

    expect(parsed?.opacity).toBe(expected);
  });

  // Dropped rather than defaulted here: an omitted key is what makes hydrate
  // restore the slice's own registered default, which is the single fallback the
  // format relies on for a preset written before a later ticket's slice existed.
  it("drops a slice the file types wrongly rather than defaulting it itself", () => {
    const parsed = parsePreset(
      fileFor({ pitch: "north", spin: 12, sky: "on", shadingMode: 7, sceneHidden: [1, 2] }),
      scene(),
      PRIMITIVES,
    );

    expect(parsed?.store).toEqual({ spin: 12 });
  });

  it("drops a number that is not finite", () => {
    const parsed = parsePreset(fileFor({ pitch: Number.NaN, spin: 12 }), scene(), PRIMITIVES);

    expect(parsed?.store).toEqual({ spin: 12 });
  });

  it("accepts an array slice only when every entry is a string", () => {
    const good = parsePreset(fileFor({ sceneHidden: ["MESH_01"] }), scene(), PRIMITIVES);
    const bad = parsePreset(fileFor({ sceneHidden: "MESH_01" }), scene(), PRIMITIVES);

    expect(good?.store.sceneHidden).toEqual(["MESH_01"]);
    expect(bad?.store.sceneHidden).toBeUndefined();
  });

  // The store is not a place to put arbitrary keys off disk, which is the whole
  // reason hydrate filters as well.
  it("ignores a key the console does not have", () => {
    const parsed = parsePreset(fileFor({ spin: 12, __proto__polluted: true, whatever: 9 }), scene(), PRIMITIVES);

    expect(parsed?.store).toEqual({ spin: 12 });
  });
});

describe("sceneSnippet", () => {
  it("prints the same values the file carries, as a call", () => {
    const snippet = sceneSnippet(scene(), "0.9.4", new Date(2026, 7, 15));

    expect(snippet.startsWith(`// ${PRESET_APP} BUILD 0.9.4 — 2026-08-15\n`)).toBe(true);
    expect(snippet).toContain('primitive: "cuboctahedron"');
    expect(snippet).toContain("wireframe: false");
    expect(snippet).toContain("spin: 24");
    expect(snippet.endsWith(" });")).toBe(true);
  });

  // Narrow enough to paste is the entire point of the width, so it is worth an
  // assertion rather than an eyeball.
  it("wraps to a width a comment can hold", () => {
    const wide = scene({
      store: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`pitch${index}`, index])),
    });

    for (const line of sceneSnippet(wide, "0.9.4", new Date(2026, 7, 15)).split("\n")) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("sceneFileName", () => {
  it("stamps local time so a download folder sorts by when the frame was taken", () => {
    expect(sceneFileName("menger", new Date(2026, 7, 15, 9, 4, 5), "png")).toBe("halcyon-menger-20260815-090405.png");
  });
});
