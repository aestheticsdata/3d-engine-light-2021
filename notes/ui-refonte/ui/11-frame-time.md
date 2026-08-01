# Frame time widget

The frame-time card breaks one frame into TRANSFORM / CLIP-CULL / RASTERIZE / PRESENT as a stacked bar plus a legend, with a FILL RATE footer. The engine is not instrumented per phase today, so this ticket builds the full widget with a real measured total and explicitly unattributed segments. It also owns two things the other telemetry tickets depend on: the measured `frameMs` value, and the mobile BUDGETS card shell.

**Design source** — `3D Engine UI.dc.html` desktop L287–L326, mobile L1037–L1053 (BUDGETS card, frame-time block) plus L1455–L1461 (`statGroups` FRAME TIME rows).

## Desktop

Card sits second in the top telemetry row at `flex:1`. Shell, header, title, note and stat rows come from the primitives ticket; this ticket ships the bar, the legend and the footer.

- `.panel--fill` + `.panel__header--card` (22px). `.panel__title` `FRAME TIME`, `.panel__note` `<total> ms`.
- Body: `.panel__body--pad-4` (`var(--space-4)`, 8px) plus `flex:1; gap: var(--space-3)` (7px) from `frameTime.css`.
- Bar: `display:flex; height: var(--size-ft-bar)` (12px), `border-radius: var(--radius-sm)`, `overflow:hidden`, `background: var(--color-surface-sunken)`. Four children with percentage widths: `var(--color-ft-transform)`, `var(--color-ft-clip)`, `var(--color-ft-raster)`, `var(--color-ft-present)`.
- Legend: column, `gap: var(--space-1-5)` (4px). Each row: `display:flex; align-items:center; gap: var(--space-3)` (7px).
  - Swatch: `var(--size-legend-swatch)` square (7px), `border-radius: var(--radius-xs)` (1px), segment colour.
  - Label: `flex:1`, `var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-sans)`, `letter-spacing: var(--tracking-sm)`, `color: var(--color-text-tertiary)`. Labels: `TRANSFORM`, `CLIP / CULL`, `RASTERIZE`, `PRESENT`.
  - Value: `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-mono)`, `color: var(--color-text-primary)` for all four rows (only the swatch is coloured on desktop).
- Footer: `margin-top:auto`, `padding-top: var(--space-2-5)` (6px), `border-top: var(--size-hairline) solid var(--color-border-subtle)`, space-between. Label `FILL RATE` — `var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-sans)`, `--tracking-sm`, `color: var(--color-text-muted)`. Value — `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-mono)`, `color: var(--color-text-primary)`, suffix ` px/f`.

## Mobile

The mobile branch splits this widget in two, both inside the STATS tab.

**1. BUDGETS card, first block (L1037–L1053).** This ticket builds the card itself — the geometry ticket appends a POLY BUDGET block to it, so the shell must land here.
- Card: `.panel` with `--fill` off (the mobile stack is a column of natural-height cards) and `.panel__header--card` at 26px; `.panel__title` `BUDGETS`, `.panel__note` `<total> ms`.
- Body: `padding: var(--space-5) var(--space-5-5) var(--space-6)` (10px 11px 12px), column, `gap: var(--space-5-5)` (11px). This padding is specific to BUDGETS — it is not the `.panel__body--pad-stats` recipe used by the `statGroups` cards.
- Frame-time block: column, `gap: var(--space-2-5)` (6px).
- Label row: `FRAME TIME` — `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-sans)`, `letter-spacing: var(--tracking-md)`, `color: var(--color-text-muted)`; right side `transform · clip · raster · present` — `var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)`, `color: var(--color-text-tertiary)`.
- Bar: identical markup to desktop; `--size-ft-bar` resolves to 14px inside `@media (max-width: 899px)`, so no per-branch height rule is needed.

**2. `statGroups` FRAME TIME card (L1455–L1461).** Standard mobile stat card, entirely from primitives: `.panel__header--card` (26px), `.panel__body--pad-stats` (8px 11px 10px), five `.stat-row` at `--size-row-stat` (28px) with the mobile label/value type. Title `FRAME TIME`, note `<total> ms`. Rows: TRANSFORM, CLIP / CULL, RASTERIZE, PRESENT, FILL RATE (` px` suffix, not `px/f`).

**Mobile data treatment is identical to desktop, and that is the point.** The 14px bar renders the same single unattributed segment, not four percentage-width children. The five `statGroups` rows render the same em dashes in `var(--color-text-dim)`, and the whole card carries `data-placeholder="true"`. The per-row colours below are therefore dormant until the de-mock ticket lands: ship them as `.stat-row__value--*` modifiers on the markup so the de-mock is a data change only, but expect to see dashes.

