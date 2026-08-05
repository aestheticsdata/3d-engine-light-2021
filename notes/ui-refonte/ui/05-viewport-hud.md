# Viewport frame and HUD overlays

The viewport is the card holding `canvas#canvasID` plus the HUD layer stack drawn over it: status chips, camera readout, crosshair, selection bracket, axis gizmo, and the bottom chip strips. Today the canvas sits bare inside `#canvasWrapper`. This ticket fills the viewport card the shell skeleton provides: the canvas stage and every overlay, reading real engine state where it exists and a marked placeholder where it does not. Every chip surface, the camera-readout surface and the vertical rules come from the primitives component layer; this ticket owns anchors, the stage, and the layers the design draws only here (crosshair, selection bracket, gizmo).

**Design source** — `3D Engine UI.dc.html` desktop L166–L254, mobile L699–L738.

## Desktop

**Card** (L166). The shell ticket already ships it as the centre column's first slot — `flex: 0 0 var(--size-viewport-h)` (530px), `position: relative`, `background: var(--color-surface-sunken)`, the `.panel` border and radius, `overflow: hidden`. This ticket adds nothing to the card itself.

**Stage** (new, not in the design). The design paints an `<img>` with `object-fit: cover` at `inset: 0`. A canvas cannot be cropped that way without throwing pixels away, so insert `.viewportStage` between card and canvas: `aspect-ratio: 16 / 10; max-width: 100%; max-height: 100%; margin: auto; position: relative`. Canvas is `width: 100%; height: 100%; display: block`. The HUD is `position: absolute; inset: 0` of the **stage**, not the card, so overlays never float over letterbox bars.

This replaces the interim fit the shell ticket ships (`object-fit: contain` on the canvas directly inside the card, so the branch boots after shell alone). `object-fit` letterboxing is invisible to layout, so a HUD anchored to the card would inset itself from the bars rather than from the picture. Delete the `object-fit` rule when the stage lands.

16/10 is a happy match: the canvas backing store is `1024 × 640` = exactly 1.6, and the mobile branch asks for `aspect-ratio: 16/10` = exactly 1.6. Zero letterboxing on mobile at any width. On desktop a 530px-tall stage is 848px wide — exactly the centre-column width at the design's 1440px frame (`1440 − 2×8 padding − 264 − 296 − 2×8 gap = 848`) and exactly the `848 × 530` string hardcoded in the design's resolution chip (L179). Below that the column narrows, the stage shrinks under 530px tall, and `var(--color-surface-sunken)` shows as top/bottom letterbox inside the card.

**Canvas-size constraint.** The backing store cannot change. `1024 × 640` is written into `src/index.html` L57, and the same fixed `{width, height}` is passed to `BackgroundRenderer` and `ShapeTransitionMachine` at construction. Any responsive behaviour here is CSS scaling of a fixed-resolution raster only. Do not attempt to resize the canvas in this ticket.

**Shading-mode hook, and the two modes that are already real.** The design applies `filter: {{ vpFilter }}` to the render surface, from `FILTERS` (L1163–L1170): `points contrast(1.15) saturate(.7)`, `wire saturate(.5) contrast(1.2)`, `flat saturate(1.05) contrast(1.05)`, `gouraud none`, `depth grayscale(1) contrast(1.35) brightness(.9)`, `normals hue-rotate(155deg) saturate(1.6)`.

Two of the six modes exist in the engine today. `wireframeEnabled` (`src/index.ts` L110, flipped by `toggleWireframe` L546–L550, passed to `Surface3D.render` as `options.wireframe` L500–L513) is `WIRE` when on and `FLAT` when off. Both the mode chip text and the `data-shading-mode` attribute on `.viewport` are driven from `modeLabel()`, which the render-tab ticket owns and exports (D5) — the same helper the SHAPE INFO SHADING row and the status bar read, so the three cannot disagree. Do not hardcode `GOURAUD` and do not derive the label locally.

Write all six `[data-shading-mode="…"] .viewportStage canvas { filter: … }` rules, but note in code that they are a cosmetic mock, not shading, and that the de-mock ticket `Shading modes` replaces them with real per-face shading and deletes the rules. Because `flat` and `wire` are both non-`none`, a filter is now live in the default state and costs a full-frame composite at 1024 × 640 every frame — say so in the comment rather than letting it look free. POINTS, GOURAUD, DEPTH and NORMALS never appear until the de-mock ticket lands.

