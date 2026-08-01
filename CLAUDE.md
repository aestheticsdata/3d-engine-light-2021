# 3d-engine-light-2021 — working agreements

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

The full recovered ruleset — eighteen rules, each cited to a real `file:line` in this
repo — is **[notes/oop-refonte/reference/house-style.md](notes/oop-refonte/reference/house-style.md)**.
Read it before adding a module. The short version:

| | |
| -- | -- |
| Fields | declared explicitly at the top, assigned in the constructor body. No parameter properties. |
| Visibility | always explicit. `private readonly` for collaborators, `private` for internal mutable state, `public` only when something outside genuinely writes it. |
| Methods | regular methods with an explicit modifier. An arrow class property **only** when the method is handed to `addEventListener` and needs a bound `this`. |
| Reads | getters over private state. There are no setters in this codebase — use a method. |
| Order | fields → constructor → getters → public methods → private methods. |
| Files | one class per file, basename === class name, and split past ~160 lines of code. |
| Imports | always through the path alias (`@ui/…`, `@primitives/…`), even within the same directory. Aliases are declared in **both** `tsconfig.json` and `vite.config.js` — add to both or the build breaks. |

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

`pnpm run build` only transpiles — esbuild does **not** type-check. `typecheck` is the
one that catches a broken conversion, so run it before saying anything compiles.

`lint` encodes the house style mechanically in `eslint.config.mjs` — nine `no-restricted-syntax`
selectors plus two `typescript-eslint` rules, no preset. An **error** is a new violation; the
**warnings** are the known ones a named ticket already owns, listed in the `PENDING` map.

`test` is vitest over the four pure modules whose behaviour the OOP refonte must not change —
the store, the shape transition machine and the two standalone derivations. It runs in the
**node** environment: nothing under test owns a canvas or a DOM node, and a suite that needs an
emulation layer to run has stopped testing the logic.

## Styles

Markup in `src/index.html`, styling in `src/styles/`, behaviour in `src/ui/`. Tokens
live in `src/styles/tokens/`, one file per token type; no raw hex or raw px for a
tokenised value. Sizes are fluid — a preferred value plus a floor, never a fixed
width or height — and the 1024×640 canvas scales down but is never upscaled. The full
rules are in `notes/ui-refonte/`.

## Work in progress

**Tickets live in Linear**, project **3D engine**, team `COS` — not in this repo.
Open epics: **COS-356** (restoring the OOP convention across `src/`), **COS-213** (the
console rebuild) and **COS-234** (de-mock, the engine behind it).

`notes/` holds only what a ticket cannot: the rules and the rulings.

- `notes/oop-refonte/reference/` — the house style (R1–R18) and the binding decisions
  behind COS-356: what makes a file exempt, the ten files not converted, and the
  recorded baselines. Read `decisions.md` before arguing that something should or
  should not become a class.
- `notes/ui-refonte/` — the design-system rules and per-widget layout specs for COS-213.
