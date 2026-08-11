# The OOP house style — `halcyon`

Twenty rules. R1–R18 were **recovered from the owner-written class files, not
invented**; R19 and R20 came later, from the owner's own corrections during COS-395 and
COS-396, and are held to the same standard. Every rule cites at least one real
`file:line`; where the existing code contradicts itself, the conflict is named and one
rule is chosen.

The eleven files this was read off: `Point2D.ts`, `Point3D.ts`, `Matrix3D.ts`,
`Mesh.ts`, `Surface3D.ts`, `Triangle.ts`, `StateMachine.ts`,
`shapeTransitionMachine.ts`, `controls.ts`, `BackgroundRenderer.ts`, `tooltip.ts`.

> Citations verified line by line against the working tree on 2026-08-01: 187 checked,
> 7 corrected. Re-verify before trusting a line number after a large refactor.
>
> COS-356 landed after that date and was exactly such a refactor, so treat the line
> numbers as approximate. Citations into the **eleven recovered files** are kept as
> written even where the epic has since moved them: they are the evidence the rules were
> read off, not a claim about today's tree. One of the eleven, the root-level
> `controls.ts`, no longer exists at all — COS-373 split it into `SliderBank` and
> `PrimitivePicker` (see decisions.md D3). Where a rule's only live example was in a file
> the epic deleted, it has been repointed at a current one.

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

