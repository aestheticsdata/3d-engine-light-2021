# SHAPE tab: primitive picker, transform, material

The SHAPE tab is the first tab of the right-hand inspector and holds the three controls a visitor touches most: which primitive is on screen, how it is oriented and spun, and how its surface is painted. It takes over the `#primitives` select and the range inputs the shell ticket parked in the inspector body as bare unstyled elements, and replaces them with real controls. Every widget is built now; the ones with no engine behind them render live, store their value in `src/ui/UIStateStore.ts`, and are picked up by the de-mock epic later.

**Design source** — `3D Engine UI.dc.html` desktop L459–L534, mobile L867–L928.

## Desktop

The tab body is the scroll container the shell ticket creates (L457): `flex:1; overflow:auto; padding: var(--space-4); display:flex; flex-direction:column; gap: var(--space-4-5)`. This ticket owns the three sections inside it, stacked with that gap and separated by two `.divider` rules (L476, L507). Section headings are `.section-title`.

Every chip, swatch and slider recipe — geometry, the chip colour table, the range-input skin, hover and focus — is owned by the primitives ticket in `src/styles/components/{chip,slider}.css`. This ticket restates none of it. It composes `.chip-grid` / `.chip--shape` / `.chip--tex` / `.swatch` / `.slider-row` and owns only the TS factories that build them.

### PRIMITIVE (L461–L472)
Header is a `space-between` row: `.section-title` on the left, the primitive count on the right in the `.panel__note` typography (`var(--font-weight-regular) var(--text-sm)/var(--leading-none)` mono, `var(--color-text-dim)`).

Grid: `.chip-grid` with `--chip-cols: 4`; chips are `.chip--shape`, two stacked spans — short label above, registry triangle count below.

**The mockup's 8 shapes are not this repo's shapes.** `SHAPES` at L1123–L1148 hardcodes SPHERE CUBE TORUS ICOSA CYLIND CONE TEAPOT TERRA. Ignore that list entirely. The grid is generated from `Object.keys(data)` (`src/data/data.ts`: sphere, cube, pyramid, cross, donut, torusKnot, menger, cuboctahedron) and must survive COS-201 adding roughly ten more polyhedra without any edit to this component.

Labels come from a new `src/ui/primitiveLabels.ts`: an explicit `Record<string, string>` for the current keys — `sphere: SPHERE, cube: CUBE, pyramid: PYRAMID, cross: CROSS, donut: DONUT, torusKnot: TKNOT, menger: MENGER, cuboctahedron: CUBOCT` — plus a derived fallback for any key not in the map: strip non-alphanumerics, uppercase, truncate to 8 characters. A 296px panel minus 2px border, minus `var(--space-4)` padding on both sides, minus three `var(--space-1-5)` gaps leaves ~66px per chip, so 8 characters at `--text-xs` mono fit with room to spare. A missing map entry is a lint-visible fallback, never a crash.

**Note added by COS-389.** `src/ui/primitiveLabel.ts` already exists and is a different derivation — it title-cases a key for SHAPE INFO's NAME row and SHAPE STORY's fallback (`torusKnot` → `Torus Knot`), not a short uppercase chip label. The two are not interchangeable, but this ticket must not add a *second* key-splitting regex: build the fallback on top of `primitiveLabel(key)` and uppercase/truncate its output. One derivation per shared value is an epic rule, and the near-identical filenames make this the easiest place in the set to break it.

**Overflow.** The grid stays 4 columns at every count. The PRIMITIVE section body gets `max-height: calc(6 * var(--size-chip-shape) + 5 * var(--space-1-5))` (284px = six rows) and `overflow-y: auto`, so TRANSFORM and MATERIAL stay reachable no matter how many primitives land; the scrollbar skin comes from the primitives ticket. This cap is the only tab-specific CSS rule the ticket writes. The header count always shows the true total.

Picking a chip also resets the scene-graph selection to the mesh row, matching the design's `shapeChips.pick` (L1491). The selection value itself lives in the scene-graph ticket's state; this tab writes it through the shared store.

### TRANSFORM (L475–L498)
Five `.slider-row`s built by `sliderRow.ts`: PITCH RATE, YAW RATE, ROLL RATE, SPIN, SCALE. The row geometry (66px label column at `--leading-snug` so a two-word label wraps, `flex:1` range at `var(--size-slider-input)`, 44px right-aligned value) belongs to primitives; this ticket supplies the label, the range bounds and the `format(value): string` hook per row.

