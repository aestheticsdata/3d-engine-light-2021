# WORLD tab: camera and environment

The WORLD tab is the third inspector tab: where the camera is and what the scene is made of around the shape. It is the tab with the highest proportion of real engine behind it — zoom is live, field of view is made live here, and the sky and floor toggles are a genuinely small change to `BackgroundRenderer`. It ships `BackgroundRenderer.setLayers({ sky, floor })`, which the viewport quick toggles then consume. The rest is built now and wired later.

**Design source** — `3D Engine UI.dc.html` desktop L588–L638, mobile L979–L1033.

## Desktop

Same tab body as the other two tabs (`padding: var(--space-4)`, sections stacked with `gap: var(--space-4-5)`), headings in `.section-title`, and one `.divider` between CAMERA and ENVIRONMENT (L613). Desktop order is CAMERA, then ENVIRONMENT.

The chip recipe, the segmented toggle and its colour slots, the slider row geometry and the range skin all belong to the primitives ticket. This ticket restates none of them; it composes `.chip-grid` / `.chip--view` / `.chip--proj` / `.toggle-row` / `.toggle` / `.slider-row` and reuses the `chipGrid.ts`, `toggleRow.ts` and `sliderRow.ts` factories from the SHAPE and RENDER tab tickets.

### CAMERA (L590–L611)
View presets: `.chip-grid` with `--chip-cols: 5`, chips `.chip--view`, `margin-bottom: var(--space-4)`. Labels FRNT, BACK, TOP, SIDE, ISO. These chips are **momentary, not stateful**: the mockup builds them with `chip(false)` unconditionally (L1498–L1501), so they never take `.is-active` — press feedback only. `chipGrid.ts` needs a momentary variant for this.

Projection pair: `display:flex; gap: var(--space-1-5); margin-bottom: var(--space-4)`; two `flex:1` `.chip--proj` buttons using the standard active/inactive chip states. The design declares no hover on these two; they inherit the shared chip hover for consistency, which is a deliberate deviation worth a comment.

Then FOV 15..120 `°` and ZOOM 0..100 `%` as two `.slider-row`s (`cameraSliders`, L1420).

### ENVIRONMENT (L615–L637)
Four `.toggle-row`s: SKY DOME, CHECKER FLOOR, GRID OVERLAY, GROUND SHADOW (`worldToggles`, L1509–L1514). Then FOG 0..100 `%` and GRID STEP 1..20 `m` as two `.slider-row`s (`worldSliders`, L1421).

## Mobile

**The mobile branch inverts the section order**: ENVIRONMENT card first (L981–L1005), CAMERA card second (L1007–L1031). Follow the design — on a phone the environment toggles are the cheaper, more tappable controls and belong above the fold.

Both are full-bleed `.panel` cards in the page column with `gap: var(--space-5)`, each opening with a 26px `.panel__header` carrying the section name as its `.panel__title`.

- ENVIRONMENT card: `.panel__body--pad-list`. The four `.toggle-row`s take the primitives mobile treatment — `--size-toggle-row` 48px, a `border-bottom` in `var(--color-border-row)`, a brighter and larger label than desktop (`var(--text-md)` in `var(--color-text-secondary)`), control painted 88 × 32. FOG and GRID STEP follow as stacked sliders using `.slider-row--tight-bottom` (`padding: var(--space-4-5) 0 var(--space-1)`, L996), not the `var(--space-3) 0` used elsewhere, because they sit directly under a bottom-ruled row.
- CAMERA card: `.panel__body--pad-form`. View chips keep `--chip-cols: 5` with `--size-chip-view` at 40px and the grid gap at `var(--space-2-5)`, `margin-bottom: var(--space-4)`. At a 320px viewport the card body is 278px wide, less four 6px gaps, giving 50.8px per chip — the four-glyph FRNT/BACK/SIDE labels at 10px mono fit, and 40px clears the touch minimum vertically. Projection pair `gap: var(--space-2-5); margin-bottom: var(--space-2-5)` at `--size-chip-proj` 40px. Then FOV and ZOOM as ordinary stacked `.slider-row`s, label and value in a `.slider-row__head` above a full-width input at `var(--size-slider-input)` (26px).

As on the RENDER tab, the painted 32px toggle sits in a 48px row — `toggleRow.ts` binds the click and switch semantics to the whole row.

## Zoom — real

