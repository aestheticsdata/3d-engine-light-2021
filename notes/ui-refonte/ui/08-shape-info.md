# Shape info panel

The shape info panel is the seven-row key/value readout under the scene graph: the hard facts about the selected mesh (name, point count, triangle count, textures, opacity) plus a divided-off pair of render facts (shading, material). Five of the seven rows already have real sources in `src/index.ts`; this ticket restyles them to the design, adds the two new rows, and owns the `texLabel` derivation the HUD and the status bar consume.

**Design source** — `3D Engine UI.dc.html` desktop L96–L132, mobile L799–L835.

## Desktop

Card: the shared `.panel` recipe from the primitives ticket plus `flex: 0 0 auto`. Second child of the 264px left column, between SCENE GRAPH and SHAPE STORY. Header: `.panel__header` with `.panel__title` `SHAPE INFO` and `.panel__note` carrying the literal `MESH`.

Body: `.panel__body` (7px 8px) wrapping an `.info-list` (column, `gap: var(--space-px)` 1px). Rows are `.info-row` with `.info-row__label` and `.info-row__value`. All of that geometry and typography is primitives' — this ticket writes markup, not a second copy of the recipe. Labels are uppercase written literally in the markup, not via `text-transform`.

Row order: NAME, POINTS, TRIANGLES, TEXTURES, OPACITY, divider, SHADING, MATERIAL.

Divider: `.divider--inset` (1px, `margin: var(--space-2) 0`). It is a `<div>`, not a border, so the 1px row gap either side stays intact.

SHADING and MATERIAL use `.info-row__value--ok`, the `var(--color-state-ok)` value modifier.

The only rule this ticket's own stylesheet adds is the overflow guard (new, not in the mockup): values can exceed the 264px column — `TEXTURES` on the cube reads `dog, galaxy`. Give the value span `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` and a `title` attribute carrying the full text.

## Mobile

Second of the three left-column cards in the mobile **SCENE** tab (design L799–L835), directly under SCENE GRAPH and above SHAPE STORY. `.colLeft` is `display: contents` below 900px, so the card is a direct flex item of `#app`; this ticket adds no margin and no `flex`.

**The fade wrapper must not become `display: contents`.** An element with `display: contents` generates no box, so `#shapeInfoPanelContent` would lose the fade entirely. Below 900px it keeps a box and instead becomes `flex: none; display: flex; flex-direction: column; gap: var(--space-5)` (10px) with the tab-panel `order`, so info and story stack at exactly the tab's own 10px gap and line up with the SCENE GRAPH card above and the GESTURES card below.

Every mobile delta the design shows is already in the primitives media block and must not be restated: header 26px with 9px padding, `.panel__body` 9px, `.info-list` gap `var(--space-1)` (3px), `.info-row` height `var(--size-row-info)` (24px), label `var(--text-base)` at `var(--tracking-md)`, value `var(--text-md)`. `.divider--inset` is unchanged at 1px with 5px margins.

What this ticket must check on mobile rather than declare: the value clamp still applies at the wider mobile type. At 320px the card is 300px, 9px padding each side leaves 282px, and `TRIANGLES` at 10px sans plus `7920` at 11px mono fits with room; `dog, galaxy` at 11px mono against the `TEXTURES` label is the tight case and must ellipsise rather than wrap the row to two lines, which would break the fixed 24px height.

No interactive elements in this panel, so no touch-target work.

## Data

All five top rows are already computed by `syncShapeInfoPanel(primitive)` in `src/index.ts` (L283–L315). Keep the existing element ids so the wiring does not have to change; add three new ids for the header note and the two new rows.

