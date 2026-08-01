# Binding decisions — OOP refonte (COS-356)

Cross-cutting rulings for the epic. A sub-issue may not contradict one of these; if it
needs to, the decision changes here first.

The word throughout is **not converted**, never "not touched" — an exempt file can still
receive the epic's mechanical cleanups. T01 itself edits two files on the list below.

---

## D1 — What makes a file exempt

Two clauses, because one does not cover both cases and pretending it does is a category
error the first reader will catch.

**D1a — inert literals stay literals.** A file whose content is an object or array
literal with no functions and no state gains nothing from a class. The only class shape
available is a static namespace over values that cannot change, and there is **not one
`static` member across the eleven owner-written classes** the house style was recovered
from — so it would invent a convention rather than follow one.

**D1b — a pure single-expression derivation stays a function.** A total,
dependency-free function with no shared invariant and no cast to confine has nothing to
encapsulate. The only class shape is a value object built and immediately unwrapped at
every call site.

**The discriminator against D1b**, stated here because it is the line a reviewer will
reopen: `texLabel.ts` *is* converted (T06 / COS-377) while `sceneObjectId.ts` is not,
and both are standalone pure-function modules with exactly two call sites. The
difference is that `texLabel` has two exports bound by a shared invariant, a real
map/filter/Set/dedupe pipeline that runs twice over the same object, and an unchecked
`as string[]` cast worth confining to a constructor. `sceneObjectId` has one derivation,
one output, no shared invariant and no cast. **One derivation, one output, no shared
invariant, no cast to confine → stays a function.**

## D2 — The ten files this epic does not convert

| File | LOC | Verdict | Reason |
| -- | -- | -- | -- |
| `src/data/shapeInfo.ts` | 273 | inert data (D1a) | A prose catalogue keyed by shape name: two interfaces at `:1-19`, one `Record` literal at `:21-271`, `export default` at `:273`. Zero functions, zero loops, zero imports. Its only behavioural use is the caller's lookup at `index.ts:336`, which belongs to the panel T16 extracts. |
| `src/animations/StateMachine.ts` | 131 | already conformant | One of the eleven reference files and the cited precedent for R4 and R12. Bare generic class at `:37`, `export default` last at `:131`, `private readonly` at `:38-39`, getter after the constructor at `:58`, public methods `:62-101` then private helpers `:103,112`. |
| `src/ui/tooltip.ts` | 81 | conformant, legacy name kept | The only class `src/ui/` had before the refonte, and the cited precedent for R9. The basename does not share the class's stem (`FollowCursorTooltip`), but `index.ts:11` and `styles/components/tooltip.css` both pair to the specifier by name. R13 carves it out explicitly. |
| `src/primitives/Surface3D.ts` | 51 | already conformant | Another of the eleven reference files — evidence for R1, R3, R6 and the compiler notes. Named interface above the class at `:5-9`, nullable collaborator annotated at `:13`, `??` defaults at `:41-42`, `for…of` at `:38`. |
| `src/data/data.ts` | 36 | inert data (D1a) | Fourteen imports, one registry literal at `:19-34`, `export default` at `:36`. No functions. The two lookups that might motivate a registry class are caller-side (`index.ts:211`, `:853`), and closing the key set is carved out as **COS-390**. |
| `src/data/shapes/pyramid.ts` | 21 | inert data (D1a) | The one shape file that is hand-typed vertex data: a single literal at `:3-19`, five point triples and six triangle tuples, no loops. It is the only file in `src/data/shapes/` that does not import `@data/builder` — every sibling computes its mesh at module scope, which is why T22–T26 convert them and this one is left. |
| `src/ui/chartTokens.ts` | 26 | inert data (D1a) | One `Object.freeze({…})` at `:17-26` and nothing else. It is the single site the styles layer sanctions for raw hex, hand-mirrored from `colors.css`; `README.md:303,328` and four unstarted tickets name this exact path, and T33 protects it by name. **It has no importer in `src/` today** — it is a forward-declared token mirror whose consumer is the unstarted framerate widget (COS-223). That is not dead code to be cleaned up. |
| `src/ui/buildInfo.ts` | 17 | inert data (D1a) | Four `export const` string bindings at `:9-17` over `__APP_VERSION__`, which vite's `define` substitutes at build time. Zero functions, zero state; the desktop/mobile split is two literals, not a branch. Consumed as plain values at `index.ts:838-839`. |
| `src/ui/modeLabel.ts` | 16 | pure derivation (D1b) | One two-line pure arrow at `:15-16` over a single boolean, plus the exported union at `:13`. Three call sites consume the return value and nothing else. Its own header at `:5-6` names the expiry: when the RENDER tab owns a `shadingMode` slice the derivation becomes stateful and moves onto that class. |
| `src/ui/sceneObjectId.ts` | 11 | pure derivation (D1b) | One pure arrow at `:10-11` — one regex replace, one uppercase, one suffix. Two call sites, both discarding the result immediately (`sceneGraph.ts:200`, `statusBar.ts:26`). **The weakest exception in the set**, kept on cost rather than on principle; `new SceneObjectId(key).value` is defensible against the `Point2D` precedent. See D1's discriminator. |

