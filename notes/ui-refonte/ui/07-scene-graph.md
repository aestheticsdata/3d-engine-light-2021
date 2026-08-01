# Scene graph panel

The scene graph is the left sidebar's top card: a flat, non-nested list of the objects the frame is composed of, with a kind tag, an id, a triangle count and a visibility toggle per row. It is the only place in the UI that names the mesh as an object rather than as "the shape", and it is where per-object selection and hiding will land once the engine grows more than one renderable.

**Design source** — `3D Engine UI.dc.html` desktop L79–L94, mobile L782–L797.

## Desktop

Card: the shared `.panel` recipe from the primitives ticket plus `flex: 0 0 auto`. This ticket declares no surface, border, radius or header rules of its own. It is the first child of the 264px left column (`flex: 0 0 var(--size-sidebar-w)`, column, `gap: var(--space-4)` 8px, `min-height: 0`), above SHAPE INFO and SHAPE STORY.

Header: `.panel__header` with `.panel__title` `SCENE GRAPH` and `.panel__note` `<n> obj`, where `n` is the row count, always 4.

Body: `.scene-graph__body`, `padding: var(--space-1-5)` (4px). No scroll, no max-height — four rows always fit.

Row: flex, `align-items: center`, `gap: var(--space-3)` (7px), `height: var(--size-row-scene)` (26px), `padding: 0 var(--space-2-5)` (6px), `border-radius: var(--radius-sm)` (2px), `cursor: pointer`, `border-left: var(--size-mark) solid <mark>` (2px). Columns left to right:
1. kind tag — `flex: 0 0 var(--size-scene-kind-col)` (26px), `var(--font-weight-medium) var(--text-xs)/var(--leading-none) var(--font-mono)` (8px), `color: var(--color-text-dim)`. Values `MSH` / `PLN` / `ENV` / `LGT`.
2. id — `flex: 1`, `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-mono)` (10px), `color: <fg>`, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
3. triangle count — `var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)` (9px), `color: var(--color-text-dim)`. Rendered as `<count> △` when the count is non-zero, otherwise the em dash `—`.
4. visibility button — `var(--size-vis-button)` square (14×14), flex-centred, `border-radius: var(--radius-sm)`, `background: var(--color-surface-sunken)`, `var(--font-weight-bold) var(--text-xs)/var(--leading-none) var(--font-mono)` (8px), `color: <visFg>`, glyph `●` visible / `○` hidden.

Row states (design L1352–L1364):

| State | background | left mark | id color | vis glyph / color |
| --- | --- | --- | --- | --- |
| selected | `var(--color-row-selected-bg)` | `var(--color-accent)` | `var(--color-text-max)` | `●` `var(--color-state-ok)` |
| unselected, visible | `transparent` | `transparent` | `var(--color-text-secondary)` | `●` `var(--color-state-ok)` |
| hidden (selected or not) | per above | per above | `var(--color-text-disabled)` | `○` `var(--color-text-disabled)` |

Hover: `background: var(--color-row-hover-bg)`, wrapped in `@media (hover: hover)` per the primitives hover convention so it does not stick on touch. The design has no transition — do not add one.

Interaction: clicking the row selects it; clicking the visibility button toggles visibility and must **not** select the row — `e.stopPropagation()` on the `toggleVis` handler (design L1363; the plain `select` handler is L1362). The visibility button is a real `<button type="button">` with an `aria-label` (`Hide FLOOR_01` / `Show FLOOR_01`) and `aria-pressed`; the row itself is a `<button>` too, or a `role="option"` inside a `role="listbox"` — pick one and keep keyboard focus visible.

## Mobile

The card is the first of the three left-column cards shown in the mobile **SCENE** tab (design L780–L797). `.colLeft` is `display: contents` below 900px, so the card becomes a direct flex item of `#app` in the tab-panel slot and the 10px stack gap comes from the shell. This ticket adds no margin and no `flex`. Order in the tab: SCENE GRAPH, SHAPE INFO, SHAPE STORY, then the GESTURES card owned by the shortcuts ticket.

