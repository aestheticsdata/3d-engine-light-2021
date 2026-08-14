// The preset format: what SAVE PRESET writes, what LOAD accepts, and what COPY
// CODE prints.
//
// One module behind all three so the two exports cannot disagree — a snippet
// that named a value the file omitted would be a snippet nobody could reproduce
// by loading the preset beside it.
//
// Pure on purpose. Nothing here touches the DOM, the clipboard or a file: it
// takes a scene as plain data and returns plain data, which is what lets the
// node suite assert the validator against a hostile file rather than trusting a
// walkthrough. SessionActions owns everything with a side effect.
//
// The file is FLAT — `{ primitive, wireframe, opacity, pitch, yaw, … }` — because
// that is the shape COPY CODE prints and a reader has to be able to hand-edit.
// The in-memory record below keeps the store's slices in their own field, so
// flattening happens once, here, at the format boundary.
//
// Inert derivations with no state, so this stays a module rather than becoming a
// class (decisions.md D1a) — the same ruling src/rendering/material.ts sits under.

import type { UIState } from "@ui/UIStateStore";

// The format's own name for the app, lowercase and deliberately NOT buildInfo's
// APP_ID. That one is a display label the brand block prints; this one is on
// disk in every file already saved, so the two have to be free to move
// independently. Renaming what the console says must not invalidate a preset.
export const PRESET_APP = "halcyon";

// Bumped only when a slice's MEANING changes, never when one is added. A file
// written before a later ticket's slice existed loads with that slice at its
// default, which is exactly what UIStateStore.hydrate does by starting from
// them — so adding a slice needs no bump and no migration.
export const PRESET_VERSION = 1;

// The four values that are not slices. They live on RenderPipelinePanel and
// ShapeSwitcher rather than in the store, so the flat file has to name them
// itself — and they are therefore RESERVED: a later ticket that registers a
// store slice under one of these names would have it silently shadowed here.
// There is no such slice today, and opacity in particular is deliberately not
// one (see RenderPipelinePanel's header).
export const RESERVED_PRESET_KEYS: readonly string[] = ["primitive", "wireframe", "backfaceCulling", "opacity"];

// Registered slices that are renderer OUTPUT rather than scene input, and the
// one thing the store genuinely cannot tell us: drawnTriangles is registered
// with a RESET default exactly like every real setting, because RESET does have
// to zero the readout. A preset is not RESET though — a file carrying a triangle
// count would restore a number the very next frame contradicts, it would make
// two otherwise identical scenes save as different files, and 3DE-117 would sync
// it between machines as if it described something. Excluded in both directions,
// so a hand-edited count is ignored on the way back in as well.
const TELEMETRY_KEYS: readonly string[] = ["drawnTriangles"];

const isSetting = (key: string): boolean => !TELEMETRY_KEYS.includes(key);

const OPACITY_MIN = 0;
const OPACITY_MAX = 100;

// Narrow enough to paste into a comment or a chat window without re-wrapping,
// which is the whole point of COPY CODE. Deliberately not the repo's own 120:
// this string is read where our formatter is not.
const SNIPPET_WIDTH = 76;
const SNIPPET_OPEN = "applyScene({ ";
const SNIPPET_INDENT = " ".repeat(SNIPPET_OPEN.length);

// The console's whole scene, as the format sees it: the four values above, plus
// every registered store slice exactly as UIStateStore.snapshot() hands them
// over.
export interface SceneSnapshot {
  primitive: string;
  wireframe: boolean;
  backfaceCulling: boolean;
  // Slider space, 0-100 — what the OPACITY row shows and what the snippet
  // prints. RenderPipelinePanel holds a 0-1 fraction instead, and the conversion
  // belongs at this boundary rather than in the file: a preset should read the
  // way the console reads.
  opacity: number;
  store: Partial<UIState>;
}

// The envelope. Also the sync format for the accounts epic (3DE-117), which is
// what lets that work be additive rather than a rewrite — do not reshape it
// there without reshaping it here.
export interface ScenePresetFile {
  app: string;
  version: number;
  savedAt: string;
  state: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Type-matching against a REFERENCE value rather than against a schema spelled
// out here. The live scene already holds one correctly-typed value per key, so
// it is the schema — which is what keeps this validator from growing a second
// copy of the store's shape that could drift from UIState.
//
// It cannot police a string union: `shadingMode: "PWNED"` is a string and passes.
// That is handled where the vocabulary actually lives — the sections resolving
// an unknown chip id fall back to their own default — rather than by listing
// every union's members a second time in here.
const matchesShape = (value: unknown, reference: unknown): boolean => {
  if (Array.isArray(reference)) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
  }