| Field | Value shown | Source today |
| --- | --- | --- |
| Header kind note | `MESH` | Constant literal. The mockup drives it from `info.kindLabel`, which varies per selected scene object; this engine has one mesh. De-mock E7 takes it over |
| NAME | e.g. `Torus Knot` | `this.formatPrimitiveName(primitive)` (index.ts L294, helper at L272–L277) |
| POINTS | e.g. `288` | `String(object3D.points.length)` (index.ts L295) |
| TRIANGLES | e.g. `576` | `String(object3D.triangles.length)` (index.ts L296) — the **registry** count (D6), static per shape. Deliberately not the drawn count the scene graph and the toolbar show |
| TEXTURES | `dog, galaxy` or `none` | `MaterialSummary.textureKeys`, see below |
| OPACITY | e.g. `100%` | `` `${Math.round(this.opacity * 100)}%` `` via `syncShapeInfoOpacity()` (index.ts L279–L281), re-run from `changeOpacity` on every slider input |
| SHADING | `WIRE` or `FLAT` | `modeLabel()`, owned by the render-tab ticket (D5), see below |
| MATERIAL | `TEXTURED` or `SOLID` | `MaterialSummary.label`, owned here, see below |

**The texture derivation is this ticket's export (D5).** It shipped as the class `MaterialSummary` in `src/ui/MaterialSummary.ts` — constructed from the `Object3D`, not keyed by primitive key — holding the derivation that was inline in the old `Main`:

- `new MaterialSummary(object3D)` — dedups the triangle material slot once in the constructor, `Array.from(new Set(object3D.triangles.map(t => t[3]).filter(isTextureKey)))`, frozen.
- `get textureKeys(): readonly string[]` — the deduped list. The TEXTURES row joins it with `", "` and falls back to `"none"`.
- `get label(): "TEXTURED" | "SOLID"` — non-empty list → `TEXTURED`, otherwise `SOLID`. The MATERIAL row renders it verbatim.

One instance per shape change, shared by all three surfaces: that is the point of the class, and why the two getters read one field instead of each re-running the pipeline.

`TEXTURED` / `SOLID` are the only two strings. The viewport-hud texture chip and the status-bar texture segment take the same `MaterialSummary` and must not produce `NO TEXTURE` or an uppercased material list. The row is still `placeholder` in the sense that there is no material picker — the mockup's `TEX` map (CHECKER / SOLID / UV GRID / NO TEXTURE) belongs to de-mock E4.

**`modeLabel` is render-tab's export (D5), consumed here.** Until render-tab lands, SHADING carries the interim derivation `this.wireframeEnabled ? "WIRE" : "FLAT"`, pushed from `toggleWireframe` and `resetControls`. When render-tab ships `shadingMode` in `UIStateStore` and exports `modeLabel()`, this row switches to the import and the interim derivation is deleted — there must never be two copies of the mapping. The other four modes in the mockup's `MODES` map (POINTS, GOURAUD, DEPTH, NORMALS) are de-mock E3.

`ShapeInfo.textureSummary` in `src/data/shapeInfo.ts` stays unused by this panel — the derived material list is real data and the hand-written summary is not. Do not swap to it; removing the field is out of scope.

## Constraints

Shell has already replaced `src/index.html` wholesale and re-provided every id `Main`'s constructor resolves, including the `shapeInfo*` ids, as bare placeholder nodes (D2). This ticket replaces shell's placeholder SHAPE INFO card with the real one. Two things must survive:

1. **The fade animation.** `animateShapeInfoPanel` (index.ts L334–L358) adds `panelFadeOut` to `#shapeInfoPanelContent`, waits `SHAPE_INFO_PANEL_FADE_DURATION_MS` (180ms), swaps the text, then adds `panelFadeIn`. In the new layout SHAPE INFO and SHAPE STORY are two separate sibling cards, not two `.panelSection`s inside one container. Keep a single fade container wrapping **both** cards (and not the scene graph, whose row highlight must not flicker on shape change) and keep the id `shapeInfoPanelContent`, so both cards fade as one unit exactly as today.

   The wrapper is itself a flex item of the left column, which changes two things: it must carry `flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--space-4)` so the story card's `flex: 1` still resolves against the remaining height and the 8px gap between the two cards is preserved.

   `.panelFadeOut` / `.panelFadeIn` and `@keyframes panelFadeOut` / `panelFadeIn` (`src/styles/main.css` L66–L96) are the "panel fade keyframes" the shell ticket hands to a widget: this ticket **relocates them into `shapeInfo.css` unchanged** — opacity plus ±8px translateX over 180ms — it does not delete them. The `will-change: opacity, transform` currently on `.panelContent` (L62–L64) moves onto `#shapeInfoPanelContent` at the same time, because shell deletes `.panelContent`.
