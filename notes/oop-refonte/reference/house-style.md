# The OOP house style — `3d-engine-light-2021`

Eighteen rules, **recovered from the owner-written class files, not invented.** Every
rule cites at least one real `file:line`; where the existing code contradicts itself,
the conflict is named and one rule is chosen.

The eleven files this was read off: `Point2D.ts`, `Point3D.ts`, `Matrix3D.ts`,
`Mesh.ts`, `Surface3D.ts`, `Triangle.ts`, `StateMachine.ts`,
`shapeTransitionMachine.ts`, `controls.ts`, `BackgroundRenderer.ts`, `tooltip.ts`.

> Citations verified line by line against the working tree on 2026-08-01: 187 checked,
> 7 corrected. Re-verify before trusting a line number after a large refactor.

---

## Declaration and exports

### R1 — a bare class, then `export default X;` as the last line

Never `export default class`, never `export class`.

Uniform across all eleven files: `Point2D.ts:1,18`, `Point3D.ts:3,67`,
`Matrix3D.ts:1,40`, `Mesh.ts:4,50`, `Surface3D.ts:11,51`, `Triangle.ts:67,237`,
`StateMachine.ts:37,131`, `shapeTransitionMachine.ts:138,205`, `controls.ts:1,53`,
`BackgroundRenderer.ts:1,157`, `tooltip.ts:9,81`. Zero counter-examples.

### R2 — named exports are for the types the public API needs, declared above the class

`Surface3D.ts:5` (`export interface MeshRenderRequest`), `Triangle.ts:61`
(`export interface TriangleRenderOptions`), `StateMachine.ts:1,10,16`. Consumers import
the class and its types from one specifier: `Mesh.ts:1`, `shapeTransitionMachine.ts:1`.

## Construction

### R3 — no parameter properties; declare fields at the top, assign in the constructor body

`Point2D.ts:2-8`, `Mesh.ts:5-11`, `Surface3D.ts:12-21`, `Triangle.ts:68-100`,
`StateMachine.ts:38-49`, `tooltip.ts:10-19`. There is no `constructor(private x: T)`
anywhere in the repo.

### R4 — three or more arguments, or any optional set, becomes one options object typed by a named interface

`StateMachineOptions` (`StateMachine.ts:30-35,44`), `ShapeTransitionOptions`
(`shapeTransitionMachine.ts:7-12,145`), `FollowCursorTooltipOptions`
(`tooltip.ts:1-7,14`).

`BackgroundRenderer.ts:6-10` inlines the object type instead of naming an interface —
minority form, **prefer the named interface**. Positional arguments survive only for
value types where the order *is* the meaning: `Point3D.ts:17`, `Point2D.ts:5`,
`Triangle.ts:84-92`.

### R5 — defaults are applied with `??` at assignment, never by mutating a parameter

`Surface3D.ts:41-42`, `StateMachine.ts:48`, `shapeTransitionMachine.ts:151-153`,
`BackgroundRenderer.ts:13`. A `= null` parameter default is also used where the
collaborator is genuinely optional (`Surface3D.ts:17`).

## State

### R6 — every field and accessor carries an explicit modifier, but constructors do not

Collaborators and constructor-injected state are `private readonly`; internal mutable
state is `private`; `public` only when something outside genuinely writes it.

`private readonly`: `Mesh.ts:5-6`, `Surface3D.ts:12-13`, `StateMachine.ts:38-39`,
`shapeTransitionMachine.ts:139-143`, `BackgroundRenderer.ts:2-4`, `tooltip.ts:10-12`,
`Point2D.ts:2-3`, `Point3D.ts:14-15`.
Mutable `private`: `Point3D.ts:4-6`, `Matrix3D.ts:5-6`, `StateMachine.ts:40-42`,
`Triangle.ts:68-70,80-82`.
Legitimate `public` mutable: `Point3D.ts:11-12` (`fl`, `zOffset` — written from outside
by `Triangle.changeFocal`, `Triangle.ts:228-234`), `Triangle.ts:72-77`.