**The HUD is always on.** The design wraps every layer in one `sc-if value="{{ hud }}"` (L169) fed by the `hudOverlays` prop (L1396). That prop is a Claude Design preview control with no production surface and is dropped (D10). Build `.viewportHud` as a plain always-rendered root with one element and one stable class per layer; add no master toggle attribute and no per-layer gate attributes.

**Pointer events (new, not extracted).** `.viewportHud` is `pointer-events: none`; any future interactive child opts back in with `pointer-events: auto`. Without this the HUD would swallow the drag-orbit the de-mock camera ticket adds.

**No z-index.** Layer order is DOM order inside the `position: relative` card. The HUD introduces no stacking context and no `z-index`, so the mobile sticky header at `var(--layer-sticky)` (6) always wins over it (D11).

**Top-left status chips** (L171–L183): cluster `position: absolute; top: var(--space-5); left: var(--space-5)`, `display: flex; gap: var(--space-2)`. Four `.hud-chip` from `components/hud.css`; the mode chip takes `.hud-chip--accent`. Order: mode, projection, resolution, texture. This ticket declares no chip geometry, surface or type — that recipe belongs to primitives (D1).

The band at `top: 40px; left: 10px` (L185–L190) is the quick-toggle row and belongs to a separate ticket. Reserve it: this ticket must not place anything there.

**Top-right camera readout** (L192–L209): one `.hud-panel` at `top/right: var(--space-5)`. Four rows, each `display: flex; justify-content: space-between; gap: var(--space-5)`, key then value. Rows in order: `cam.pos`, `cam.rot`, `target`, `dist`. Key and value type come from `.hud-panel`.

**Crosshair** (L211–L212): two bars at `left: 50%; top: 50%`, `1px × var(--size-crosshair)` and `var(--size-crosshair) × 1px`, offsets `margin-left: -.5px; margin-top: -12px` and `margin-left: -12px; margin-top: -.5px`, `background: var(--color-crosshair)`.

**Selection bracket** (L214–L220): box at `left: 39.2%; top: 31.9%`, `var(--size-selection-box)` square (190px). Four corner marks `var(--size-selection-corner)` (14 × 14) with `var(--size-mark)` (2px) `var(--color-accent)` borders on the two edges facing each corner. Label badge above it: `top: -20px; left: 0; height: var(--size-selection-label-h)` (16px), `padding: 0 var(--space-2)`, `background: var(--color-accent)`, `border-radius: var(--radius-xs)`, `var(--font-weight-bold) var(--text-xs)/var(--leading-none) var(--font-mono)`, `letter-spacing: var(--tracking-chip)`, `color: var(--color-on-accent)`, text = selected id.

**Axis gizmo** (L222–L229): `bottom/left: var(--space-5)`, `var(--size-gizmo)` square (66px), `background: var(--color-hud-bg-gizmo)`, `border: var(--size-hairline) solid var(--color-hud-border)`, `border-radius: var(--radius-sm)`. X: `left: 14px; bottom: 14px`, `var(--size-gizmo-axis-xy) × var(--size-mark)`, `var(--color-axis-x)`. Y: same origin, `var(--size-mark) × var(--size-gizmo-axis-xy)`, `var(--color-axis-y)`. Z: `left: 15px; bottom: 15px`, `var(--size-mark) × var(--size-gizmo-axis-z)`, `var(--color-axis-z)`, `transform-origin: bottom center; transform: rotate(215deg)`. Letters `var(--font-weight-bold) var(--text-2xs)/var(--leading-none) var(--font-mono)` at X `right: 6px; bottom: 8px`, Y `left: 8px; top: 4px`, Z `right: 8px; top: 20px`, each in its axis colour.

**Bottom-right chips** (L231–L243): cluster `bottom/right: var(--space-5)`, `gap: var(--space-2)`. Three `.hud-chip`: `fov`, `zoom`, status. The status chip overrides `border-color: var(--color-state-ok-border)` and carries a single span in `var(--color-state-ok)` at `var(--font-weight-medium)`. These three carry **no** `backdrop-filter` in the design, unlike the top-left chips — reproduce that asymmetry with a local `backdrop-filter: none` on the cluster in `viewport.css` and comment it, so it is not silently "fixed" and so primitives' `.hud-chip` recipe stays untouched.

**Bottom-centre hint strip** (L245–L250): one `.hud-chip` at `bottom: var(--space-5); left: 50%; transform: translateX(-50%)`, overridden to `padding: 0 var(--space-5); gap: var(--space-4)` and `backdrop-filter: none`. Segments: selected id at `var(--font-weight-medium)` `var(--color-text-primary)`; a `.divider-v--hud` rule; `<n> tris drawn` at `var(--font-weight-regular)` `var(--color-text-tertiary)`; rule; `drag orbit · scroll zoom`.