Row colour map, for when the values become real: TRANSFORM `var(--color-ft-transform)`, CLIP / CULL `var(--color-ft-clip)`, RASTERIZE `var(--color-ft-raster)`, PRESENT `var(--color-ft-present-text)`, FILL RATE `var(--color-text-primary)`. PRESENT is deliberately two tokens: `--color-ft-present` (`#3A4E7E`) for the bar segment and the desktop 7px legend swatch, `--color-ft-present-text` (`#8FA3CE`) for the mobile value text, because `#3A4E7E` is illegible as 11px text on `--color-panel-bg`. Do not unify them.

Both cards are display-only — no touch targets.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Header note / BUDGETS note | `<ms>.toFixed(2) + ' ms'` | Real, and **owned here**. Wrap the `this.surface3D.render(...)` call in `renderFrame()` (src/index.ts L500) in `performance.now()` and report the delta, smoothed with the same EMA style as `smoothedFps` and refreshed on the existing 90ms display gate. Export it as the single `frameMs`; the toolbar and the viewport HUD import it rather than deriving `1000 / smoothedFps`. |
| Bar segments | one full-width segment in `var(--color-ft-present)`, `data-state="unattributed"` | `placeholder` — de-mock ticket "Instrument frame-time phases". |
| TRANSFORM / CLIP / CULL / RASTERIZE / PRESENT values | em dash `—` in `var(--color-text-dim)` | `placeholder` — same de-mock ticket. |
| FILL RATE | em dash `—` (keep the ` px/f` / ` px` suffix) | `placeholder` — same de-mock ticket. |

Mark every placeholder with the primitives ticket's one convention: `data-placeholder="true"` + `title` + `aria-describedby`. Do not reach for `FollowCursorTooltip`.

Decision, and why: do **not** derive the four segments from the real total by fixed ratios. Ratio-split values move smoothly and convincingly with the real frame time, which makes them indistinguishable from measurements — the worst possible mock in a panel whose only job is to guide optimisation. Em dashes plus a single unattributed bar segment read instantly as "not instrumented", while the header note stays genuinely useful because the total is real.

Engine constraint to record: the four phases are not separable without restructuring the renderer. `Triangle.render()` (src/primitives/Triangle.ts L106) performs projection, the backface test and rasterisation inline per triangle inside one call, and there is no present phase at all — Canvas 2D composites outside the engine's control. Any real instrumentation means splitting `Mesh.renderMesh()` into passes, which is a renderer change, not a UI change.

This card carries no triangle number, and FILL RATE must not be faked from one. The **drawn count** (what `Surface3D.render` returns) belongs to the viewport and the toolbar; the **registry count** belongs to SHAPE INFO and GEOMETRY. A real fill rate needs rasterised pixel accounting, which is the same de-mock ticket.

## Files

- `src/index.html` — desktop card markup; the mobile BUDGETS card shell with its frame-time block; the mobile `statGroups` FRAME TIME card
- `src/ui/telemetry/FrameTimeWidget.ts` — new; owns the measured total, the smoothing, the exported `frameMs` and the placeholder rendering
- `src/index.ts` — time the `surface3D.render()` call in `renderFrame()` (L500) and `renderPausedFrame()` (L507), feed the widget from the 90ms gate
- `src/styles/components/frameTime.css` — new; bar, legend, footer and the BUDGETS body padding only. Card shell, header and stat rows come from the primitives ticket.
- `src/styles/main.css` — import

## Done when

- [ ] Desktop card renders a 12px stacked bar, a 4-row legend with 7px swatches, and a FILL RATE footer pinned by `margin-top:auto` above a 1px `--color-border-subtle` rule
- [ ] Mobile renders both halves: the BUDGETS card (whose shell the geometry ticket can append to) with its 14px bar and label row, and the 5-row FRAME TIME stat card at 28px rows
- [ ] Header note shows a real measured render time to 2 decimals and updates on the existing 90ms gate, not per frame; it is exported once and consumed by the toolbar and the viewport HUD
- [ ] All four segment values and FILL RATE show an em dash in **both** branches; the bar shows a single unattributed segment carrying `data-state="unattributed"` in both branches; the card carries `data-placeholder="true"`
- [ ] PRESENT is `--color-ft-present` as a swatch/segment and `--color-ft-present-text` as mobile value text
- [ ] `frameTime.css` declares no card, header or stat-row recipe
- [ ] No raw hex/px outside the token files
