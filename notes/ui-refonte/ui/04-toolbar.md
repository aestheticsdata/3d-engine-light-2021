# Top toolbar: brand block, transport, live readouts, action cluster

The single row that sits above everything else and carries the app's identity, the transport controls, the two live engine readouts (fps and frame time), and the file/action cluster. It replaces the current `#playPause` and `#resetControls` buttons that live inside the `#controls` aside today. It also owns RESET for the whole console: the desktop RESET button and the mobile RESET SCENE bar are one behaviour with two mounts, and every control the epic adds afterwards has to be restored by it.

**Design source** — `3D Engine UI.dc.html` desktop L36–L73, mobile L676–L697 and L1112, reset semantics L1303–L1307.

## Desktop

The 40px row and its two `.panel` boxes are part of the skeleton the app-shell ticket ships; this ticket fills them and adds nothing structural. Geometry for reference: outer row (L36) `flex: 0 0 var(--size-toolbar-h)` (40px), `display:flex`, `align-items:stretch`, `gap: var(--space-4)` (8px).

Brand block (L37–L42): `flex: 0 0 var(--size-sidebar-w)` (264px), `align-items:center`, `gap: var(--space-4-5)` (9px), `padding: 0 var(--space-5)` (0 10px).
- Mark (L38): `var(--size-brand-mark)` 16x16, `background: var(--color-accent)`, `border-radius: var(--radius-xs)` (1px).
- Text column: `gap: var(--space-0-5)` (2px).
- Wordmark (L40): `1991COMPUTER`, `font: var(--font-weight-bold) var(--text-md)/var(--leading-none) var(--font-sans)`, `letter-spacing: var(--tracking-2xl)` (.14em), inherits `var(--color-text-primary)`.
- Build string (L41): `HALCYON&nbsp;&nbsp;BUILD 0.9.4`, `font: var(--font-weight-regular) var(--text-xs)/var(--leading-none) var(--font-mono)`, `letter-spacing: var(--tracking-md)` (.1em), `color: var(--color-text-dim)`. The double space between the product id and the build is literal in the design; keep it as two `&nbsp;`.

Strip (L45): `flex:1`, `min-width:0`, `align-items:center`, `gap: var(--space-2-5)` (6px), `padding: 0 var(--space-4)` (0 8px). Children in source order:

1. PAUSE/RESUME primary (L46–L48): the `.btn--primary` recipe from the primitives ticket, unmodified. The `gap:7px` on this node is vestigial (single child) — drop it.
2. STEP (L49) and RESET (L50): `.btn--secondary`, unmodified.
3. Divider (L52): `var(--size-hairline)` x `var(--size-divider-toolbar)` (1 x 20px), `background: var(--color-border-muted)`, `margin: 0 var(--space-1-5)` (0 4px).
4. RENDER LOOP readout (L54–L59): `height: var(--size-button)` (26px), `padding: 0 var(--space-5)`, `gap: var(--space-3)` (7px), `background: var(--color-surface-sunken)`, `border: var(--size-hairline) solid var(--color-border-muted)`, `border-radius: var(--radius-md)`. Contents: `var(--size-rec-dot)` (6px) dot with `border-radius: var(--radius-full)`, `background: var(--color-state-ok)`, `animation: recblink var(--duration-blink) infinite`; label `RENDER LOOP` `font: 500 var(--text-sm)/1 var(--font-sans)` `letter-spacing: var(--tracking-md)` `color: var(--color-text-tertiary)`; value `font: 700 var(--text-md)/1 var(--font-mono)` `color: var(--color-text-primary)`; unit `fps` `font: 400 var(--text-sm)/1 var(--font-mono)` `color: var(--color-text-dim)`.
5. FRAME readout (L60–L64): identical shell, no dot. Label `FRAME`, value = frame time, unit `ms`.
6. Spacer (L66): `flex:1`.
7. CAPTURE PNG / SAVE PRESET / LOAD (L68–L70): `.btn--secondary`, exactly as STEP and RESET. The design sets these three to `500 9px` while L49–L50 are `500 10px`; that inconsistency is deliberately **not** preserved — the primitives ticket standardises every secondary button on `--text-base` (10px). No separate action-cluster class.
8. COPY CODE (L71): `.btn--code`. Label is the escaped `</> COPY CODE`.

The four button recipes and all their hover rules belong to the primitives ticket. This ticket declares no button colours, no button type and no `:hover`; `src/styles/components/toolbar.css` holds row, brand-block and readout geometry only.

