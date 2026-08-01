# Framerate widget

The framerate card is the primary telemetry readout: a 90-sample sparkline of live FPS plus MIN / AVG / MAX / DROPPED tiles. Every value in this widget is real today — no placeholders. The card shell, header, stat tiles and tile row all come from the primitives ticket; this ticket ships the canvas, the ring buffer and the draw routine only. It creates no shared CSS and therefore does not block the other five telemetry cards.

**Design source** — `3D Engine UI.dc.html` desktop L259–L285, mobile L746–L772.

## Desktop

Card sits first in the top telemetry row at `flex:1.15`. The enclosing two-row grid belongs to the shell's telemetry column layout; this ticket owns the card contents.

- Shell: `.panel--fill` with `.panel__header--card` (`--size-panel-header-card`, 22px), `.panel__title` `FRAMERATE`, `.panel__note` `90 frames`. `--fill` supplies the `flex:1; min-height:0` the canvas needs; this card overrides `flex` to 1.15. Do not restate the card recipe — it lives in `components/panel.css`.
- Body: `.panel__body` (its default `var(--space-3) var(--space-4)`, 7px 8px, is exactly the design's L264). `framerate.css` adds only `flex:1; gap: var(--space-2-5)` (6px) and `min-height:0`.
- Canvas: `width:100%; flex:1; display:block; min-height:0`. `--size-fps-canvas` is `auto` on desktop precisely because the canvas flexes; every flex ancestor needs `min-height:0` or it will not shrink.
- Tile row: `.stat-tile-row` with four `.stat-tile`; DROPPED carries `.stat-tile--wide` (`flex:1.1`).
- Tile captions `MIN` / `AVG` / `MAX` / `DROPPED`. Tile values: MIN `.stat-tile__value--warn`, MAX `.stat-tile__value--ok`, AVG and DROPPED default.

## Mobile

Full-bleed card in the 10px stack, no flex ratio. It sits **below** the 5-column quick-toggle grid (L740–L744, 46px cells) and above the mobile tab bar (L774) — not directly under the viewport.

- Header height (26px) and 9px padding, and the `.stat-tile` / `.stat-tile-row` mobile geometry (5px 7px tiles, `repeat(4,1fr)` grid at `var(--space-2-5)`, 14px mono value, no `--wide` tile) all arrive from the primitives media block. Nothing to re-declare here.
- Body: `padding: var(--space-4-5)` (9px), `gap: var(--space-3)` (7px).
- Canvas: `width:100%; height: var(--size-fps-canvas)` (64px inside `@media (max-width: 899px)`), fixed, not flex. Drop `flex:1` and `min-height:0` at the breakpoint.
- The fourth caption reads `DROP`, not `DROPPED`. Ship both strings in the markup and swap them with the media query, so no resize listener or JS branch is needed.
- Fits at 320px: 10px page padding each side leaves 300px; the 1px card border and 9px body padding leave 280px; three 6px gaps leave 262px, so each tile is 65.5px wide with roughly 49px of content box. A three-digit 14px mono value is about 25px and `DROP` at 8px with `.1em` tracking about 22px — no wrap, no truncation. Verify at 320px.
- Display-only card: no interactive elements, so no 44px touch-target requirement applies.

## Canvas drawing

Exact port of `drawFps()` L1258–L1301. Steps, in order:

1. `w = canvas.clientWidth`, `h = canvas.clientHeight`; return early if either is 0.
2. `dpr = 2`, hardcoded. Do not use `window.devicePixelRatio` here — the design pins 2, and the SYSTEM widget reports the real DPR separately. Resize the backing store only when `canvas.width !== w * dpr || canvas.height !== h * dpr`, setting both (design L1264). Width-only misses the desktop case where the canvas is `flex:1` and only its height changes on a vertical window resize.
3. `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, `clearRect(0,0,w,h)`, then fill the whole rect with `#0A1330` (`--color-surface-sunken`).
4. Y mapping: `max = 68`, `y = v => h - (v / max) * h`.
5. Gridlines at 30 and 60: `strokeStyle = '#1B2E5C'` (`--color-border-subtle`), `lineWidth = 1`, drawn at `y(v) + 0.5` so they land on a device pixel.
6. Labels `60` and `30`: `fillStyle = '#3A4E7E'` (`--color-slate-500`), `font = "500 8px 'JetBrains Mono', monospace"`, at `x = 3`, `y = y(v) - 3`.
7. Return if `hist.length < 2`. `step = w / (hist.length - 1)`.
8. Area fill: path `moveTo(0, h)`, then `lineTo(i * step, y(v))` for every sample, then `lineTo(w, h)`, `closePath()`. Fill with `createLinearGradient(0, 0, 0, h)` from `rgba(255,200,30,.30)` at stop 0 to `rgba(255,200,30,0)` at stop 1.
9. Line: same points without the base, `strokeStyle = '#FFC81E'`, `lineWidth = 1.4`.
10. Last-sample marker: `fillRect(w - 3, y(last) - 1.5, 3, 3)` in `#FFC81E`.

A 2D canvas cannot read CSS custom properties, so the five colours and the font string live in `src/ui/chartTokens.ts` — **created by the tokens ticket**, imported here. Do not fork a second copy under `src/ui/telemetry/`, and do not call `getComputedStyle` per draw.

Redraw cadence: reuse the existing `FPS_DISPLAY_UPDATE_INTERVAL_MS` (90ms) gate already in `fpsCounter()` (src/index.ts L374). `fpsCounter()` is itself called from `step()`, the rAF callback (L566–L570), so the draw happens inside rAF but at most once per 90ms — never once per frame.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Sparkline history | 90 most recent per-frame FPS samples | Real. New ring buffer in `Main`; push `this.fps` (the exact rolling-1s frame count set at src/index.ts L367) once per rendered frame, then `slice(-90)`. One sample per frame keeps the header's "90 frames" literal. |
| Header note | `90 frames` | Real — the buffer length constant. |
| MIN | `Math.round(Math.min(...hist))` | Real |
| AVG | `Math.round(hist.reduce((a,b)=>a+b,0) / hist.length)` | Real |
| MAX | `Math.round(Math.max(...hist))` | Real |
| DROPPED | count of samples below 40 since last reset | Real — compute it. One comparison per frame; there is no reason to placeholder this. Zero it in `resetControls()` (src/index.ts L635), matching the design's `reset()` which sets `dropped: 0` (L1306). |

Feed the chart the raw `this.fps`, not `this.smoothedFps`: the EMA (`FPS_SMOOTHING_FACTOR = 0.2`) already flattens exactly the spikes the sparkline exists to show. `smoothedFps` stays the source for the toolbar's single FPS number.

This card carries no triangle number. The **drawn count** (what `Surface3D.render` returns) belongs to the GEOMETRY card and the toolbar, and the single fps number belongs to the toolbar. The shell ticket has already retired both legacy ids: `#fpsCounterNb` and `#trianglesRenderedNb` no longer exist, their `getElementById` lookups and guard clauses are gone from `Main`'s constructor, and both values reach the DOM through `setField('fps', …)` / `setField('trisDrawn', …)` into `[data-field]` nodes (D2). This ticket adds no `data-field` node of its own.

RESET, owned by the toolbar ticket, must restore DROPPED to 0 along with every other new state slice. This ticket is not Done until DROPPED is in that enumerated set.

## Files

- `src/index.html` — fill the shell skeleton's FRAMERATE slot with the card markup, `<canvas id="fpsChart">` and the four tiles. The shell ticket has already deleted the legacy `.fpsRow` block and migrated `#fpsCounterNb` / `#trianglesRenderedNb` to `setField`-driven `[data-field]` nodes (D2), so there is no id here for this card to preserve or break.
- `src/ui/telemetry/FramerateWidget.ts` — new; owns the ring buffer, min/avg/max/dropped and the canvas draw
- `src/index.ts` — push samples from `fpsCounter()`, drive the widget from the existing 90ms gate, reset DROPPED in `resetControls()` (L635)
- `src/styles/components/framerate.css` — new; the canvas box, the body gap and the `DROP` caption swap only. No card shell, no header, no tile rules.
- `src/styles/main.css` — import after the primitives imports
- Consumes `src/ui/chartTokens.ts` (tokens ticket) and `components/panel.css` + `components/tile.css` (primitives ticket). Creates no `telemetryCard.css`.

## Done when

- [ ] Desktop card renders as a 22px `.panel__header--card` + flexible canvas + `.stat-tile-row`, and the canvas actually fills the remaining height (`min-height:0` on every flex ancestor)
- [ ] Mobile card sits below the quick-toggle grid, renders a fixed 64px canvas and the primitives' 4-column tile grid, with `DROP` as the fourth caption and no wrap at 320px
- [ ] Sparkline matches `drawFps()`: 68 Y max, gridlines at 30/60 with the +0.5 offset, 8px mono axis labels, gradient area, 1.4px line, 3×3 end marker, DPR 2 backing store resized on either dimension changing
- [ ] Chart redraws at most once every 90ms, gated by `FPS_DISPLAY_UPDATE_INTERVAL_MS` inside `fpsCounter()`, never once per rAF frame
- [ ] MIN / AVG / MAX track the live 90-sample buffer; DROPPED increments on sub-40 frames and returns to 0 on Reset
- [ ] Canvas colours and font come only from the tokens ticket's `src/ui/chartTokens.ts`
- [ ] `framerate.css` contains no card, header, tile or tile-row declarations — the branch still renders correctly with those rules coming only from the primitives ticket
- [ ] The app boots with no reference to `#fpsCounterNb` or `#trianglesRenderedNb`; `grep -rn 'fpsCounterNb\|trianglesRenderedNb' src/` returns nothing
- [ ] No raw hex/px outside the token files