Header height (26px) and padding (`0 var(--space-4-5)`, 9px) come from `.panel__header`'s own media override; do not restate them here. Deltas this ticket owns:
- Body `padding: var(--space-2)` (5px).
- Row `height: var(--size-row-scene)` (44px via the `max-width: 899px` block), `gap: var(--space-4-5)` (9px), `padding: 0 var(--space-4)` (8px).
- kind tag `flex: 0 0 var(--size-scene-kind-col)` (28px), `var(--text-sm)` (9px).
- id `var(--font-weight-medium) var(--text-xl)/var(--leading-none) var(--font-mono)` (12px). The mockup drops the ellipsis clamp here; keep it anyway (`CUBOCTAHEDRON_01` overflows a narrow phone) — this is a deliberate deviation, record it in the PR.
- triangle count `var(--text-base)` (10px).
- visibility button `var(--size-vis-button)` (30×30), `var(--font-weight-bold) var(--text-base)/var(--leading-none) var(--font-mono)` (10px).
- No hover rule.

Touch targets: the row is 44px, fine. The 30×30 visibility button is under 44px — apply primitives' `.tap-pad` helper with `--tap-pad: 7px`, which extends the hit area to 44×44 without changing the painted 30×30 box. The helper itself is defined once in `src/styles/components/placeholder.css`; this ticket only sets the class and the custom-property value.

Width check at 320px: the card is 300px wide, the body pads 5px each side and the row pads 8px each side, leaving 274px for `28 + 9 + id + 9 + tris + 9 + 30`. `TORUS_KNOT_01` at 12px mono is roughly 96px and the count is roughly 40px, so the id column keeps positive free space and the clamp only engages on the longest ids.

## Data

Four rows, fixed order (design L1346–L1351). Only the first is backed by the engine.

| Field | Value shown | Source today |
| --- | --- | --- |
| Header count | `4 obj` | Length of the row array; constant until the de-mock epic introduces real scene objects |
| Row 1 kind | `MSH` | Constant — the engine renders exactly one mesh |
| Row 1 id | e.g. `SPHERE_01`, `TORUS_KNOT_01` | `sceneObjectId(primitiveKey)` imported from `src/ui/sceneObjectId.ts`, which the shell ticket owns (D5). Do not re-derive the snake-case rule inline; this ticket only passes the active primitive key |
| Row 1 triangles | e.g. `1104 △` | The **drawn** count (D6): the number `Surface3D.render(...)` returns, i.e. `this.renderedTriangles`. Not the registry count SHAPE INFO shows. During a shape transition `getRenderables()` returns both meshes, so the row correctly reads the sum |
| Row 2 | `PLN` · `FLOOR_01` · `2 △` | `placeholder` — the repo's checker floor is drawn per-pixel by `BackgroundRenderer`, not as geometry, so `2` is nominal. Owned by de-mock E7 |
| Row 3 | `ENV` · `SKY_DOME` · `—` | `placeholder` — sky gradient + bitmap live in `BackgroundRenderer`, no triangles. E7 |
| Row 4 | `LGT` · `KEY_LIGHT` · `—` | `placeholder` — the engine has no lighting model. E3 |
| Selection | one row highlighted, default the mesh row | UI state, see below. Selecting rows 2–4 changes nothing else: SHAPE INFO and SHAPE STORY stay bound to the active primitive (the mockup swaps them to `STATIC_INFO`, which has no repo equivalent). E7 |
| Visibility | `●` / `○` per row | Row 1: **real**, see below. Rows 2–4: `placeholder` — the glyph flips and the label dims but nothing changes on canvas |

Rows 2–4 and their visibility buttons carry the placeholder affordance defined in the primitives ticket (D4): `data-placeholder="true"` plus a `title` and `aria-describedby` saying the row is not yet backed by a real scene object.

**State lives in the shared store, not here.** Selection and mesh visibility are slices of `src/ui/uiState.ts`, which the shell ticket ships (D2); this ticket adds the slices and subscribes to them. It must not open a private store in `sceneGraph.ts`.

**Picking a primitive resets selection to the mesh row** (D11, design L1491 `pick: () => this.setState({ shape: k, selected: 'SPHERE_01' })`). Without this, selecting KEY_LIGHT and then choosing a new shape leaves a light row highlighted while the mesh changes underneath it.