  if (typeof reference === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  return typeof value === typeof reference;
};

// Keys the file got right, and only those. A key that is absent — or present
// with the wrong type — is left out entirely rather than defaulted here, so
// hydrate() restores it from the slice's own registered default. That is one
// fallback rather than two that could disagree.
const acceptedSlices = (state: Record<string, unknown>, reference: Partial<UIState>): Partial<UIState> => {
  const accepted: Record<string, unknown> = {};

  // Object.hasOwn rather than `in`: the file is parsed JSON, so `"constructor"
  // in state` is true on every object ever written and would let a slice that
  // happened to take one of Object.prototype's names read a function off the
  // prototype chain. matchesShape would reject it, but a validator that relies
  // on the next guard to catch what this one let through is one refactor from
  // not catching it.
  for (const key of Object.keys(reference)) {
    if (
      isSetting(key) &&
      Object.hasOwn(state, key) &&
      matchesShape(state[key], (reference as Record<string, unknown>)[key])
    ) {
      accepted[key] = state[key];
    }
  }

  return accepted as Partial<UIState>;
};

const clampOpacity = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, value));
};

const flatten = (scene: SceneSnapshot): Record<string, unknown> => ({
  ...Object.fromEntries(Object.entries(scene.store).filter(([key]) => isSetting(key))),
  // After the spread, so the four reserved names always win a collision rather
  // than being overwritten by a slice that happened to take one.
  primitive: scene.primitive,
  wireframe: scene.wireframe,
  backfaceCulling: scene.backfaceCulling,
  opacity: scene.opacity,
});

const pad = (value: number, length: number): string => String(value).padStart(length, "0");

// Local time, not UTC: the stamp is there to sort a download folder, and a
// midnight capture filed under yesterday's date reads as a bug to the person
// who took it.
const timestamp = (on: Date): string => {
  const date = `${on.getFullYear()}${pad(on.getMonth() + 1, 2)}${pad(on.getDate(), 2)}`;
  const time = `${pad(on.getHours(), 2)}${pad(on.getMinutes(), 2)}${pad(on.getSeconds(), 2)}`;

  return `${date}-${time}`;
};

// Greedy, and measured against the continuation indent rather than the opening
// call: every line after the first carries it, and packing the first line to a
// width the rest cannot reach would leave a ragged block.
const wrapEntries = (entries: readonly string[], width: number): string[] => {
  const lines: string[] = [];
  let current = "";

  for (const entry of entries) {
    const candidate = current === "" ? entry : `${current} ${entry}`;

    if (current !== "" && SNIPPET_INDENT.length + candidate.length > width) {
      lines.push(current);
      current = entry;
      continue;
    }

    current = candidate;
  }

  if (current !== "") {
    lines.push(current);
  }

  return lines;
};

export const sceneFileName = (primitive: string, on: Date, extension: string): string =>
  `${PRESET_APP}-${primitive}-${timestamp(on)}.${extension}`;

export const serialisePreset = (scene: SceneSnapshot, savedAt: Date): ScenePresetFile => ({
  app: PRESET_APP,
  version: PRESET_VERSION,
  savedAt: savedAt.toISOString(),
  state: flatten(scene),
});

// Validates before it returns anything at all, so a rejected file leaves the
// caller with nothing to half-apply. `app` and `version` are the two outright
// rejections; everything inside `state` degrades to a default instead, which is
// what makes a preset from an older build load rather than fail.
export const parsePreset = (
  raw: unknown,
  reference: SceneSnapshot,
  primitives: readonly string[],
): SceneSnapshot | null => {
  if (!isRecord(raw) || raw.app !== PRESET_APP || raw.version !== PRESET_VERSION || !isRecord(raw.state)) {
    return null;
  }

  const state = raw.state;
  const primitive = state.primitive;

  return {
    // The one string checked against a registry, because it is the one whose
    // wrongness is not recoverable: an unknown key would throw out of buildMesh
    // rather than degrade.
    primitive: typeof primitive === "string" && primitives.includes(primitive) ? primitive : reference.primitive,
    wireframe: typeof state.wireframe === "boolean" ? state.wireframe : reference.wireframe,
    backfaceCulling: typeof state.backfaceCulling === "boolean" ? state.backfaceCulling : reference.backfaceCulling,
    opacity: clampOpacity(state.opacity, reference.opacity),
    store: acceptedSlices(state, reference.store),
  };
};

// The same scene as serialisePreset, printed rather than downloaded. JSON.stringify
// per value rather than over the whole record: it quotes strings and arrays the
// way TypeScript would and leaves numbers and booleans bare, which is what makes
// the result paste-able as a call rather than as an object literal in disguise.
export const sceneSnippet = (scene: SceneSnapshot, build: string, on: Date): string => {
  const entries = Object.entries(flatten(scene)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  const parts = entries.map((entry, index) => (index === entries.length - 1 ? entry : `${entry},`));
  const lines = wrapEntries(parts, SNIPPET_WIDTH);
  const body = lines.map((line, index) => (index === 0 ? SNIPPET_OPEN + line : SNIPPET_INDENT + line));
  const date = `${on.getFullYear()}-${pad(on.getMonth() + 1, 2)}-${pad(on.getDate(), 2)}`;

  return `// ${PRESET_APP} BUILD ${build} — ${date}\n${body.join("\n")} });`;
};