## D3 — `controls.ts` is not an exception

It was listed as one in T01's original acceptance checklist. That is wrong and the
criterion is corrected: **the list is ten files, not eleven.**

`src/controls.ts` is genuinely conformant today — bare `class Controls` at `:1`,
`export default` last at `:53`, four explicitly-`public` methods — but T18 (COS-373)
**deletes the file** and rebuilds its four methods as `SliderBank` and
`PrimitivePicker`. Its first acceptance line is "`src/controls.ts` no longer exists".

The error came from three unrelated "leave it alone" statements: rewriting it in
isolation is churn, R13 says don't rename it opportunistically, and rule 3 carves its
`getNumericValue` NaN defect out to COS-391. All three say *don't fix it on its own*.
None says *don't convert it*.

## D4 — The `implements` keyword is not used

`grep -rnE '\b(static|abstract|protected|implements)\b' --include='*.ts' src/` returns
**zero code hits** today — the only two matches are the word "static" inside comments at
`sceneGraph.ts:5,61`. That is the baseline and the epic does not change it.

T25 and T32 both describe generators and states "implementing" a contract. They mean it
structurally, not with the keyword: TypeScript satisfies both without it, and
`StateMachine` already consumes its `states` table structurally at `:33,51,70,80,91`.
**Write the contract as an interface and let structural typing check it.** No
`implements`, no `abstract`, no `protected`, no inheritance.

This is a deliberate reading of a codebase that has never used any of them, not a
general position on inheritance.

## D5 — Recorded baselines

Measured on this branch before any conversion ticket, so the epic can prove it moved
them.

| Baseline | Command | Today | Target at epic end |
| -- | -- | -- | -- |
| Factory/helper default exports in the layers being converted | `grep -rn '^export default [a-z]' src/ui/ src/primitives/ src/rendering/ src/animations/` | **5** (was 7 before T01) | 0 |
| Repo-wide `export default <lowercase>` | `grep -rn '^export default [a-z]' src/` | **21** (was 23) | 16 — the `export default sphere;` tails D1a keeps |
| `static` / `abstract` / `protected` / `implements` | `grep -rnE '\b(static\|abstract\|protected\|implements)\b' --include='*.ts' src/` | **0 code hits** | 0 — unchanged (D4) |
| Module-scope `let` | `grep -rn '^let ' --include='*.ts' src/` | **3** — `torusKnot.ts:94,134`, `rhombicTriacontahedron.ts:105` | 0 |
| `tsc --noEmit` | `pnpm run typecheck` | **exit 0, zero errors** | exit 0 |
| behaviour harness | `pnpm test` | **18 tests, 3 files, green** (recorded at T03, the first ticket that could) | green, plus the fps meter suite T13 owes |

The typecheck baseline is clean: `tsc --noEmit` reported no errors on its first run, so
T01 fixed none and the gate starts green. Every later ticket inherits that as a hard
criterion.

## D6 — What T01 does not enable

`strict`, `strictNullChecks` and `strictPropertyInitialization` stay **off**.
`Point3D.ts:13-21` does not compile under them — `document.querySelector("canvas")`
typed as `HTMLCanvasElement`, and conditionally-assigned `readonly vpX/vpY`. Unpicking
that is T29's territory, and turning the flags on repo-wide is its own piece of work
outside this epic.

## D7 — The composition root is measured by ownership, not by length