2. **The element ids.** `shapeInfoName`, `shapeInfoPoints`, `shapeInfoTriangles`, `shapeInfoTextures`, `shapeInfoOpacity` are looked up by `getElementById` in the constructor and hard-fail with `"UI controls are missing."` if absent. New ids to add: `shapeInfoKind`, `shapeInfoShading`, `shapeInfoMaterial`, wired the same way.

## Files

- `src/index.html` — the SHAPE INFO card; keep `#shapeInfoPanelContent` as the fade wrapper around both this card and the story card.
- `src/ui/MaterialSummary.ts` (new) — the `textureKeys` / `label` getters, consumed by viewport-hud and status.
- `src/styles/components/shapeInfo.css` (new) — the value clamp, the fade wrapper (`#shapeInfoPanelContent` box + `will-change`) and the relocated fade classes and keyframes. No panel, header, info-row or divider rules; those are primitives'.
- `src/styles/main.css` — import the new component stylesheet; delete the superseded `.panelSection` / `.infoRow` / `.infoLabel` / `.infoValue` rules (L102–L128), `.panelHeader` (L41–L43) and `#shapeInfoPanel` (L58–L60). Leave `.panelTitle` / `.panelSubTitle` (L45–L56) to the shape-story ticket, which removes their last user, and leave `.panelContent` (L62–L64) to shell (D2).
- `src/index.ts` — add the three new node lookups; build one `MaterialSummary` per shape change instead of the inline dedup; extend `syncShapeInfoPanel` to write MATERIAL; push SHADING from `toggleWireframe` and `resetControls`.

## Done when

- [ ] Desktop card renders 19px rows with a 1px inter-row gap and 7px 8px body padding; labels 9px Space Grotesk at .11em in `var(--color-text-muted)`, values 10px JetBrains Mono in `var(--color-text-primary)`.
- [ ] SHADING and MATERIAL values render in `var(--color-state-ok)` and are separated from the top five rows by the 1px divider with 5px margins.
- [ ] All five top rows show live values and update on shape change, verified across all 8 primitives including `cross` (whose `shapeInfo` entry, `src/data/shapeInfo.ts` L62–L70, has no `references`).
- [ ] TRIANGLES shows the registry count and does **not** move when culling is toggled; the scene-graph mesh row does.
- [ ] OPACITY updates while dragging the opacity slider and resets to `100%` when backface culling is switched on.
- [ ] SHADING flips between `FLAT` and `WIRE` when the wireframe toggle changes, and resets with `resetControls`.
- [ ] MATERIAL reads `TEXTURED` on the cube and `SOLID` on every other primitive, sourced from `MaterialSummary.label`.
- [ ] `src/ui/MaterialSummary.ts` is the only place the `rgba(` material filter appears; `grep -rn "startsWith(\"rgba\")" src` returns exactly one hit.
- [ ] Changing shape still plays the 180ms fade-out / fade-in on the info and story cards together, with no flicker on the scene graph, an unchanged 8px gap between the two cards, and the story card still absorbing the leftover column height.
- [ ] The fade classes and keyframes live in `shapeInfo.css` and are byte-identical in timing and transform to the `main.css` originals.
- [ ] A long value (`dog, galaxy`) ellipsises instead of wrapping or overflowing the 264px column, and exposes the full text via `title`.
- [ ] Mobile: card is the second SCENE-tab card with a 26px header, 9px body padding, 3px row gap and 24px rows; labels 10px at .1em, values 11px; no row wraps to two lines at 320px.
- [ ] `shapeInfo.css` contains no `.panel*`, `.info-row*` or `.divider*` selector, and no raw hex or px literals.