**The drawn count is published once.** `src/index.ts` writes it into the store in the throttled branch of `fpsCounter()` — where it already updates the drawn-triangle readout on the 90ms `FPS_DISPLAY_UPDATE_INTERVAL_MS` cadence — plus `renderPausedFrame()` and `stop()`. Shell has already migrated `#trianglesRenderedNb` off its legacy id (D2). Scene graph subscribes and formats `<n> △`; it adds no second DOM write, no second throttle, and never writes per frame.

**Honour hiding the mesh.** `Surface3D.render` draws the background before iterating renderables (`src/primitives/Surface3D.ts` L27–L45), so hiding row 1 is `this.surface3D.render(meshHidden ? [] : this.getCurrentRenderables(), options)` at both call sites (`renderFrame` and `renderPausedFrame`, index.ts L498–L517) — background, floor and vignette keep drawing, the mesh disappears, and the drawn count correctly falls to 0. Wire it. Leave rows 2–4 as placeholders: `BackgroundRenderer` has no per-layer switches and adding them is E5/E7's job.

Known quirk to preserve, not fix here: `stop()` (index.ts L577–L584) zeroes `renderedTriangles` on pause, so row 1 reads `0 △` while paused, matching the toolbar readout. Do not diverge the two counters.

## Files

- `src/index.html` — the scene graph card, in the SHAPE INFO / SCENE GRAPH slot of the shell skeleton. One markup instance; the mobile branch is a media query, not a second tree.
- `src/styles/components/sceneGraph.css` (new) — body padding, row, columns and row states. No panel, header, title or note rules and no hit-area helper; those are primitives'.
- `src/ui/sceneGraph.ts` (new) — builds the four rows, subscribes to the selection / visibility / drawn-count slices of `uiState`, exposes `setMeshId(id)`.
- `src/ui/uiState.ts` — add the `sceneSelection`, `sceneHidden` and `drawnTriangles` slices if an earlier ticket has not.
- `src/index.ts` — instantiate `SceneGraph`; push the mesh id via `sceneObjectId(...)` from `syncShapeInfoPanel`; reset selection to the mesh row on primitive change; publish the drawn count from `fpsCounter()`, `renderPausedFrame()` and `stop()`; gate the renderables array on mesh visibility.
- `src/styles/main.css` — import the new component stylesheet.

## Done when

- [ ] Desktop card renders at 264px wide with a 24px header, 4px body padding and four 26px rows matching the design line-for-line.
- [ ] Row 1 shows the active primitive as `<UPPER_SNAKE>_01` produced by the shared `sceneObjectId()` — `TORUS_KNOT_01`, not `TORUSKNOT_01` — and updates on every shape change, including through the 1250ms transition.
- [ ] `grep -n "toUpperCase" src/ui/sceneGraph.ts` returns nothing: the id rule exists only in `src/ui/sceneObjectId.ts`.
- [ ] Row 1's triangle count is the drawn count and matches the toolbar readout exactly, updated on the existing 90ms throttle, never per-frame.
- [ ] Rows 2–4 render the placeholder values `2 △`, `—`, `—` with the correct kind tags and carry `data-placeholder="true"` with a title.
- [ ] Clicking a row selects it: highlighted background, 2px yellow left mark, white id. Only one row can be selected.
- [ ] Picking a different primitive returns selection to the mesh row, verified by selecting KEY_LIGHT first.
- [ ] Clicking the visibility button toggles the glyph and never changes the selection (verified by clicking the dot on an unselected row).
- [ ] Hiding row 1 removes the mesh from the canvas while the sky, floor and vignette keep rendering; showing it restores the mesh; the drawn count reads 0 while hidden.
- [ ] Hidden rows use `var(--color-text-disabled)` for both the id and the `○` glyph.
- [ ] Hover highlight only fires under `@media (hover: hover)`.
- [ ] Selection and visibility are readable from `uiState`; `sceneGraph.ts` declares no module-level state of its own.
- [ ] Mobile: card is the first SCENE-tab card with a 26px header, 5px body padding and 44px rows; the visibility button paints 30×30 but has a 44×44 hit area through primitives' `.tap-pad`, verified in device emulation at 320px.
- [ ] Both row and visibility button are focusable, operable with Enter/Space, and expose an accessible name.
- [ ] `sceneGraph.css` contains no `.panel*` selector and no raw hex or px literals outside the documented hit-area pad.
