# Halcyon — working agreements

A from-scratch software 3D rasteriser. No WebGL, no 3D library, no framework: the
triangles are filled by hand into a 2D canvas. Vite + TypeScript, plain CSS.

## This codebase is 100% OOP TypeScript

**Behaviour lives in a class.** A module that owns state, wires events, paints DOM or
runs an algorithm is a class. Not a factory closure, not a bag of exported arrow
functions.

```ts
class ThingDoer {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  public update(value: number) { … }
}

export default ThingDoer;   // last line, bare class above
```

Never `export default class`. Never `export class`. Never
`export const createThing = () => ({ … })`.

The full recovered ruleset — twenty rules, each cited to a real `file:line` in this
repo — is **[notes/oop-refonte/reference/house-style.md](notes/oop-refonte/reference/house-style.md)**.
Read it before adding a module. The short version:

| | |
| -- | -- |
| Fields | declared explicitly at the top, assigned in the constructor body. No parameter properties. |
| Visibility | always explicit. `private readonly` for collaborators, `private` for internal mutable state, `public` only when something outside genuinely writes it. |
| Methods | regular methods with an explicit modifier. An arrow class property **only** when the method is handed to `addEventListener` and needs a bound `this`. |
| Reads | getters over private state. There are no setters in this codebase — use a method. |
| Order | fields → constructor → getters → public methods → private methods. |
| Files | one class per file, basename === class name, and split past ~160 lines of code. An acronym in a type name keeps its capitals — `UIStateStore`, `DOMScope`, never `Ui`/`Dom`; camelCase members are exempt. |
| Imports | always through the path alias (`@ui/…`, `@primitives/…`), even within the same directory. Aliases are declared in **both** `tsconfig.json` and `vite.config.js` — add to both or the build breaks. A binding used only as a type is an `import type`; split the declaration when one module supplies both. |

**Data tables stay data tables.** An inert object literal with no behaviour
(`src/data/data.ts`, `src/data/shapeInfo.ts`, `src/data/shapes/pyramid.ts`) is a plain
`const` with a default export. Wrapping it in a class buys nothing and is not wanted.
Likewise a single pure derivation with no state. The line is behaviour, not file type.

**Module-scope helpers beside a class** are fine when they are pure, stateless and not
exported — `easeInOutCubic` in `src/animations/shapeTransitionMachine.ts` is the
blessed example. Module-level **mutable** state is not.

## Comments

Explain *why*, never *what*, in full sentences. `//` only — there is no JSDoc in this
repo. Density is deliberately uneven: a file-header block on algorithmically
non-obvious modules (see `src/primitives/Triangle.ts`), short inline rationale at a
decision point, and **zero** comments on self-evident classes. Do not narrate plain
code.

## Checks

```bash
pnpm run typecheck
```

```bash
pnpm run lint
```

```bash
pnpm test
```

```bash
pnpm run lint:rules
```

`pnpm run build` only transpiles — esbuild does **not** type-check. `typecheck` is the
one that catches a broken conversion, so run it before saying anything compiles.

`lint` is **Biome** (`biome.json`) — formatter, linter and import organiser in one, and
`lint:fix` writes the fixes. It encodes the house style mechanically: two native rules
plus eight Grit plugins in `biome-plugins/`. Biome's own `recommended` preset runs on top,
matching pfa, with two rules switched off in `biome.json` — see house-style.md for which
and why. Note `biome.json` is strict JSON: a `//` comment in it does not error, it makes
Biome fall back to its defaults, which silently retabs the whole tree. Put the reasoning in
house-style.md, never in the config. Every rule is an **error** across all of `src/`,
with no per-file downgrade and no inline suppression anywhere in the repo, so any
violation the run reports is a new one. Biome also covers CSS, HTML and SVG, which ESLint
did not.

`lint:rules` is the one you must not skip after touching a plugin or bumping Biome. A Grit
plugin that matches nothing reports nothing, so a broken rule looks exactly like a clean
codebase — `lint` passing proves nothing about whether the rules still work. `lint:rules`
runs them against `scripts/lint-fixtures/` and fails if any rule stops firing, or starts
over-firing. Both directions are checked.

`test` is vitest over the pure modules whose behaviour must not change, in six suites — the
store, the shape transition machine, the two standalone derivations, the fps meter, the
projection primitives and the camera controller. It runs in the
**node** environment: nothing under test owns a canvas or a DOM node, and a suite that needs an
emulation layer to run has stopped testing the logic. That constraint is what the de-mock epic
keeps paying for — a projection that reads a shared record instead of querying the DOM per
vertex is a projection that can be asserted against.

## Styles

Markup in `src/index.html`, styling in `src/styles/`, behaviour in `src/ui/`. Tokens
live in `src/styles/tokens/`, one file per token type; no raw hex or raw px for a
tokenised value. Sizes are fluid — a preferred value plus a floor, never a fixed
width or height — and the 1024×640 canvas scales down but is never upscaled. The full
rules are in `notes/ui-refonte/`.

## Work in progress

**Tickets live in Linear**, project **3D engine**, team `COS` — not in this repo.
Open epics: **COS-234** (de-mock, the engine behind the console) and **COS-201**
(the polyhedra of *The Symmetries of Things*).

**COS-356** (restoring the OOP convention across `src/`) and **COS-213** (the console
rebuild) are both closed. Their *rules* are not: everything above this section came
out of them, and new code still answers to it.

`notes/` holds only what a ticket cannot: the rules and the rulings.

- `notes/oop-refonte/` — the house style (R1–R20) and the binding decisions behind
  COS-356: what makes a file exempt, the ten files not converted, and the recorded
  baselines. Read `reference/decisions.md` before arguing that something should or
  should not become a class. Its `README.md` documents `pnpm run snapshot:geometry`,
  the byte-identical dump of all twenty shapes that every geometry ticket runs
  before QA.
- `notes/ui-refonte/` — the design-system rules and per-widget layout specs from
  COS-213. The widgets are all built; the rules still bind anything that adds UI.