ZOOM is live today. `sliderToZoomOffset` (`src/index.ts` L47–L55) maps the 0..100 slider through `lerp(ZOOM_ZOFFSET_FAR = 260, ZOOM_ZOFFSET_NEAR = -220, progress)` into `zOffset`, which reaches every active mesh via `Mesh.changeOffsetZ` in `applyCameraSettingsToActiveMeshes`, and `changeZoom` re-renders the paused frame so the value is honest even when the animation is stopped. Keep all of that and keep `DEFAULT_ZOOM_SLIDER_VALUE = 50` (the mockup's 62 at L1176 is cosmetic).

The UI range and the engine range are identical here, so the new input keeps the `#zoomSlider` id and the existing `Controls.attachListener("#zoomSlider", …)` wiring is unchanged. This is the opposite of the SHAPE tab's rotation sliders, which change range and therefore change id.

## FOV — half-real, wired live

The engine has a focal length, not a field of view: `DEFAULT_FOCAL_LENGTH = 300`, applied through `Mesh.changeFocal`, and consumed in `Point3D.convert3D2D` as `scale = fl / (fl + z + zOffset)`. With the canvas fixed at 1024 × 640 the vertical half-height is 320, so the two are related exactly:

```
focal = (canvas.height / 2) / Math.tan((fovDeg * Math.PI / 180) / 2)
```

Add `changeFov` mirroring `changeZoom` — recompute `this.focal`, call `applyCameraSettingsToActiveMeshes()`, call `renderPausedFrame()`. Three things to record in a comment next to the mapping:

- The slider is integer-stepped 15..120 (L1420), but the exact inverse of focal 300 is `2 · atan(320/300) ≈ 93.7°`, which is not an integer. The slider defaults to **94**, the nearest step, and that yields focal 298.4 rather than 300 — a ~0.5% difference in projected scale on the first frame. Accepted, not pixel-identical, and said so out loud.
- There is no dolly compensation, so changing focal also changes apparent object size. It behaves like a second zoom rather than a true FOV. De-mock E2 owns compensating `zOffset` so the subject stays framed.
- `scale` goes negative when `fl + z + zOffset` crosses zero, which already happens today at maximum zoom for large meshes (focal 300, `zOffset` −220, `z` −173 gives −93). A short focal makes it easier to hit. Clamp the applied focal to a minimum of 260; FOV values above roughly 102° are therefore clamped until de-mock E2 brings real near-plane clipping.

## View presets are inert here

> **Superseded by COS-237 (de-mock E1a).** The camera rig landed, and the five
> chips now ease to absolute angles. What survives of this section is the last
> sentence: they stay momentary and never render active. The placeholder
> affordance and its hint are gone.

The mockup's presets set absolute angle pairs (L1498–L1501): yaw `[0, 180, 137, 90, 45]` and pitch `[0, 0, 78, 0, 30]` for FRNT / BACK / TOP / SIDE / ISO. This engine's pitch and yaw are per-frame rotation *rates* offset from the canvas centre (`rotateMesh`, `src/index.ts` L423–L440), and the epic keeps them that way — "set yaw to 180" would set a spin rate, not a viewpoint.

The five preset chips are therefore placeholders in this ticket: they render, are momentary, are keyboard reachable, carry the primitives placeholder affordance, and do nothing. They become real in de-mock E1 (camera rig), which introduces absolute pitch/yaw/roll. They stay momentary and stateless after that too — the design never renders them active.

## Environment — sky and floor are a small real change, shipped here

`BackgroundRenderer.render` (`src/rendering/BackgroundRenderer.ts` L16–L26) unconditionally runs `renderSky` → `renderAtmosphere` → `renderFloor` → `renderVignette` on every frame. Two constraints:

- The renderer is constructed once at boot with fixed `{ width, height, skyImage }` (`src/index.ts` L677–L681). Layer flags must therefore be **settable after construction** — add `setLayers({ sky, floor })` and have `render()` honour it. Do not attempt to pass them through the constructor.
- The canvas is fixed at 1024 × 640, and that size is baked into both `BackgroundRenderer` and `ShapeTransitionMachine` at construction. Nothing in this tab may resize the canvas; that is de-mock E9.

Behaviour:
- SKY DOME off ⇒ skip `renderSky` and `renderAtmosphere` (the atmosphere is the horizon haze belonging to the sky) and fill the frame flat with the app background before drawing the floor. Canvas 2D cannot read CSS custom properties, so add `bgApp: "#05091A"` to `src/ui/chartTokens.ts` — the one file the tokens ticket sanctions as a hand-mirrored copy of `colors.css` — rather than introducing a second mirror.
- CHECKER FLOOR off ⇒ skip `renderFloor`.
- `renderVignette` always runs; it is not a toggleable layer.

GRID OVERLAY, GROUND SHADOW, FOG and GRID STEP have nothing behind them at all and are owned by de-mock E5.

## Shared state with the viewport quick toggles

SKY, FLOOR and GRID appear both here as full ON/OFF rows and in the viewport HUD as quick-toggle chips (`quickToggles`, L1409, built from `quick()` L1333–L1341). They are the same three booleans in `src/ui/UIStateStore.ts`, not two parallel sets; both surfaces subscribe. Flipping the HUD chip repaints this tab's toggle in the same frame, and vice versa. The same rule already applies to WIRE and CULL between the HUD and the RENDER tab.

GRID defaults **OFF** in both surfaces. Nothing in the renderer draws a grid, and a pill or a toggle showing ON would claim something the canvas is not doing.

## Data

| Field | Value shown | Source today |
|---|---|---|
| View preset chips | FRNT / BACK / TOP / SIDE / ISO, momentary | `placeholder` — inert while rotation is rate-based; owned by de-mock E1 |
| PERSPECTIVE | selected | real — the only projection the engine has (`Point3D.convert3D2D`); selected by default |
| ORTHOGRAPHIC | not selected | `placeholder` — owned by de-mock E2 |
| FOV | `v + "°"` | real — `focal = 320 / tan(fov/2)`, clamped to ≥ 260, default 94 (focal 298.4, ~0.5% off the current 300) |
| ZOOM | `v + "%"` | real — `sliderToZoomOffset` (`src/index.ts` L47), 0..100 → `zOffset` 260 down to −220, default 50 |
| SKY DOME | ON / OFF | real — `store.sky` through `BackgroundRenderer.setLayers`, shipped in this ticket; default ON |
| CHECKER FLOOR | ON / OFF | real — `store.floor` through the same call; default ON |
| GRID OVERLAY | ON / OFF | `placeholder` — `store.grid`, default **OFF**; owned by de-mock E5 |
| GROUND SHADOW | ON / OFF | `placeholder` — default OFF; de-mock E5 |
| FOG | `v + "%"` | `placeholder` — default 18; de-mock E5 |
| GRID STEP | `v + "m"` | `placeholder` — default 4; de-mock E5 |

Every placeholder control carries the primitives placeholder affordance (`data-placeholder="true"` + `title` + `aria-describedby`) and writes its slice of `src/ui/UIStateStore.ts`.

## Files

- `src/ui/inspector/worldTab.ts` — new
- `src/ui/inspector/controls/chipGrid.ts` — reused; extended with a momentary (stateless) chip variant for the view presets
- `src/ui/inspector/controls/toggleRow.ts` — reused from the RENDER tab ticket
- `src/ui/inspector/controls/sliderRow.ts` — reused from the SHAPE tab ticket
- `src/rendering/BackgroundRenderer.ts` — add `setLayers({ sky, floor })` and honour it in `render()`; flat-fill the frame when the sky is off
- `src/ui/chartTokens.ts` — add `bgApp` (`#05091A`) alongside the existing chart colours
- `src/index.ts` — add `changeFov` mirroring `changeZoom` with the ≥ 260 focal clamp; hand the background renderer to the world tab so the toggles can reach it; move the zoom slider wiring into the tab
- `src/ui/UIStateStore.ts` — extended with `projection`, `fov`, `sky`, `floor`, `grid`, `shadow`, `fog`, `gridStep`
- `src/index.html` — mount the tab into the WORLD slot the shell created; the parked zoom range input is consumed here

No new stylesheet: every rule this tab needs already exists in `src/styles/components/`.

## Done when

- [ ] ZOOM still maps 0..100 onto a z offset of 260 down to −220, still re-renders while paused, still defaults to 50, and still binds through the `#zoomSlider` id
- [ ] FOV is wired through `Mesh.changeFocal` with `focal = 320 / tan(fov/2)` clamped to ≥ 260; the slider defaults to 94, the nearest integer to the exact ≈93.7° that corresponds to `DEFAULT_FOCAL_LENGTH` 300, which yields focal 298.4 rather than 300 — the ~0.5% difference in projected scale is accepted and recorded in a comment next to the mapping, together with the reason for the clamp
- [ ] SKY DOME and CHECKER FLOOR toggle real layers through `BackgroundRenderer.setLayers` at runtime; with the sky off the frame fills flat from `chartTokens.bgApp` and the floor still draws; the vignette is unaffected
- [ ] The canvas is never resized and `BackgroundRenderer` / `ShapeTransitionMachine` are still constructed once with 1024 × 640
- [ ] SKY, FLOOR and GRID are single booleans shared with the viewport quick toggles; flipping either surface updates both in the same frame, and GRID reads OFF on first paint in both surfaces
- [ ] View preset chips are momentary, never render an active state, carry the placeholder affordance, and change nothing
- [ ] PERSPECTIVE is selected by default and ORTHOGRAPHIC selects visually while changing nothing on the canvas
- [ ] Placeholder controls (GRID OVERLAY, GROUND SHADOW, FOG, GRID STEP, ORTHOGRAPHIC, view presets) persist in `src/ui/UIStateStore.ts` and change nothing on the canvas
- [ ] The toolbar's RESET path restores every slice this ticket adds — projection, FOV, zoom, sky on, floor on, grid off, shadow off, fog, grid step
- [ ] At `max-width: 899px`: the ENVIRONMENT card renders above CAMERA, 26px card headers, 48px toggle rows with bottom rules and a full-row 48px hit area, FOG and GRID STEP using the tight-bottom slider padding, 40px view and projection chips, 26px slider tracks with the label/value row above
- [ ] This ticket declares no chip, toggle or range colour table and ships no new stylesheet
- [ ] Hover rules are inside `@media (hover: hover)`; chips, projection buttons and toggles are keyboard reachable with a visible focus state
- [ ] No raw hex or raw px for a tokenised value outside `src/styles/tokens/*.css` and `src/ui/chartTokens.ts`