**Constructors are the exception and always bare.** Not one of the eleven classes writes
`public constructor` — `Mesh.ts:8`, `Point2D.ts:5`, `Point3D.ts:17`, `Surface3D.ts:15`,
`Triangle.ts:84`, `BackgroundRenderer.ts:6`, `tooltip.ts:14`. Recorded because the lint
rule's default would have demanded a modifier on all nine and rewritten conformant files
to satisfy a convention this codebase never adopted.

### R7 — no public field that only the class itself writes; expose it through a getter

`Matrix3D.ts:2-4` exposes `public roll/pitch/yaw` as raw write-targets of a private
method. That is the one visibility leak in the recovered set and it is not a model.

## Methods

### R8 — regular methods, always with an explicit modifier, public API first and private helpers below

Never a bare `foo() {}`. `BackgroundRenderer.ts:16` then `:28,57,76,141`;
`StateMachine.ts:62-101` then `:103,112`; `tooltip.ts:51` then `:69`.

### R9 — an arrow class property **only** when the method is handed to `addEventListener` and needs a bound `this`

The only two occurrences in the repo are `tooltip.ts:37`
(`public hide = () => {}`) and `tooltip.ts:41` (`private onMouseMove = …`), both
registered at `tooltip.ts:32-34`. `controls.ts:9,46` attaches inline arrows instead
because nothing needs re-binding — that is fine, but a *named* handler must be an
arrow property.

**This is the rule most likely to break silently.** A regular method passed as a
listener loses `this` and fails at runtime, not at compile time.

### R10 — annotate the return type when the value is consumed; omit it on void methods

Annotated: `Point3D.ts:28`, `Triangle.ts:102,111`, `Mesh.ts:18`, `Surface3D.ts:26`,
`tooltip.ts:51`. Omitted: `Mesh.ts:31,37,43`, `StateMachine.ts:62,87,97`.

### R11 — getters are the read-only public surface over private state; there are no setters

Not one `set x(…)` exists in the codebase. Take a method instead — the precedent is
`Triangle.changeFocal` (`Triangle.ts:228-234`).

`Point2D.ts:10-15` (`_x`/`_y` backing fields — the underscore prefix appears *only*
when the getter takes the plain name), `Point3D.ts:8-10` (`zValue` over private `z`),
`Triangle.ts:102` (computed `depth`), `StateMachine.ts:58`,
`shapeTransitionMachine.ts:163`.

### R12 — member order: fields → constructor → getters → public methods → private methods

`Point3D.ts:8-10` puts its getter in the middle of the field block; `Triangle.ts:102`,
`StateMachine.ts:58` and `shapeTransitionMachine.ts:163` put theirs after the
constructor. The majority form wins.

## Naming and layout

### R13 — PascalCase class, file basename identical to the class name

`Point3D.ts`, `Matrix3D.ts`, `Mesh.ts`, `Surface3D.ts`, `Triangle.ts`,
`StateMachine.ts`, `BackgroundRenderer.ts`.

Three legacy exceptions keep their camelCase names: `controls.ts` (class `Controls`,
`:1`), `shapeTransitionMachine.ts` (class `ShapeTransitionMachine`, `:138`) and
`tooltip.ts` (class `FollowCursorTooltip`, `:9` — which does not even share the class's
stem). Do not rename them opportunistically; `index.ts:1,11,26` imports all three by
specifier.

### R14 — camelCase members, verb-led; booleans read as predicates

`renderMesh`, `transformPt`, `createController`, `isPointerNearThumb`;
`isAnimating` (`shapeTransitionMachine.ts:167`).

### R15 — beside a class, module scope holds types and pure unexported helpers, and nothing mutable