### MATERIAL (L502–L533)
Texture chips: `.chip-grid` with `--chip-cols: 2`, chips `.chip--tex`, `margin-bottom: var(--space-4)`.

BASE row: `display:flex; align-items:center; gap: var(--space-2-5); margin-bottom: var(--space-4)`; the label reuses the `var(--size-slider-label-col)` column; five `.swatch` elements (`var(--size-swatch-w)` × `var(--size-swatch-h)`, 22 × 18 on desktop, `var(--size-mark)` border). Palette in order: `--color-swatch-red` `--color-swatch-yellow` `--color-swatch-green` `--color-swatch-blue` `--color-swatch-white`.

Then OPACITY and UV SCALE as two more `.slider-row`s.

## Mobile

Three separate full-bleed `.panel` cards stacked in the page column with `gap: var(--space-5)`, each opening with a `.panel__header` (26px via the token override) whose `.panel__title` is the section name. No section rules and no `.section-title` on mobile — the card header is the title. Card order matches desktop: PRIMITIVE, TRANSFORM, MATERIAL.

- PRIMITIVE card (L869–L881): plain `.panel__body`. `.chip-grid` stays `--chip-cols: 4`; `--size-chip-shape` resolves to 56px and the grid gap to `var(--space-2-5)` from the primitives mobile block. No inner scroll and no `max-height` — the page scrolls, so the desktop six-row cap is explicitly disabled below the breakpoint. At a 320px viewport the card is 300px wide, less 18px body padding and three 6px gaps, giving 66px per chip — the same width the desktop chip gets, so the 8-character label budget holds unchanged.
- TRANSFORM card (L883–L898): `.panel__body--pad-form`. The five `.slider-row`s pick up the primitives mobile layout — label and value in a `.slider-row__head` above a full-width input at `var(--size-slider-input)` (26px), no value column. Same five rows, same order, same `format()` hooks as desktop.
- MATERIAL card (L900–L926): `.panel__body--pad-form`. Texture grid keeps `--chip-cols: 2` with `--size-chip-tex` at 40px and `margin-bottom: var(--space-5)`. BASE row `gap: var(--space-4); margin-bottom: var(--space-2-5)`, label `flex: 0 0 var(--size-slider-label-col)` (46px on mobile), swatches at `var(--size-swatch-w)` × `var(--size-swatch-h)` (38 × 32). Then the two material sliders in the stacked geometry.

Touch targets: 56px shape chips and 40px texture chips are already over the minimum. The 38 × 32 swatch is not — give it the primitives `.tap-pad` helper with `--tap-pad: 6px`, which extends the hit area without changing the painted size. The 26px range track is a native input and the thumb is the target; leave it as the design draws it.

## Transform semantics

The mockup's sliders are absolute angles: PITCH −90..90°, YAW 0..360°, ROLL −180..180°, SPIN 0..100 shown as `(v/10).toFixed(1) + "/s"`, SCALE 10..300 shown as `(v/100).toFixed(2) + "×"` (`transformSliders`, L1410–L1414). **The engine has nothing of the sort.** `rotateMesh` (`src/index.ts` L423–L440) treats the slider values as per-frame rotation *rates* offset from the canvas centre:

```
speedFactor = rotationSpeed / 100
pitch angle = ((pitch - centerY) / 110) * speedFactor      // centerY = 320
yaw   angle = (-(yaw - centerX) / 110) * speedFactor       // centerX = 512
roll  angle = (roll / 500) * speedFactor
```

Ranges today: `#pitchSlider` 0..800 default 400, `#yawSlider` 0..800 default 400, `#rollSlider` −1000..1200 default 200, `#rotationSpeedSlider` 0..2000 default 200. Neutral (no rotation) is 320 for pitch, 512 for yaw, 0 for roll — none of which is the slider midpoint. `Mesh.transformMesh` mutates points in place, so there is no identity to reset to and absolute angles cannot be expressed without keeping a pristine copy of the source points.

**Decided: the UI epic does not change renderer behaviour.** The engine keeps its rates; the sliders are relabelled honestly and given a real zero. Absolute pitch/yaw/roll belongs to de-mock ticket E1 (camera rig), which is also what makes the WORLD tab's view presets meaningful.