Every clickable node is a real `<button type="button">` (the design uses divs). The two readouts are `<span>` with `aria-live="off"` so screen readers are not spammed at 11 updates/second, and each value node carries a `data-field` name so `FieldWriter.write` reaches both branches at once.

Width behaviour (new, not in the mockup): the design's toolbar is authored inside a fixed 1440px frame. The rebuild is fluid above 900px, so the spacer collapses first, and the four action buttons sit in their own `overflow-x: auto` sub-cluster with `min-width:0`, so the brand block, transport cluster and the two readouts never compress. Record this as a rebuild decision in a CSS comment.

Paused state (new, not in the mockup): the design has no paused variant of the REC dot. Add one — when the loop is stopped, the dot gets `animation-play-state: paused` and `background: var(--color-text-dim)`. The fps and ms readouts keep the engine's existing paused behaviour (`Main.stop()` writes `0`).

## Mobile

Sticky header (L676): `position:sticky`, `top:0`, `z-index: var(--layer-sticky)` (6), `height: var(--size-appbar-h)` (52px), `align-items:center`, `gap: var(--space-4-5)` (9px), `padding: 0 var(--space-5)` (0 10px), panel background/border/radius as desktop. No widget may introduce a competing z-index against this.
- Mark (L677): `var(--size-brand-mark)` resolves to 18px below 900px; otherwise identical.
- Text column (L678): `gap: var(--space-1)` (3px). Wordmark `700 var(--text-xl)/1 var(--font-sans)` `letter-spacing: var(--tracking-xl)` (.12em). Build string is shortened to `HALCYON 0.9.4` (one space, no `BUILD` word) at `400 var(--text-xs)/1 var(--font-mono)` `letter-spacing: var(--tracking-xs)` (.08em) `color: var(--color-text-dim)`.
- Spacer `flex:1` (L682).
- fps pill (L683–L687): `height: var(--size-appbar-fps-chip)` (30px), `padding: 0 var(--space-4-5)` (0 9px), `gap: var(--space-2)` (5px), sunken background, `border: var(--size-hairline) solid var(--color-border-muted)`, `border-radius: var(--radius-md)`. Blinking `var(--size-rec-dot)` dot, value `700 var(--text-xl)/1 var(--font-mono)` (12px) `color: var(--color-text-primary)`, unit `fps` `400 var(--text-sm)/1 var(--font-mono)` `color: var(--color-text-dim)`. No `RENDER LOOP` label on mobile.
- PAUSE (L688): `.btn--primary`, which resolves to `min-width: var(--size-pause-minw)` (84px) and `height: var(--size-button-primary)` (36px) below 900px. 36px is below the 44px touch minimum — apply primitives' `.tap-pad` helper with `--tap-pad: 4px`; the painted size stays 36px. This ticket writes no pseudo-element of its own.

Action row (L691–L697): `display:flex`, `gap: var(--space-2-5)` (6px), `overflow-x:auto`, `padding-bottom: var(--space-0-5)` (2px), row height `var(--size-actionrow-h)` (40px). Items are `.btn--secondary` (`var(--size-button)` resolves to 40px below 900px, padding `0 var(--space-7)`), `flex: 0 0 auto`. Order: STEP, CAPTURE PNG, SAVE PRESET, LOAD, then COPY CODE as `.btn--code`. Do not hide the scrollbar — the row must read as scrollable.

