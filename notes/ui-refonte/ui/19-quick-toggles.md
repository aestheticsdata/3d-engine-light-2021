# Quick toggles: SKY / FLOOR / GRID / WIRE / CULL

Five one-tap toggles for the most-used scene switches. One component, two mounts: on desktop they float over the viewport as translucent blurred pills, on mobile they drop out of the viewport into a five-column grid of large buttons underneath it. Four of the five drive the renderer — WIRE and CULL through the RENDER tab's booleans, SKY and FLOOR through the `BackgroundRenderer.setLayers` call the WORLD tab ships. Only GRID is a placeholder. This ticket owns no state, no colour table and no engine call: it is a second surface on `src/ui/UIStateStore.ts`, and it lands after the SHAPE, RENDER and WORLD tab tickets that create the slices it reads.

**Design source** — `3D Engine UI.dc.html` desktop L186–L190, mobile L740–L744. Shared state factory `quick(label, key)` at L1333–L1341, list order at L1409.

## Desktop

Mount into the band the viewport ticket reserves. That ticket anchors `.viewportHud` to `.viewportStage` — a `16/10` box the fixed 1024x640 canvas fills exactly — and states that nothing else may be placed at `top: 40px; left: 10px` (L186). Because the HUD is anchored to the stage and not to the viewport card, the 10px inset does not drift when the card letterboxes the canvas. Do not re-anchor to the card or to `canvas#canvasID`.

Container (L186): `position:absolute`, `top: 40px`, `left: var(--space-5)` (10px), `display:flex`, `gap: var(--space-2)` (5px). The 40px offset is deliberate: the top-left HUD chip row sits at `top:10px` and is 22px tall, so the pills clear it by 8px. `top: 40px` stays a literal — one-off inline geometry, which the tokens ticket allows.

Pill: the `.quick-toggle` recipe from the primitives ticket, unmodified — `var(--size-chip-quick)` (24px), `padding: 0 var(--space-5)`, `var(--radius-sm)`, `backdrop-filter: var(--blur-hud)`, `700 var(--text-sm)/1` mono with `var(--tracking-chip)`. The off state, the `.is-on` state and the yellow hover border (already wrapped in `@media (hover: hover)`) all live there. This ticket declares none of them and must not add a local override.

Order is fixed: SKY, FLOOR, GRID, WIRE, CULL (L1409).

## Mobile

The pills leave the viewport entirely. The mobile HUD (L701–L737) has no quick-toggle band at all; instead the five buttons sit in the page stack as their own row (L740–L744), directly below the viewport card and directly above the FRAMERATE card (L746), inside the 10px page padding and 10px stack gap.

Grid: `display:grid`, `grid-template-columns: repeat(5, 1fr)`, `gap: var(--space-2-5)` (6px). The buttons come from the primitives mobile block — `var(--size-chip-quick)` resolves to 46px, `border-radius: var(--radius-md)` (3px, not the desktop 2px), `700 var(--text-base)/1` mono, and **no `backdrop-filter`**. The off background stays `var(--color-hud-bg)` (.82) rather than the mobile HUD's denser `.85`, matching the design; since these buttons now sit on `var(--color-bg-app)` rather than over the render, that translucent fill composites to a near-solid dark. Keep the token, do not swap it for an opaque colour.

At a 320px viewport this is 300px of content: `5 x 55.2px + 4 x 6px`, which fits the longest label (`FLOOR`, five glyphs of 10px mono). 46px clears the 44px touch minimum with no extra hit-area padding.

On mobile the same five booleans also appear as full ON/OFF rows inside the RENDER and WORLD tab cards, which are on screen at a different tab rather than at a different breakpoint. A flip from a pill has to repaint those rows and vice versa, in the same frame, from the one store.

Both branch mounts exist in the DOM simultaneously and the inactive one is hidden with `display:none` at the exclusive breakpoint — desktop `min-width: 900px`, mobile `max-width: 899px`. No JS reads the breakpoint.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| SKY | pill active / inactive | real — `store.sky`, applied through `BackgroundRenderer.setLayers({ sky, floor })`, which the WORLD tab ticket adds. Defaults **ON**: `renderSky` and `renderAtmosphere` run unconditionally today (`src/rendering/BackgroundRenderer.ts` L16–L26). |
| FLOOR | pill active / inactive | real — `store.floor`, same `setLayers` call; skipping it skips `renderFloor`. Defaults **ON** for the same reason. |
| GRID | pill active / inactive | `placeholder` — `store.grid`, defaults **OFF**. Nothing in the renderer draws a grid at all; owned by de-mock E5 "World layers". Default OFF so the pill never claims something the canvas is not showing, and the WORLD tab's GRID OVERLAY row defaults OFF with it — one boolean, one default. |
| WIRE | pill active while wireframe on | real — `store.wireframe`, backing `Main.wireframeEnabled`, passed as `wireframe` in `TriangleRenderOptions` to `Surface3D.render`. Engine default is `false` (`src/index.ts` L197); keep the engine default, not the design's `wire: true`. |
| CULL | pill active while culling on | real — `store.cull`, backing `Main.backfaceCullingEnabled`, passed as `cullBackfaces`. Engine default is `true` (`src/index.ts` L198); keep it, not the design's `cull: false`. |
| Pill order | SKY, FLOOR, GRID, WIRE, CULL | static, L1409 |