**Hover states.** None in this widget; nothing here is interactive yet.

## Mobile

**Card** (L699). Also a shell slot: `width: 100%; aspect-ratio: 16 / 10`, same surface as desktop. The stage collapses to the card (the aspect matches the canvas exactly), so the HUD could anchor to either — keep `.viewportStage` so there is one code path.

HUD inset drops to `var(--space-4)` (8px). The mobile HUD surface itself — `var(--elevation-hud-bg-dense)` (`.85`) and no `backdrop-filter` — comes from primitives' `.hud-chip` rules inside `@media (max-width: 899px)`; this ticket does not restate it. Secondary chips use `.hud-chip--sm` (20px below 900px). `.hud-panel` is not used on mobile: the desktop readout collapses into the top-right chip column below.

**Present in the mockup:**
- mode chip (L703) `top/left: var(--space-4)`, `.hud-chip--accent` with **no letter-spacing** (desktop has `var(--tracking-xs)`).
- top-right column (L704–L713): `align-items: flex-end; gap: var(--space-1-5)` (4px); frame-ms chip (`.hud-chip`, 22px), then two `.hud-chip--sm`.
- second-row chips (L714–L717) `top: 36px; left: var(--space-4); gap: var(--space-2)`: projection, texture, both `.hud-chip--sm`.
- crosshair (L718–L719): `var(--size-crosshair)` arms, which resolves to 20px inside the `max-width: 899px` block, and `var(--color-crosshair-dim)` — a separate literal (`rgba(255,255,255,.5)`) rather than an override of `--color-crosshair`, per the tokens ticket. Centring offsets become `-10px`.
- selection box (L720–L724): `left: 39.2%; top: 31.9%; width: 22.4%; height: 35.8%`, corners `12 × 12` at `var(--size-mark)` accent.
- gizmo (L726–L730): `bottom/left: var(--space-4)`, `var(--size-gizmo)` (52px), axes at `var(--size-gizmo-axis-xy)` / `var(--size-gizmo-axis-z)` (26px / 18px), Z at `rotate(215deg)`, offsets 11px/12px.
- bottom-right chip (L731–L735): `.hud-chip` with `padding: 0 var(--space-4-5)`, `gap: var(--space-3)`, id + `.divider-v--hud` + `<n> △`.

**Dropped by the mockup — this ticket restores each:**

1. **Resolution chip.** Add as a third `.hud-chip--sm` on the 36px second row. At the narrowest supported width the three chips total roughly 190px, well inside a 300px-wide card.
2. **cam.rot / target / dist.** The desktop 4-row readout collapses into the top-right column, which becomes three stacked chips. The frame-ms chip is unchanged. Chip B replaces the single `camPos` chip and becomes a two-line stack: `height: auto; flex-direction: column; align-items: flex-end; padding: var(--space-2) var(--space-4); gap: 2px`, line 1 `pos <camPos>`, line 2 `rot <camRot>`. Chip C replaces the fov/zoom chip with the same stack: line 1 `fov <v>  zoom <v>`, line 2 `target <v>  dist <v>`. Keys keep `var(--color-text-hud-label)`, values `var(--color-text-secondary)`, all at `var(--text-sm) var(--font-mono)`. Height budget: 22 + ~30 + ~34 + two 4px gaps = ~94px against a 16/10 card that is ~188px tall at a 320px device width (300px wide inside the 10px page padding, design L674) — fits.
3. **Selection label badge.** Restore above the bracket at `top: -18px; left: 0`, `height: var(--size-selection-label-h)`, `padding: 0 var(--space-2)`, `var(--font-weight-bold) var(--text-sm) var(--font-mono)` (bumped from the desktop 8px for touch legibility), accent background on `var(--color-on-accent)` text. No flip guard is needed: the box top is 31.9% of the card, which is ~60px at a 320px device width, so the badge always clears the card edge.
4. **Gizmo X/Y/Z letters.** Restore at `var(--font-weight-bold) var(--text-xs)/var(--leading-none) var(--font-mono)` (8px, up from the desktop 7px so it survives at 52px). Positions are the desktop ones scaled by 52/66 and rounded: X `right: 5px; bottom: 6px`, Y `left: 6px; top: 3px`, Z `right: 6px; top: 16px`.
5. **Status chip.** Fold into the bottom-right chip as a leading segment: `<status>` in `var(--color-state-ok)` at `var(--font-weight-medium)`, then a `.divider-v--hud` rule, then id, rule, `<n> △`. Keep the chip border at `var(--color-hud-border)` rather than swapping to the green variant, so the chip does not change border colour on every pause. This duplicates the mobile status bar, which is acceptable because the status bar can be scrolled off while the viewport is in view.