`src/app/Main.ts` is **282 code lines** after T19 and does not meet R17's ~160-line
split. It is exempt, and the exemption is narrow: it applies to the one class whose job
is to construct collaborators and connect them, and to nothing else.

R17 exists to stop a file accumulating behaviour that belongs somewhere else — the rule
is a proxy for "this file is doing too many jobs". Main is the file that proxy was
written against, and after the eight extractions it fails the proxy while passing the
thing the proxy measures. Every method left on it spans collaborators that must not know
about each other:

* `repaintForPrimitive` writes the scene graph, the status bar and both inspector cards
  inside one callback, because a shape change must land on all four together.
* `syncPipelineReadouts` writes the status bar, the viewport HUD and the SHADING row
  from one flag, for the same reason.
* `renderFrame` / `renderPausedFrame` / `paint` own the frame; `buildMesh` owns the
  registry lookup and the camera application; `sliderBindings` pairs six selectors with
  six collaborators.

Give any one of them to a widget and that widget starts reaching for a second one.

**What the size is instead.** Roughly a sixth of the file is the import list — twenty
collaborators, one line each under the alias rule — and the field block that mirrors it.
A composition root grows with the number of things composed, which is the number this
epic deliberately increased.

**The criterion that replaces the line count**, and the one a reviewer should apply:
*does any method here belong to exactly one collaborator?* If yes, it moves. If every
method touches two or more, the file is the right size.

This is the only exemption from R17 in the epic. It is not precedent for a second
"coordinator" class — a second one would mean the first is not the composition root.

## D8 — Four readings recorded against the engine batch

COS-368, COS-372, COS-379, COS-383 and COS-388 were implemented as written except on
these four points. Each is a place where following the ticket to the letter would have
contradicted something the epic had already settled.

**`AffineTextureMapper.draw` takes a named options object, not four positional
arguments.** COS-383 specifies `draw(context, screen, uv, image)`, which is four
arguments and therefore R4 territory, and the R4 exemption — "value types where the
order *is* the meaning" — does not cover it. The usual counter-argument is allocation,
since this runs once per textured triangle per frame, but the arithmetic goes the other
way: the ticket's own form allocates two fresh tuples per call for `screen` and `uv`,
where one flat options literal allocates one object. The options object is both the
house form and the cheaper one. It is flat rather than nested for exactly that reason.

For scale, `Triangle.render` already allocates six `Point2D` per triangle per frame by
design, so one more short-lived object on that path is not the thing to optimise.

**`easeInOutCubic` and `lerp` changed file but stayed functions.** COS-388's review
correction says to leave them where they are, because they are R15's own cited example
of a sanctioned module-scope helper and turning them into a class would delete the
evidence for a rule this epic enforces. Their file had to change anyway — the states
that call them moved out, and the acceptance criterion is that
`shapeTransitionMachine.ts` declares no module-scope `const` at all. They live in
`shapeTransition/easing.ts` as two `const` arrows. The correction's intent was "not a
class", and that is honoured exactly; only the address changed.

R15 says such helpers are "never exported", and these now are, because two state classes
need them and the alternative is the same six lines in both files. That is the same
trade the geometry batch already made for `data/builders/symmetry.ts`: a helper shared
by more than one class has to be exported or duplicated, and duplication is the worse of
the two. The clause that is actually load-bearing — pure, stateless, not a class — holds.

`shapeTransition/types.ts` exists for a narrower reason: the façade imports the three
states and the states need the state-name union, so declaring the union on the façade
would make the two files import each other.

**"A named error" means a specific message, not an `Error` subclass.** COS-368 asks the
direction lookup to throw a named error. D4 bans inheritance outright, so a subclass is
not available; the guard throws a plain `Error` whose message names the shape and prints
the direction that was not registered. Verified by reordering the three build phases,
which is the real mis-ordering the old unchecked cast swallowed: it now throws
`kisRhombicDodecahedron: no vertex is registered for direction (0, 1, 0).` instead of
producing NaN indices.

**The `Viewport` is constructed in `Main`, not carried in `BootContext`.** COS-379's
review correction adds `Bootstrapper.ts` to the file list because the viewport has to
come from the canvas the Bootstrapper owns. It does — `BootContext` already carries that
canvas and `Main` already destructures it, so `new Viewport(canvas)` there satisfies the
requirement without widening the boot contract with a fourth field that only one
collaborator reads. `Bootstrapper.ts` is unchanged.