Allowed:
- **types and interfaces** above the class — `Surface3D.ts:5-9`, `Triangle.ts:59-65`,
  `StateMachine.ts:1-35`, `shapeTransitionMachine.ts:5-26`, `tooltip.ts:1-7`;
- **pure stateless helpers and const data tables** the class merely consumes —
  `easeInOutCubic` (`shapeTransitionMachine.ts:28`), `lerp` (`:33`), `requirePayload`
  (`:36`), the `states` table (`:44-136`). They are `const` arrows, never `function`,
  and never exported.

Module-level **mutable** state: none in the recovered set. Do not introduce it.
`src/ui/uiState.ts:40-41` (`const state`, `const listeners`) is the one place the repo
already breaks this, and COS-367 is the ticket that fixes it.

### R16 — import through the path alias, always, including within the same directory

`Point3D.ts:1` imports `@primitives/Point2D`; `Mesh.ts:1-2` and `Triangle.ts:55-57`
likewise. The six aliases — `@animations`, `@primitives`, `@data`, `@textures`,
`@rendering`, `@ui` — are declared in **both** `tsconfig.json:4-11` and
`vite.config.js:17-25`. **Add to both or the build breaks.** There is no alias for the
`src/` root, which is why `controls.ts` is imported relatively; a new class belongs in
an aliased folder, not at the root.

### R17 — one class per file, split past roughly 160 lines of code

The recovered set runs 18–157 lines: 18 (`Point2D`), 42, 50, 51, 53, 67, 81, 131, 157.
`Triangle.ts` (237) and `shapeTransitionMachine.ts` (205) exceed it, and both are
majority comment block and state table rather than method bulk. `index.ts` at 856 is
the acknowledged catch-all, not a model.

### R18 — comments explain *why*, never *what*, in full sentences