| UI slider | UI range | Engine mapping | Value shown |
|---|---|---|---|
| PITCH RATE | −100..100, default 0 | two-segment linear onto the engine pitch: −100..0 → 0..320, 0..100 → 320..800 | signed integer, no unit |
| YAW RATE | −100..100, default 0 | −100..0 → 0..512, 0..100 → 512..800 | signed integer, no unit |
| ROLL RATE | −100..100, default 0 | −100..0 → −1000..0, 0..100 → 0..1200 | signed integer, no unit |
| SPIN | 0..100, default 10 | `rotationSpeed = ui * 20` (0..2000, engine default 200 → ui 10) | `(ui/10).toFixed(1) + "/s"` |

That keeps the mockup's SPIN format exactly and touches no renderer code. Do **not** print a `°` suffix — it would be a lie.

The four rotation inputs now carry UI-space values, so they must not keep the ids `#pitchSlider` / `#yawSlider` / `#rollSlider` / `#rotationSpeedSlider`: `syncSettingsFromControls` (`src/index.ts` L620–L633) reads those ids straight into `this.pitch` and would take −100 as an engine pitch. Give the new inputs UI-space ids, put the mapping in one place in `Main`, and re-point `applyDefaultControlValues`, `syncSettingsFromControls` and `resetControls` at the UI-space values. `#opacitySlider` is the exception and keeps its id — it is one of the ids the constructor hard-requires (L130–L177; the shell ticket leaves 20 after migrating the fps and triangle nodes) and the tooltip is constructed against it.

SCALE has no engine backing at all: render it, default 100, show `1.00×`, store in UI state, change nothing.

## Opacity — real, and it has a disabled state the design does not draw

OPACITY is live: `changeOpacity` (`src/index.ts` L261–L270) maps 0..100 to 0..1 and it reaches the rasterizer as `TriangleRenderOptions.opacity` via `Surface3D.render`. This ticket owns the rule and must preserve it exactly: the slider is `disabled` whenever backface culling is on (`syncOpacitySliderAvailability` L645–L648), and turning culling on resets opacity to 100 (`toggleBackfaceCulling` L552–L564). The RENDER tab and the quick toggles flip the same boolean and must not regress it.

Keep the existing `FollowCursorTooltip` (`src/ui/tooltip.ts`) with its message "Turn backface culling off to adjust opacity." This is the one legitimate use of that class: it is typed `target: HTMLInputElement` and keys off `slider.disabled`, so it survives the rebuild unchanged as long as the new range input keeps the `#opacitySlider` id. It is not the placeholder affordance and must not be reused as one — placeholders use the primitives convention (`data-placeholder="true"` + `title` + `aria-describedby`).

The disabled visual itself is painted by primitives' `slider.css` (`cursor: not-allowed`, thumb in `var(--color-slate-500)`, no opacity fade). This ticket additionally dims the row's own label and value to `var(--color-text-dim)` and sets `aria-disabled="true"` on the input.

## Data