**Parity addition (new — the mobile branch has no standalone FRAME chip).** Add one as the first item of the action row, `position: sticky; left: 0; z-index: 1` so it stays pinned while the buttons scroll under it. Shell: `height: var(--size-actionrow-h)`, `padding: 0 var(--space-7)`, `gap: var(--space-2)`, `background: var(--color-surface-sunken)`, `border: var(--size-hairline) solid var(--color-border-muted)`, `border-radius: var(--radius-md)`, `cursor: default`, no hover, not a `<button>`. Label `FRAME` at `500 var(--text-base)/1 var(--font-sans)` `letter-spacing: var(--tracking-md)` `color: var(--color-text-tertiary)`; value `700 var(--text-xl)/1 var(--font-mono)` `color: var(--color-text-primary)` (matching the header fps pill's value type); unit `ms` `400 var(--text-sm)/1 var(--font-mono)` `color: var(--color-text-dim)`. Mobile also carries a frame-ms chip inside the viewport HUD (L705) — that one belongs to the HUD ticket and is not a substitute for the toolbar readout. Both read the same `frameMs` field.

RESET SCENE bar (L1112): the mobile mount of RESET, and part of this ticket. It is the last element of the mobile page stack, below the status bar, in the slot the app-shell ticket reserves. `.btn--block` from primitives: full width, `height: var(--size-button-reset)` (48px below 900px), secondary background and border, `border-radius: var(--radius-md)`, `font: 700 var(--text-md)/1 var(--font-sans)`, `letter-spacing: var(--tracking-xl)`, `color: var(--color-text-button)`, label `RESET SCENE`. RESET is deliberately absent from the mobile action row — this bar is its only mobile mount.

Both branch-specific mounts exist in the DOM at once and the inactive one is hidden with `display:none` at the exclusive breakpoint (desktop `min-width: 900px`, mobile `max-width: 899px`). No JS reads the breakpoint.

## Reset

One handler, two mounts. The desktop RESET button (L50) and the mobile RESET SCENE bar (L1112) bind the same function; there is no second code path and no mobile-only subset.

`resetControls` (`src/index.ts` L635–L643) today restores `wireframeEnabled = false`, `backfaceCullingEnabled = true`, then `syncToggleButtons()`, `applyDefaultControlValues()` (zoom 50, pitch 400, yaw 400, roll 200, opacity 100, rotation speed 200 clamped to `ROTATION_SPEED_SLIDER_MAX`), `syncSettingsFromControls()`, `syncOpacitySliderAvailability()` and `renderPausedFrame()`. That covers six sliders and two flags — after this epic there are roughly thirty controls, and a RESET that silently skips two thirds of them is worse than no RESET.

Implementation: `src/ui/UIStateStore.ts` (shell ticket) registers each slice together with its default through `registerSlice(slice)`, called from the owning panel's constructor on the injected store, and exposes `resetAll()`, which writes every registered default and notifies subscribers once. `Main.resetControls` calls `this.store.resetAll()` before `renderPausedFrame()`. A ticket that adds a slice therefore gets RESET coverage by construction rather than by remembering to edit this handler — but the epic rule still stands and belongs in the epic description: **a control added by a later ticket is only Done when RESET restores it.**

RESET does not touch the transport. The design's `reset()` also sets `paused: false` (L1306); the rebuild does not, because the play/pause state is a session control rather than a scene control and RESET must not restart a loop the user deliberately stopped. Record that as a deliberate departure in a code comment.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Wordmark | `1991COMPUTER` | static |
| Build string | `HALCYON  BUILD 0.9.4` desktop, `HALCYON 0.9.4` mobile | new `src/ui/buildInfo.ts` exporting `APP_ID` and `BUILD`; `BUILD` comes from a Vite `define` fed by `package.json` `version`. Note `package.json` currently reads `"name": "parceltest"`, `"version": "1.0.0"` — bump/rename it in this ticket or the string will not say 0.9.4. The literal must not appear twice in markup. |
| Transport label | `PAUSE` / `RESUME` | real — `Main.togglePause` and `Main.isPlaying` (`src/index.ts` L520–L524). Existing labels are lowercase `pause`/`play`; change to `PAUSE`/`RESUME`. |
| REC dot | blinking green, dim and frozen while paused | static, `@keyframes recblink` from `motion.css` |
| fps | integer | real — `Math.round(this.smoothedFps)`, written on the existing `FPS_DISPLAY_UPDATE_INTERVAL_MS` (90ms) throttle in `Main.fpsCounter()`. The `#fpsCounterNb` id is migrated to a `FieldWriter.write`-driven `data-field` by the app-shell ticket, so this ticket only supplies the node, in both branches. |
| FRAME | ms, 2 decimals | real, but **not derived here**. The frame-time ticket owns the single measured value (`performance.now()` around the `Surface3D.render` call in `renderFrame()`, smoothed and gated on the same 90ms throttle) and publishes it with `fields.write('frameMs', …)`. This ticket supplies the desktop readout and the mobile chip as `data-field="frameMs"` nodes, seeded with an em dash, and adds no `smoothedFrameMs` of its own. Because frame-time lands after this ticket, the two nodes read `—` until it does; that is expected, not a defect. |
| STEP | button, inert | placeholder — de-mock E8 "Session actions and keyboard". Cheap to wire later (`renderFrame` currently early-returns while `!isPlaying`), but out of scope here. |
| RESET / RESET SCENE | button | real — `Main.resetControls` (`src/index.ts` L635–L643), extended per the Reset section above |
| CAPTURE PNG | button, inert | placeholder — de-mock E8 |
| SAVE PRESET, LOAD | buttons, inert | placeholder — de-mock E8 |
| COPY CODE | button, inert | placeholder — de-mock E8 |

Every inert button carries `data-placeholder="true"`, stays focusable, and exposes the message `Not wired to the engine yet.` through the placeholder affordance defined in the primitives ticket (`data-placeholder="true"` + `title` + `aria-describedby`). `FollowCursorTooltip` is not reusable here: it is typed `target: HTMLInputElement` (`src/ui/tooltip.ts` L2) and only shows within 14px of a computed range-thumb position (`isPointerNearThumb`, `src/ui/tooltip.ts` L47–L63). Generalising it to non-input targets is its own ticket; it stays on the disabled opacity slider.

## Files

- `src/index.html` — fill the toolbar slot created by the app-shell ticket (`<header id="toolbar">` as the first child of `#app`): brand block, transport cluster, both readouts, action cluster, plus the mobile sticky header, the mobile action scroller and the RESET SCENE bar. Remove `#playPause` and `#resetControls` from the `#controls` aside; the aside itself is removed by the shell ticket.
- `src/styles/components/toolbar.css` — new; row, brand-block, readout and action-scroller geometry only. Imported from `src/styles/main.css` after the token files and after `components/button.css`.
- `src/styles/main.css` — import the new component sheet
- `src/index.ts` — resolve the new node ids, uppercase the transport labels, bind one reset handler to both RESET mounts, call `store.resetAll()` from `resetControls`, toggle the paused class on the REC dot, attach the placeholder affordance
- `src/ui/buildInfo.ts` — new, single source for the product id and build string
- `vite.config.js` — `define` for `__APP_VERSION__` from `package.json`
- `package.json` — version/name correction so the rendered build string is truthful

## Done when

- [ ] Desktop renders one 40px row: 264px brand block plus a `flex:1` strip, 8px gap, all paddings/heights matching L36–L73
- [ ] The build string exists once in source and is rendered into both branches; no literal `0.9.4` in markup or CSS
- [ ] PAUSE starts/stops the render loop and flips its label between `PAUSE` and `RESUME`
- [ ] fps updates live from `smoothedFps` on the existing 90ms cadence, in both branches, through one `FieldWriter.write` write
- [ ] The FRAME readout and the mobile FRAME chip are `data-field="frameMs"` nodes; this ticket introduces no frame-time measurement, and once the frame-time ticket lands both show its value with two decimals
- [ ] The REC dot animates with `recblink` at `var(--duration-blink)`, and freezes dim when the loop is paused
- [ ] STEP, CAPTURE PNG, SAVE PRESET, LOAD and COPY CODE render, are focusable, carry `data-placeholder="true"` with the primitives affordance, and mutate no engine state
- [ ] All five secondary buttons use `.btn--secondary` at `--text-base` (10px); no 9px action-cluster variant exists
- [ ] Below 900px: 52px sticky header at `var(--layer-sticky)` (brand, 30px fps pill, 36px PAUSE with a >= 44px hit area), a 40px horizontally scrolling action row led by the pinned FRAME chip, and the 48px RESET SCENE bar as the last element of the page stack
- [ ] RESET and RESET SCENE call one handler and restore, in one repaint: wireframe off; backface culling on; opacity 100 with the OPACITY slider re-disabled and its tooltip hidden; the four UI-space transform values at their UI defaults — PITCH RATE 0, YAW RATE 0, ROLL RATE 0, SPIN 10 (`1.0/s`, engine `rotationSpeed` 200) — not the engine-space 400 / 400 / 200 / 200 the current `applyDefaultControlValues` writes, since the SHAPE tab re-points that helper at UI space; mesh SCALE 100; shading mode FLAT; texture, base colour and UV SCALE; azimuth, elevation, ambient and specular; the z-buffer, dithering and edge-antialias flags; projection PERSPECTIVE, FOV 94, ZOOM 50; sky on, floor on, grid off, ground shadow off, fog and grid step; the scene-graph selection back to the mesh row with the mesh visible; the dropped-frame counter to 0; then `renderPausedFrame()`
- [ ] `UIStateStore.resetAll()` is driven by the slice registry, so a slice added by a later ticket is restored without editing `resetControls`
- [ ] RESET leaves the play/pause state untouched
- [ ] This ticket declares no button colour, no button height and no `:hover` rule; all four button recipes come from the primitives ticket
- [ ] Removing the old buttons does not leave `Main`'s constructor throwing `"UI controls are missing."`
- [ ] No raw hex or px outside `src/styles/tokens/*.css`