Two forms, both `//`:
- **File-header block** on algorithmically non-obvious modules — `Triangle.ts:1-53`
  (two `-----` ruled section titles, the affine matrix drawn in ASCII, a "Why UVs are
  optional" rationale). Same shape at `data/builder.ts:1-69`.
- **Short inline rationale** at the decision point, two to four lines, stating the
  constraint that forced the code — `tooltip.ts:20-22`, `index.ts:82-85,90-92,286-288`
  — plus one-line labels for algorithm phases
  (`Triangle.ts:120,148,161,176,184,211,219`).

Density is deliberately uneven: self-evident classes carry **zero** comments —
`Point2D`, `Point3D`, `Mesh`, `Surface3D`, `StateMachine`, `controls` and
`BackgroundRenderer` have none at all. Do not narrate plain code.

No JSDoc in new code. The only `/** */` in the tree is on three `SceneRow` interface
fields (`sceneGraph.ts:26,29,31`); it is not the house form and is not a precedent.

---

## Compiler settings that constrain classes

- `"target": "ESNext"` (`tsconfig.json:15`) with **no `useDefineForClassFields`**, so it
  defaults to **true**. Declared-but-uninitialised fields are emitted as `undefined` at
  construct time, and field initializers run in declaration order *before* the
  constructor body. `Point3D.ts:13` relies on that ordering — `canvas` is initialised
  before the constructor reads it at `:18`. **Never assume an external write lands
  before initializers.**
- **No `strict`, no `strictNullChecks`, no `strictPropertyInitialization`.** That is the
  only reason `Point3D.ts:13` and the conditionally-assigned `readonly vpX/vpY`
  (`:14-15,18-21`) compile. New code must not lean on it: annotate nullable
  collaborators explicitly as the owner does at `Surface3D.ts:13`
  (`BackgroundRenderer | null`) and `BackgroundRenderer.ts:4`, and guard with `?.` or an
  early return (`Surface3D.ts:27`, `controls.ts:5,17,26,37`).
- **No `experimentalDecorators`** — decorators are unavailable; do not propose them.
- `resolveJsonModule`, `esModuleInterop`, `moduleResolution: node`
  (`tsconfig.json:12-14`).
- `pnpm run typecheck` (`tsc --noEmit`) is the gate. `pnpm run build` only transpiles —
  esbuild does **not** type-check, so a build passing proves nothing about types.

## Inconsistencies, and the single rule to follow

| | Conflict | Evidence | Rule |
| -- | -- | -- | -- |
| I1 | Options object: named interface vs inline type | `StateMachine.ts:30`, `tooltip.ts:1` vs `BackgroundRenderer.ts:6-10` | Named interface above the class (R4) |
| I2 | Getter among the fields vs after the constructor | `Point3D.ts:8` vs `Triangle.ts:102`, `StateMachine.ts:58` | After the constructor (R12) |
| I3 | Public mutable field vs getter | `Matrix3D.ts:2-4` vs `Point2D.ts:10` | Getter, unless an outside class legitimately writes it — `Point3D.ts:11-12` (R7) |
| I4 | Iteration form | `for (const i in …)` over arrays at `Mesh.ts:22,32,38,44` vs `for (const … of …)` at `Surface3D.ts:38` | `for…of` — `for…in` yields string indices |
| I5 | File name casing | `BackgroundRenderer.ts` vs `tooltip.ts`, `shapeTransitionMachine.ts`, `controls.ts` | New class files match the class name exactly (R13) |
| I6 | Stray `;` after a method body | `Matrix3D.ts:29,37` | No terminator after a method body |

## What is enforced mechanically

`pnpm run lint` (`eslint.config.mjs`) encodes the rules below and **nothing else** —
no preset, no stylistic pack. Everything not in this table is enforced by review.

| Rule | Lint rule | Baseline | Severity |
| -- | -- | -- | -- |
| R1 — no `export default class` / `export class` | `no-restricted-syntax` | 0 | error |
| R3 — no parameter properties | `@typescript-eslint/parameter-properties` (`prefer: class-property`) | 0 | error |
| R6 + R8 — explicit modifier on fields, accessors and methods (**not** constructors) | `@typescript-eslint/explicit-member-accessibility` | 2 — `Point2D.ts:10,13` | warn → error at **COS-372** |
| R15 — no module-level mutable state | `no-restricted-syntax` | 0 — cleared by **COS-362 / COS-366** | error |
| I4 — `for…of`, never `for…in` | `no-restricted-syntax` | 4 — `Mesh.ts:22,32,38,44` | warn → error at **COS-372** |
| D4 — no `implements`, `abstract`, `protected` or inheritance | `no-restricted-syntax` | 0 | error |

A rule with a non-zero baseline is `warn`, never `off`, and never silenced with an
inline disable — the file is downgraded whole and the config names the ticket that
raises it. Total today: **0 errors, 9 warnings.**

Deliberately **not** linted: R17 (file length) — line-count linting produces noise; and
R18 (comments) — a judgement call no rule can make.

**Not covered by lint, and therefore the rules most likely to rot:** R9 (arrow property
for bound listeners), R12 (member order), R13 (filename === class name) and R16 (import
through the alias). R9 is the one that breaks at runtime rather than at review.

## Where the codebase stands against these rules

The engine — `src/primitives/`, `src/rendering/`, `src/animations/` — holds them. The
UI layer does not: `sceneGraph.ts:69,210`, `tabs.ts:21,106`, `statusBar.ts:18,40` and
`viewportHud.ts:50,90` are `export const createX = () => ({…})` factory closures each
followed by a redundant `export default`; `fields.ts:18,28` is a plain exported helper
with the same redundant default; `uiState.ts` is a module-scope singleton store with
five named exports and module-level mutable state (`:40-41`).

**That is not an open question.** Converting the UI layer is decided and scoped as
Linear epic **COS-356**. Until a COS-356 ticket covers a given module, leave its current
form alone rather than converting it as a side effect of touching the file — and when a
ticket does cover it, hold every rule above.