| Field | Value shown | Source today |
|---|---|---|
| Primitive chip label | short uppercase name | `PRIMITIVE_LABELS[key]` in new `src/ui/primitiveLabels.ts`, derived fallback if absent |
| Primitive chip triangles | integer | registry count — `data[key].triangles.length` (`src/data/data.ts`), static per shape, not the drawn count |
| PRIMITIVE header count | integer | `Object.keys(data).length` |
| Active chip | one key | `queuedPrimitiveName ?? targetPrimitiveName ?? currentPrimitiveName` in `src/index.ts` — `requestPrimitiveChange` (L455–L466) parks a click made while `transitionMachine.isAnimating()` in `queuedPrimitiveName` and leaves `targetPrimitiveName` on the in-flight shape, so the queued key has to be read first for the chip to light immediately |
| PITCH / YAW / ROLL RATE | signed integer | real — mapped onto the existing rate sliders per the table above |
| SPIN | `(v/10).toFixed(1) + "/s"` | real — `rotationSpeed = ui * 20` |
| SCALE | `(v/100).toFixed(2) + "×"` | `placeholder` — default 100 shows `1.00×`; owned by de-mock E4 (materials, mesh scale) |
| Texture chips | CHECKER / SOLID / UV GRID / NO TEXTURE | `placeholder` — default CHECKER; materials are baked per triangle in `src/data/shapes/*` (`rgba(...)` strings plus the `dog` / `galaxy` keys on the cube) and cannot be swapped at runtime; owned by de-mock E4 |
| BASE swatch | one of five colors | `placeholder` — default `var(--color-swatch-red)` (`#E01B1B`, the mockup's `state.color` default); owned by de-mock E4 |
| OPACITY | `v + "%"` | real — `changeOpacity`, `src/index.ts` L261; disabled while `backfaceCullingEnabled` |
| UV SCALE | `v + "×"` | `placeholder` — range 1..16 (L1415), default 8; owned by de-mock E4 |

Every placeholder control carries the primitives placeholder affordance and writes its slice of `src/ui/UIStateStore.ts` (created empty by the shell ticket, sliced here).

## Files

- `src/ui/inspector/shapeTab.ts` — new; builds and syncs the three sections
- `src/ui/inspector/controls/chipGrid.ts` — new; the shared N-column chip grid factory used by all three tabs (sets `--chip-cols`, applies the `.chip--*` modifier, manages `.is-active`, keyboard and focus). Emits classes only; declares no colours
- `src/ui/inspector/controls/sliderRow.ts` — new; the shared slider row factory, one markup shape for both branches, with a `format(value): string` hook and a disabled state
- `src/ui/primitiveLabels.ts` — new; short-label map plus derived fallback
- `src/ui/UIStateStore.ts` — extended (created by the shell ticket) with `scale`, `texture`, `baseColor`, `uvScale`, and the UI-space rotation values
- `src/styles/inspector.css` — new; tab-specific layout only (the PRIMITIVE scroll cap and its mobile disable). Every other rule comes from `src/styles/components/`
- `src/ui/PrimitivePicker.ts` — the `#primitives` select wiring, to be replaced by this ticket's chip grid; `src/ui/SliderBank.ts` keeps the numeric binding (`attach` / `applyDefaults` / `syncFromDom`). Both came out of the old root-level `controls.ts`, which COS-373 deleted.
- `src/index.ts` — drop the `createSelectButton` call in `init()` (L656–L659); expose `requestPrimitiveChange` and an active-primitive change notification to the tab; add the rate-slider mapping constants and re-point `applyDefaultControlValues` / `syncSettingsFromControls` / `resetControls` at UI-space values
- `src/index.html` — mount the tab into the SHAPE slot the shell created; the parked `#primitives` select and the unstyled range inputs are consumed here

The legacy `main.css` blocks (`.sliderGroup`, `.sliderRow`, `.sliderText`, `input[type=range]*`, `#selectButton`) are deleted by the shell ticket's teardown, not here.

## Done when

- [ ] The PRIMITIVE grid is generated from `src/data/data.ts` at runtime; adding a key to the registry adds a chip with no edit to the tab component
- [ ] Each chip shows the primitive's real registry `triangles.length`, and the desktop header count equals `Object.keys(data).length`
- [ ] With 18 primitives in the registry the grid still shows exactly 4 columns and the PRIMITIVE section scrolls internally on desktop while TRANSFORM and MATERIAL remain reachable
- [ ] Clicking a chip switches the shape through `requestPrimitiveChange`, the transition animation still plays, the active chip follows `queuedPrimitiveName ?? targetPrimitiveName ?? currentPrimitiveName` so a click queued mid-transition lights immediately, and the scene-graph selection returns to the mesh row
- [ ] `<select id="primitives">` and `Controls.createSelectButton` are gone, and nothing references them
- [ ] Rotation sliders have a real zero at UI value 0, SPIN reads `1.0/s` at the engine default, no rotation label carries a `°`, and `rotateMesh` is unchanged
- [ ] `syncSettingsFromControls` and `resetControls` read UI-space values through the mapping layer; no engine-space slider id survives on a visible control except `#opacitySlider`
- [ ] OPACITY still drives the rasterizer, still disables when backface culling is on, still resets to 100 when culling is turned on — including when the flip comes from the RENDER tab or a quick toggle — and the existing follow-cursor tooltip still appears near the thumb while disabled
- [ ] Placeholder controls (SCALE, texture chips, BASE, UV SCALE) accept input, carry `data-placeholder="true"` with a `title` and `aria-describedby`, persist in `src/ui/UIStateStore.ts`, and change nothing on the canvas
- [ ] The toolbar's RESET path restores every slice this ticket adds — rotation rates, spin, scale, texture, base colour, opacity, UV scale — not just the engine values
- [ ] At `max-width: 899px`: three separate cards with 26px headers, 56px shape chips, 40px texture chips, stacked sliders with a 26px track and the label/value row above, the six-row scroll cap disabled, and the 38 × 32 swatch padded to 44px through `.tap-pad`
- [ ] This ticket declares no chip, toggle or range colour table and no range-input skin; `src/styles/inspector.css` contains only the scroll cap
- [ ] Hover rules are inside `@media (hover: hover)`; every chip and swatch is keyboard reachable with a visible focus state
- [ ] No raw hex or raw px for a tokenised value outside `src/styles/tokens/*.css`