**Not restored: the bottom-centre hint strip.** With the status segment folded in, the bottom-right chip runs about 169px including its 8px inset, and the gizmo takes 60px on the left, leaving roughly 71px of centre space on a 300px-wide card against a strip that needs about 139px for `drag orbit · pinch zoom`. It still does not fit at 390px. Rather than ship a strip that is hidden on every phone, the mobile gesture documentation lives in the GESTURES card the shortcuts ticket adds as the last card in the SCENE tab. Do not add a bottom-centre layer on mobile.

All restored elements are new spec, not extracted; mark them in CSS with a `/* not in mockup */` comment.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Shading mode chip | `WIRE` / `FLAT` | real — `modeLabel()`, exported by the render-tab ticket and driven by `wireframeEnabled` (`src/index.ts` L110, L546–L550). POINTS, GOURAUD, DEPTH and NORMALS are placeholder; de-mock `Shading modes` |
| Canvas filter | `saturate(.5) contrast(1.2)` / `saturate(1.05) contrast(1.05)` | placeholder — a cosmetic CSS filter keyed off the same `modeLabel()`, not shading; de-mock `Shading modes` deletes the rules |
| Projection chip | `PERSPECTIVE` / `ORTHOGRAPHIC` | ~~placeholder~~ real since COS-236 (de-mock E2). Not owned here: it carries the `projection` field the status bar writes, so the overlay and the bar cannot disagree |
| Resolution chip | `1024 × 640` | real — `canvasID.width` × `canvasID.height`. The design's `848 × 530` is the CSS box, not the backing store; show the backing store, since that is what the rasterizer works at |
| Texture chip | `TEXTURED` / `SOLID` | real — `MaterialSummary.label` from `src/ui/MaterialSummary.ts`, owned by the shape-info ticket (D5) and rendered verbatim by the SHAPE INFO MATERIAL row. Take the same instance; do not re-derive it and never print `NO TEXTURE`. De-mock `Texture picker` owns the CHECKER / SOLID / UV GRID / NO TEXTURE set |
| `cam.pos` | `0.0 1.2 12.0` | placeholder — the engine rotates the mesh; there is no camera transform; de-mock `Orbit camera` |
| `cam.rot` | `0.0° 0.0° 0.0°` | placeholder — the pitch/yaw/roll sliders are rotation-rate inputs, not camera Euler angles: pitch and yaw are 0–800 offset by `centerY` / `centerX` and divided by `PITCH_YAW_ROTATION_DIVISOR = 110`, roll is −1000–1200 divided by `ROLL_ROTATION_DIVISOR = 500` (`src/index.ts` L18–L19, L426–L439). The epic keeps those rate semantics (D9), so there is no angle to print. Do not render them as degrees; de-mock `Orbit camera` |
| `target` | `0.0 1.2 0.0` | placeholder — hardcoded in the design too (L203); de-mock `Orbit camera` |
| `dist` | `<n> u` | real, derived — `DEFAULT_FOCAL_LENGTH + sliderToZoomOffset(#zoomSlider.value)`, which stays positive across the slider (560 → 80). The raw offset alone runs 260 → −220 (`src/index.ts` L24–L25, L47–L55) and would print a negative distance. Unit is `u`, not the design's `m`: the engine has no metric scale |
| Selection id (bracket label, hint strip, bottom-right chip) | `SPHERE_01` | real — `sceneObjectId(activePrimitive)` from `src/ui/sceneObjectId.ts`, created by the shell ticket with the snake-case rule (`torusKnot` → `TORUS_KNOT_01`). Import it; do not re-derive it here |
| Selection bracket rect | `39.2% / 31.9%`, 190 × 190 | placeholder — no screen-space AABB exists; de-mock `Projected selection bounds` |
| Gizmo orientation | Z at `215deg` | placeholder — static in the design too; de-mock `Orbit camera` |
| `fov` | `60°` | placeholder — fixed focal length, no fov control; de-mock `Camera FOV` |
| `zoom` | `<n>%` | real — `#zoomSlider.value` |
| `status` | `RUNNING` / `PAUSED` | real — `isPlaying` |
| tris drawn | `<n>` | real, drawn count — the number `Surface3D.render(renderables, options)` returns, not the registry count (D6) |
| frame ms (mobile) | `<n> ms` | real — a `data-field="frameMs"` node fed by `FieldWriter.write`. The frame-time ticket owns the single measured value (`performance.now()` around the `Surface3D.render` call, smoothed on the 90ms display gate); do not compute a second value from smoothed fps. Frame-time lands after this ticket, so the chip shows an em dash until it does |
| Hint strip text (desktop only) | `drag orbit · scroll zoom` | placeholder — the canvas has no pointer handlers; de-mock `Orbit camera` |