The design's own defaults (`sky/floor/grid: true`, `wire: true`, `cull: false`, L1179–L1180) contradict the engine's on three of the five. State the rule in a code comment: defaults mirror what the renderer actually draws today.

Wiring rules:

- **No store here.** All five booleans live in `src/ui/UIStateStore.ts`, shipped by the shell ticket and sliced by shape-tab, render-tab and world-tab. This component subscribes, writes, and repaints; it must not open a private store and must not call the renderer directly.
- WIRE and CULL go through the shared path the RENDER tab ticket owns. CULL's coupled behaviour is owned there and on the SHAPE tab and must not regress when the flip comes from a pill: turning culling on sets `#opacitySlider` to 100, calls `changeOpacity(100)`, then `syncOpacitySliderAvailability()`, which disables the slider and hides its follow-cursor tooltip. Flipping CULL from a pill has to reproduce that exactly.
- SKY and FLOOR go through the WORLD tab ticket's `BackgroundRenderer.setLayers`.
- Every flip ends in `renderPausedFrame()` so the pills stay honest while the loop is stopped.
- GRID carries the placeholder affordance defined in the primitives ticket: `data-placeholder="true"` + a `title` reading `Not wired to the renderer yet.` + `aria-describedby`. Do not reuse `FollowCursorTooltip` — it is typed `target: HTMLInputElement` (`src/ui/tooltip.ts` L2) and only shows within 14px of a computed range-thumb position (`isPointerNearThumb`, `src/ui/tooltip.ts` L47–L63), so on a `<button>` it is both a type error and invisible. It stays on the disabled opacity slider.
- Markup is `<button type="button" aria-pressed="true|false">`, not the design's divs.
- RESET restores all five (sky on, floor on, grid off, wireframe off, culling on) through the toolbar ticket's single reset path. The pills repaint from the store; they are not reset individually.

Out of scope: the design's keyboard handler binds `s` `f` `g` `w` `c` to these five (L1197–L1201). Keyboard shortcuts are mocked across the whole design and belong to the shortcuts ticket; do not add them here.

## Files

- `src/ui/quickToggles.ts` — new; builds the five buttons, exposes `mount(container)`, subscribes to `src/ui/UIStateStore.ts` and repaints on change. No local state.
- `src/styles/components/quick-toggles.css` — new; the two container placements only (the absolute HUD row and the mobile grid), not the pill recipe
- `src/index.html` — the desktop mount point inside the reserved `.viewportHud` band, and the mobile grid container between the viewport card and the FRAMERATE card
- `src/index.ts` — mount both containers at boot
- `src/styles/main.css` — import the new component sheet

## Done when

- [ ] One module renders the five buttons in SKY, FLOOR, GRID, WIRE, CULL order and is mounted twice; a flip from either mount, or from the RENDER/WORLD tab rows, leaves every surface showing identical state in the same frame
- [ ] SKY and FLOOR toggle real layers through the WORLD tab's `BackgroundRenderer.setLayers`, and both default ON
- [ ] GRID defaults OFF, carries the primitives placeholder affordance, and changes nothing on the canvas
- [ ] WIRE mirrors `wireframeEnabled` (default off) and CULL mirrors `backfaceCullingEnabled` (default on), with the same result as the RENDER tab rows including a repaint while paused
- [ ] Turning CULL on from a pill still resets the opacity slider to 100, disables it, and leaves the follow-cursor tooltip explaining why
- [ ] Desktop: pills sit at `top:40px; left:10px` inside `.viewportHud`, use `.quick-toggle` unmodified, and stay correctly inset when the viewport card letterboxes the fixed 1024x640 canvas
- [ ] Mobile: a 5-column, 6px-gap grid of 46px buttons between the viewport card and the FRAMERATE card, with no `backdrop-filter`, and no overflow at a 320px viewport
- [ ] The ticket adds no store, no colour or geometry declaration for the pill itself, and no direct renderer call
- [ ] `aria-pressed` reflects each toggle's state
- [ ] RESET returns all five to sky on, floor on, grid off, wire off, cull on
- [ ] No raw hex or px outside `src/styles/tokens/*.css`
