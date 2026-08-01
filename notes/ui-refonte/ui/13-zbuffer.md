# Z-buffer histogram widget

A 28-bar histogram of depth-buffer occupancy from near to far. This engine has no depth buffer, so the widget is built now as a clearly-marked placeholder and wired up by a separate de-mock ticket. Card shell and header come from the primitives ticket.

**Design source** — `3D Engine UI.dc.html` desktop L367–L386, mobile L1084–L1100.

## Desktop

Card is first in the second telemetry row at `flex:1.15`. The design wraps that row in `sc-if value="{{ statsFull }}"` (L367); the shell ticket drops `statsMode` as a design-tool preview prop, so render the row unconditionally.

- `.panel--fill` + `.panel__header--card` (22px). `--fill` supplies the `flex:1; min-height:0` the bar area needs; this card overrides `flex` to 1.15. `.panel__title` `Z-BUFFER HISTOGRAM`, `.panel__note` `near → far`.
- Body: `.panel__body--pad-4` (8px) plus `flex:1; gap: var(--space-2); min-height:0` from `zBuffer.css`.
- Bar area: `flex:1; display:flex; align-items:flex-end; gap: var(--space-0-5)` (2px), `min-height:0`. `--size-zbuf-h` is `auto` on desktop because the area flexes.
- Bars (28): `flex:1`, `height: <pct>%`, `min-height: 2px` (an untokenised literal by decision), `border-radius: var(--radius-bar-top)` (`1px 1px 0 0`). Colour by index: `i < 10` → `var(--color-zbuf-near)`, `i < 19` → `var(--color-zbuf-mid)`, else `var(--color-zbuf-far)` (L1447).
- Axis row: space-between, three labels `0.1`, `depth`, `1000.0`, each `var(--font-weight-regular) var(--text-xs)/var(--leading-none) var(--font-mono)` (8px), `color: var(--color-text-dim)`.

## Mobile

Last card in the STATS tab (L1084–L1100), below the four `statGroups` cards.

- Header height (26px) and 9px padding arrive from the primitives media block. Title shortens to `Z-BUFFER`; note stays `near → far`.
- Body: `.panel__body--pad-chart` (10px, the primitives variant for exactly this card), column, `gap: var(--space-2-5)` (6px).
- Bar area: `height: var(--size-zbuf-h)` (76px inside `@media (max-width: 899px)`), fixed rather than flex — drop `flex:1` and `min-height:0` at the breakpoint. Same `align-items:flex-end`, same `gap: var(--space-0-5)` (2px), same 28 bars, same 2px minimum height and top radii.
- Axis row: **two** labels only — `0.1` and `1000.0` — at `var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)` (9px, one step larger than desktop), `color: var(--color-text-dim)`. The middle `depth` label is dropped; ship it in the markup and hide it with the media query so there is no JS branch.
- 28 bars at 2px gaps inside a 280px content box (320px viewport − 10px page padding each side − 1px borders − 10px body padding each side) leaves 226px of bar, 8.07px per bar. Bars stay visible at 320px; no minimum bar width is needed.
- Display-only card, no touch targets.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| 28 bar heights | frozen static profile, `h(i) = 18 + Math.exp(-((i - 9) / 7) ** 2) * 74`, clamped to [4, 100] | `placeholder` — de-mock ticket "Depth distribution histogram from triangle depths". This is the design's seed curve from `componentDidMount` L1185–L1189 with the `Math.random() * 8` jitter and the per-tick random walk (L1245) both removed, so nothing animates and nothing looks live. |
| Bar colours | index-banded near/mid/far | Real styling, placeholder data. |
| Axis labels | `0.1` / `depth` / `1000.0` | `placeholder` — the engine has no clip planes; these are the mock's numbers. Keep them for layout, they carry no meaning until de-mock. |

Mark the placeholder with the primitives ticket's one convention: `data-placeholder="true"` on the card, plus `title` and `aria-describedby`, and paint the bars at `opacity: var(--elevation-opacity-pending)` (`.55`, defined in the tokens ticket's `elevation.css`). De-mock removes the attribute and the opacity rule.

Why it is fully mocked: the renderer has no depth buffer at all. `Mesh.renderMesh()` sorts triangles by `depth` descending and paints back-to-front (painter's algorithm, src/primitives/Mesh.ts L19), and `Triangle.depth` is the mean z of the three vertices (src/primitives/Triangle.ts L102–L104). There is no per-pixel depth to bucket, and `Point3D.convert3D2D()` has no near or far plane, so the `0.1 / 1000.0` axis has no engine referent either.

Note for the de-mock ticket: a real *approximation* is cheap. The per-triangle depths already exist and are already sorted every frame, so bucketing `Triangle.depth` across the submitted **registry count** of the active meshes into 28 bins costs one extra pass over an already-hot array. Bucket the submitted set, not the **drawn count** — culled triangles still occupy depth. It is a triangle-depth distribution, not a z-buffer, and the header note and axis labels should change accordingly when it lands.

## Files

- `src/index.html` — desktop card markup and the mobile STATS-tab card
- `src/ui/telemetry/ZBufferWidget.ts` — new; generates the 28 frozen bar heights once and renders them
- `src/styles/components/zBuffer.css` — new; the bar area, the bars and the axis row only. Card shell and header come from the primitives ticket.
- `src/styles/main.css` — import
- Consumes `--elevation-opacity-pending` and the three `--color-zbuf-*` tokens from the tokens ticket. Adds no tokens.

## Done when

- [ ] 28 bars render bottom-aligned with 2px gaps, a 2px minimum height and `1px 1px 0 0` top radii in both branches
- [ ] Colour bands are exactly 10 near / 9 mid / 9 far by index
- [ ] Desktop bar area flexes with the card and never collapses (`min-height:0` on ancestors); mobile bar area is a fixed 76px from `--size-zbuf-h`
- [ ] Desktop shows three axis labels at 8px, mobile shows two at 9px, with no JS branch between them
- [ ] Bars are static across frames — no timer, no animation, no random walk
- [ ] Card carries `data-placeholder="true"` with the primitives affordance and renders at `--elevation-opacity-pending`
- [ ] `zBuffer.css` declares no card or header recipe
- [ ] No raw hex/px outside the token files, except the documented 2px bar minimum