## Files

- `src/index.html` — insert `.viewportStage > canvas#canvasID` plus the `.viewportHud` layer elements into the viewport card the shell skeleton provides. The shell ticket deletes the legacy `#canvasWrapper` and `canvas` CSS (D2); this ticket only changes markup.
- `src/styles/components/viewport.css` (new) — stage, letterbox, layer anchors, the crosshair, selection bracket and gizmo, the local `backdrop-filter: none` overrides, and the six `[data-shading-mode]` filter rules. Both branches.
- `src/styles/main.css` — add the component import after the token imports.
- `src/ui/ViewportHUD.ts` (new) — `class ViewportHUD`, constructed with the canvas and the shared `FieldWriter`; builds the layer DOM once and exposes `seed()`, `setMode(wireframeEnabled)` and `setZoom(sliderValue, distance)`; owns the placeholder constants and their de-mock annotations. Imports `sceneObjectId` from `src/ui/sceneObjectId.ts` and `modeLabel()` from `src/ui/modeLabel.ts`, and is handed the `MaterialSummary` from `src/ui/MaterialSummary.ts` (shape-info) rather than deriving the label itself.
- `src/index.ts` — construct `ViewportHUD` and call `update()` from `fpsCounter()` and after `renderPausedFrame()`, writing through shell's field writer so the HUD and the telemetry cards cannot show different triangle counts.

## Done when

- [ ] Desktop viewport card is 530px tall with the 1px panel border and 4px radius, and the canvas is centred inside it with `var(--color-surface-sunken)` letterbox when the column is narrower than 848px.
- [ ] At a 1440px window the stage measures exactly 848 × 530 with no letterbox.
- [ ] Mobile card is `aspect-ratio: 16/10` and the canvas fills it edge to edge with zero letterbox at 320px, 390px, and 430px widths.
- [ ] All seven desktop HUD layers render at the specified anchors; the four top-left chips and the camera readout keep primitives' `backdrop-filter`; the three bottom-right chips and the hint strip are overridden to none.
- [ ] Every chip, the camera readout and every vertical rule use `.hud-chip` / `.hud-panel` / `.divider-v--hud` from the primitives layer; `viewport.css` declares no chip geometry, surface or type of its own.
- [ ] Mobile restores the resolution chip, `cam.rot` / `target` / `dist`, the selection label badge, the gizmo X/Y/Z letters and the status segment; no bottom-centre layer exists on mobile.
- [ ] The HUD renders unconditionally — no `hudOverlays` gate, no `data-hud` attribute, no per-layer gate attributes.
- [ ] `.viewportHud` is `pointer-events: none` and declares no `z-index`; clicking through the HUD reaches the canvas, and the mobile sticky header covers the viewport when scrolled under it.
- [ ] The mode chip reads `WIRE` with wireframe on and `FLAT` with it off, matching the SHAPE INFO SHADING row exactly, and both come from the one exported `modeLabel()`.
- [ ] `data-shading-mode` follows the same flag; the `wire` and `flat` filter rules apply and the other four are present but unreachable until the de-mock ticket.
- [ ] `dist` is positive across the whole zoom slider (560 → 80) and never prints a negative number.
- [ ] Live values (`zoom`, `status`, tris drawn, texture, resolution, `dist`, mode, frame ms) update every frame; placeholder values are constants and each is annotated in code with its de-mock ticket.
- [ ] No canvas resize is attempted; `1024 × 640` remains the single source of truth shared with `BackgroundRenderer` and `ShapeTransitionMachine`.
- [ ] No `*-mobile` token name is referenced; mobile HUD sizes come from the tokens overridden in `@media (max-width: 899px)` and the denser surface from `--elevation-hud-bg-dense` / `--color-crosshair-dim`.
- [ ] No raw hex or px outside the token files, except the documented sub-pixel centring offsets (`-.5px`), the gizmo inset offsets, and the design's fixed percentage anchors.