The two original occurrences are `tooltip.ts:37` (`public hide = () => {}`) and
`tooltip.ts:41` (`private onMouseMove = …`), both registered at `tooltip.ts:32-34`. The
epic added two more on the same pattern: `PrimitivePicker.ts:54`
(`private onSelectionChange = …`, handed to `addEventListener`) and
`scene/SceneGraphPanel.ts:68` (`private paint = …`, handed to the store's `subscribe`).
An *inline* arrow at the registration site needs no re-binding and stays inline — that
is fine; it is the *named* handler that must be an arrow property.

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

Two legacy exceptions keep their camelCase names: `shapeTransitionMachine.ts` (class
`ShapeTransitionMachine`) and `tooltip.ts` (class `FollowCursorTooltip`, `:9` — which
does not even share the class's stem). Do not rename them opportunistically; each is
imported by specifier, `tooltip` at `RenderPipelinePanel.ts:20`. There was a third,
`controls.ts`, but COS-373 deleted the file rather than renaming it.

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

Module-level **mutable** state: none in the recovered set, and none in the tree today.
Do not introduce it. The one file that broke this held the UI store's `state` and
`listeners` containers at module scope; it is now the class
[`src/ui/UIStateStore.ts`](../../../src/ui/UIStateStore.ts), which holds both as
private fields, and COS-392 removed the last module-scope binding by making `Main`
construct the store and inject it.

### R16 — import through the path alias, always, including within the same directory

`Point3D.ts:1` imports `@primitives/Point2D`; `Mesh.ts:1-2` and `Triangle.ts:55-57`
likewise. The eight aliases — `@animations`, `@app`, `@primitives`, `@data`, `@img`,
`@textures`, `@rendering`, `@ui` — are declared in **both** `tsconfig.json:9-18` and
`vite.config.js:18-27`. **Add to both or the build breaks.** There is deliberately no
alias for the `src/` root: `src/index.ts` is the only file left there and it is the
ignition line, so a new class belongs in an aliased folder rather than beside it.

### R17 — one class per file, split past roughly 160 lines of code

The recovered set runs 18–157 lines: 18 (`Point2D`), 42, 50, 51, 53, 67, 81, 131, 157.

**Measure code lines, not raw lines.** The two files originally recorded as exceeding
the rule were measured wrong, and the correction matters because one of them turned out
not to breach it at all. `Triangle.ts` was 237 raw but **143 code**, and the reason
given for exempting it — "majority comment block" — was arithmetically false at 26%;
the exemption held on the right metric and the file never needed one. It is 121 code
lines after COS-383. `shapeTransitionMachine.ts` was 205 raw and **174 code** with zero
comment lines, so it genuinely breached, and the state table that made up 45% of it is
exactly what COS-388 moved out — it is 69 code lines now.

The one live exemption is `src/app/Main.ts`, at 286 code lines, and it is exempt by
ownership rather than by length: see **D7** in `decisions.md`.

### R18 — comments explain *why*, never *what*, in full sentences

Two forms, both `//`:
- **File-header block** on algorithmically non-obvious modules — `Triangle.ts:1-53`
  (two `-----` ruled section titles, the affine matrix drawn in ASCII, a "Why UVs are
  optional" rationale). Same shape at `data/builders/MeshBuilder.ts:1-29`.
- **Short inline rationale** at the decision point, two to four lines, stating the
  constraint that forced the code — `tooltip.ts:20-22`, `app/Main.ts:61-65,67-69` —
  plus one-line labels for algorithm phases
  (`Triangle.ts:120,148,161,176,184,211,219`).

Density is deliberately uneven: self-evident classes carry **zero** comments —
`Point2D`, `Point3D`, `Mesh`, `Surface3D`, `StateMachine` and `BackgroundRenderer` have
none at all. Do not narrate plain code.

No JSDoc in new code. The only `/** */` in the tree is on three `SceneRow` interface
fields (`scene/sceneRows.ts:11,14,16`); it is not the house form and is not a precedent.

### R19 — a binding used only in a type position is imported with `import type`

R16's sibling: R16 says which specifier to import through, this says which *form*.

`data.ts:1` imports `Data3D` as a type beside twenty value imports of the shape
modules. `Mesh.ts:1-3` is the clearest case — all three of its imports are types, so
the emitted module imports nothing at all at runtime.

When one module supplies both, the declaration splits rather than using the inline
`{ type X, Y }` form: `SceneRowView.ts:8-9` takes `SceneRow` as a type and `HINT_ID` /
`PLACEHOLDER_NOTE` as values from the same module, on two lines. This is also forced
rather than chosen when the type is a default export — TypeScript rejects an
`import type` carrying both a default and named bindings, which is why `Mesh.ts:1-2`
reads as two lines against one module.

Not cosmetic. A value import of a type keeps the module in the emitted graph, so a
type-only edge becomes a real runtime dependency and a cycle TypeScript would have
erased survives into the bundle. It also cost the geometry snapshot a workaround: the
script could not use Node's type stripping while `data.ts:1` was a type import written
in value syntax, and `scripts/snapshot-geometry.mjs:1-27` records that this reason has
now lapsed.

**COS-395** converted 79 declarations across 52 files in one autofix pass. Two of them
needed hand-formatting afterwards — the fixer emits `{ ShadingMode}` and breaks a long
declaration across lines with the brace stranded — so re-read the diff rather than
trusting `--fix` alone.

### R20 — an acronym keeps its capitals in a type name

`UIStateStore.ts:48`, `DOMScope.ts:15`, `FPSMeter.ts:19`, `ViewportHUD.ts:51`, and the
type `UIState` at `UIStateStore.ts:23`. The already-correct precedent this repo had all
along is `types.ts:9` — `export type UV`, never `Uv`.

R13 does the rest: the class name binds the file basename, so every rename here forced
its file. `git mv` needs the two-step through a temporary name on macOS's
case-insensitive filesystem, or git records a delete plus an add instead of a rename.

**Type names only — camelCase members are deliberately exempt.** `dogUrl`,
`viewportHud`, `smoothedFps` and `syncFromDom` are untouched, because full-capping a
camelCase tail gives `skyURL` and `syncFromDOM`, a different and far more contested
convention than the one this rule encodes. The lint selector is anchored to a leading
capital for exactly this reason; without that anchor it matches `dogUrl`, which is how
the first draft of the rule failed.

The acronym is caught wherever it sits — opening the name (`UiState`), closing it
(`ViewportHud`), in the middle (`ShapeUiPanel`), or being the whole of it (`Ui`) — and
across class, interface, type-alias and enum declarations plus all three import-binding
forms. The first draft caught only the first two positions and missed
`import * as UiThing` entirely; an adversarial probe pass found all four gaps, and the
probes are worth re-running against any edit to the pattern. Extended forms need listing
in their own right: `Rgba` sits beside `Rgb`, because in `RgbaColor` the trailing `a`
defeats the "followed by a capital" test and a list holding only `Rgb` reads as covering
it while letting it through.

**COS-396** renamed six identifiers over 33 + 19 + 13 + 11 + 6 + 2 references, and
`fpsMeter.test.ts` with them — a test file named in camelCase beside a sibling named
`UIStateStore.test.ts` was the same drift one level down.

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
  early return (`Surface3D.ts:27`, `PrimitivePicker.ts:36,45`, `SliderBank.ts:67`).
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
| I5 | File name casing | `BackgroundRenderer.ts` vs `tooltip.ts`, `shapeTransitionMachine.ts` | New class files match the class name exactly (R13) |
| I6 | Stray `;` after a method body | `Matrix3D.ts:29,37` | No terminator after a method body |

I2, I3, I4 and I6 no longer have a live counter-example anywhere in `src/`: COS-372 and
COS-379 converted the four files they cite. The **rulings stand** — they are what a new
file is held to. The evidence cells are now historical, and their line numbers are where
the conflict was read off in the original tree, not where anything is today.

## What is enforced mechanically

`pnpm run lint` (`biome.json`) encodes the rules below. Biome's own `recommended` preset
runs alongside them, which is what pfa does and what COS-403 restored; everything not in
this table and not in that preset is enforced by review.

Two of the preset's rules are switched off, both because the code they flag is deliberate
rather than careless. The reasoning lives here because `biome.json` is strict JSON and
cannot hold a comment — see the warning at the end of this section.

| Rule off | Why |
| -- | -- |
| `suspicious/noDuplicateProperties` | Both hits are fallback declarations. `.viewportStage` repeats `width` so a browser without container-query units keeps the `100%` value, and `reset.css` repeats `content` because that pair is what the reset it came from ships. |
| `a11y/useHeadingContent` | `#shapeStoryTitle` is filled by `ShapeStoryPanel` at runtime. Putting placeholder text in the markup to satisfy the rule would flash the wrong shape name on load, which is worse for the reader than the empty parse-time state. |

Two of the eight are native Biome rules. The other six are Grit plugins in `biome-plugins/`
— eight files, because D4 needs three — since Biome has no `no-restricted-syntax`: a custom
rule is a plugin or it does not exist. COS-397 moved them over from ESLint.

| Rule | Mechanism | Baseline | Severity |
| -- | -- | -- | -- |
| R1 — no `export default class` / `export class` | plugin `r01-export-class.grit` | 0 | error |
| R3 — no parameter properties | native `noParameterProperties` | 0 | error |
| R6 + R8 — explicit modifier on fields, accessors and methods (**not** constructors) | plugin `r06-r08-accessibility.grit` | 0 — cleared by **COS-372** | error |
| R15 — no module-level mutable state | plugin `r15-no-module-let.grit` | 0 — cleared by **COS-362 / COS-366** | error |
| I4 — `for…of`, never `for…in` | plugin `i04-for-of.grit` | 0 — cleared by **COS-372** | error |
| D4 — no `implements`, `abstract`, `protected` or inheritance | plugins `d04-no-inheritance.grit`, `d04-no-abstract.grit`, `d04-no-protected.grit` | 0 | error |
| R19 — `import type` for type-only bindings | native `useImportType` (`style: separatedType`) | 0 — cleared by **COS-395** | error |
| R20 — acronyms keep their capitals in a type name | plugin `r20-acronym-case.grit` | 0 — cleared by **COS-396** | error |

R6 + R8 is a plugin rather than the native `useConsistentMemberAccessibility` for one
reason: the native rule's only option is `accessibility`, so it has no way to exempt
constructors and would fire on all eleven owner-written classes — the nine-error
inversion COS-360 hit and ruled against. The plugin gets the exemption for free, since
`JsConstructorClassMember` is its own node type and the rule simply does not name it.

Every rule is an error across all of `src/`, with no per-file downgrade and no inline
disable comment anywhere in the repo. Total today: **0 errors, 0 warnings.**

### Why `pnpm run lint` passing is not enough

A Grit plugin whose pattern matches nothing reports nothing, and Biome does not treat
that as an error. A typo in a node name — or a grammar change in a Biome upgrade, which
the Biome docs warn about explicitly — switches a rule off **silently**, and a silently
disabled rule is indistinguishable from a clean codebase.

`pnpm run lint:rules` is what tells the two apart. It runs the plugins against
`scripts/lint-fixtures/`, where `violations.ts` breaks every rule a known number of times
and `conformant.ts` must stay clean, and it fails if any count moves. Run it after
touching a plugin or bumping Biome. The count matters as much as the presence: R6 + R8
must not claim the exempt constructor, and R20 must not claim `UIStateStore` or `dogUrl`.

**Never put a comment in `biome.json`.** It is strict JSON, and a `//` line does not
produce a config error — Biome falls back to its built-in defaults, whose `indentStyle` is
**tab**, so the next `lint:fix` retabs all 91 files and the house rules stop running
entirely. The only visible symptom is a formatter diff, which reads as a formatting
problem rather than a dead config. Anything that needs explaining goes in this file.

**Write the awkward shape into the fixture, not the easy one.** An adversarial pass over
the first version of these plugins found four rules with silent holes, and `lint:rules`
was green throughout — because every hole was a shape the fixture did not contain. A
backtick snippet matches only a class written literally `class NAME { … }`, so a type
parameter, a decorator, `abstract` or a heritage clause each defeated R1 in silence, and
`export default abstract class` was invisible to every plugin at once. R20 missed any
acronym in the *middle* of a name because Grit anchors a top-level `|` as `^ARM1|ARM2$`,
anchoring each arm at one end only. R6 + R8 exempted any member whose body happened to
declare a class with a modifier, because `contains` walks the whole subtree. None of that
was visible from a passing run; all of it was visible the moment the fixture grew a
generic class and a nested one.

Deliberately **not** linted: R17 (file length) — line-count linting produces noise; and
R18 (comments) — a judgement call no rule can make.

**Not covered by lint, and therefore the rules most likely to rot:** R9 (arrow property
for bound listeners), R12 (member order), R13 (filename === class name) and R16 (import
through the alias). R9 is the one that breaks at runtime rather than at review.

## Where the codebase stands against these rules

The whole tree holds them. **COS-356 is complete.** Its thirty-four tickets converted
the UI layer, decomposed the catch-all `index.ts` into `src/app/`, and brought the
geometry and engine layers up to the footing `src/primitives/`, `src/rendering/` and
`src/animations/` already had.

The factory-closure form the rules above were written against is gone.
`grep -rc 'export const create' src` returns zero, and the modules that carried it are
now the classes `SceneGraphPanel`, `TabGroup`, `StatusBar`, `ViewportHUD`,
`FieldWriter` and `UIStateStore`. The last module-scope mutable binding went with
COS-392, which deleted the store singleton and made `Main` construct and inject it.

What is left is upkeep, not conversion. Every rule above is an error in `biome.json`
across all of `src/`, with no per-file downgrade and no inline suppression; the
baseline is 0; and the rules themselves are re-proved against `scripts/lint-fixtures/`
by `pnpm run lint:rules`. A new module holds every rule from its first commit — there
is no grandfathered set left to leave alone.
