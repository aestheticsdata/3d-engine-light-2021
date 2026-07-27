# Geometry widget

The geometry card reports scene complexity: vertex, edge, triangle, culled and draw-call counts, with a POLY BUDGET progress bar in the footer. Five of the six readings are real or cheaply derivable from the engine today — this is the highest real-data-yield card in the telemetry column. Card shell, header and stat rows come from the primitives ticket.

**Design source** — `3D Engine UI.dc.html` desktop L328–L364, mobile L1054–L1063 (POLY BUDGET block inside BUDGETS) plus L1462–L1468 (`statGroups` GEOMETRY rows).

## Desktop

Card sits third in the top telemetry row at `flex:1`.

- `.panel--fill` + `.panel__header--card` (22px). `.panel__title` `GEOMETRY`, `.panel__note` `scene total`.
- Body: `.panel__body--pad-4` (8px) plus `flex:1` from `geometry.css`.
- Rows (5): `.stat-list` + `.stat-row`, which already give the 4px gap, the label type and the value type. Labels in order: `VERTICES`, `EDGES`, `TRIANGLES`, `CULLED`, `DRAW CALLS`. CULLED takes `.stat-row__value--warn`; DRAW CALLS takes `.stat-row__value--dim` while it is a placeholder.
- Footer (this ticket's own CSS): `margin-top:auto`, column, `gap: var(--space-1-5)`, `padding-top: var(--space-2-5)` (6px), `border-top: var(--size-hairline) solid var(--color-border-subtle)`.
  - Label row: `POLY BUDGET` — `var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-sans)`, `--tracking-sm`, `color: var(--color-text-muted)`; value — `var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-mono)` (9px, not 10px), `color: var(--color-text-tertiary)`, format `<n> / <budget>`.
  - Bar: `height: var(--size-budget-bar)` (6px), `background: var(--color-surface-sunken)`, `border-radius: var(--radius-md)` (3px), `overflow:hidden`; fill `height:100%`, percentage width, `background: var(--color-state-ok)`.

## Mobile

Split in two inside the STATS tab.

**1. POLY BUDGET block, appended to the BUDGETS card (L1054–L1063).** The BUDGETS card shell — header, note, `10px 11px 12px` body, 11px block gap — is built by the frame-time ticket. This ticket appends a second block to it and adds no card shell of its own.
- Block: column, `gap: var(--space-2-5)` (6px).
- Label row: `POLY BUDGET` — `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-sans)`, `--tracking-md`, `color: var(--color-text-muted)`; value — `var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-mono)` (10px), `color: var(--color-text-tertiary)`.
- Bar: same markup as desktop. `--size-budget-bar` resolves to 8px inside `@media (max-width: 899px)`; the only per-branch rule needed is the radius, which goes from `var(--radius-md)` to `var(--radius-lg)` (4px).

**2. `statGroups` GEOMETRY card (L1462–L1468).** Entirely the primitives' mobile stat-card recipe: `.panel__header--card` (26px), `.panel__body--pad-stats` (8px 11px 10px), five `.stat-row` at `--size-row-stat` (28px) with the mobile label/value type. Title `GEOMETRY`, note `<n> / <budget>`; CULLED keeps `.stat-row__value--warn`, DRAW CALLS keeps `.stat-row__value--dim`. Do not re-derive the padding or the row height here.

Display-only card, no touch targets.

## Data

Triangle vocabulary, per the epic's reconciliation: the **registry count** is `objects3D[key].triangles.length`, static per shape; the **drawn count** is the number `Surface3D.render` returns; **culled** is registry − drawn while culling is on, else 0. This card shows the registry count (submitted) in TRIANGLES and derives CULLED from the pair.

| Field | Value shown | Source today |
| --- | --- | --- |
| VERTICES | integer | Real — `data[currentPrimitive].points.length` (already read at src/index.ts L295 for the shape info panel). Do **not** add the design's `+4` for the floor: this repo's checker floor is drawn as 2D canvas paths by `BackgroundRenderer`, not as geometry. |
| EDGES | `Math.round(triangles * 1.5)` | Derived, not placeholder. Exact for a closed manifold triangle mesh (E = 3F/2 — true for sphere, cube, pyramid, cuboctahedron, donut, torus knot), approximate for the open/duplicated-face shapes. Label it as derived in the code comment, not in the UI. |
| TRIANGLES | integer | Real — the registry count submitted this frame, i.e. the sum of `triangleCount` over `transitionMachine.getActiveMeshes()`. Note this is not simply the current shape: during a shape transition two meshes are active, so submitted temporarily exceeds the current shape's registry count. |
| CULLED | integer, orange | Real, with a caveat. `submitted − renderedTriangles` when `backfaceCullingEnabled` is on, else 0. `Triangle.render()` returns `false` at the backface test (src/primitives/Triangle.ts L125–L127) **and** at the degenerate-UV guard for textured triangles (L186–L189), and `Mesh.renderMesh()` (src/primitives/Mesh.ts L22–L26) only increments its counter on a truthy return, so the subtraction is culled + degenerate-UV skips. Degenerate UVs are not expected in the current registry, but the cube is textured, so the path is reachable — note the approximation in a code comment rather than claiming exactness. Requires exposing the count: `Mesh.triangles` is `private readonly`, so add `public get triangleCount(): number { return this.triangles.length; }` to `src/primitives/Mesh.ts`. |
| DRAW CALLS | em dash `—` in `var(--color-text-dim)` | `placeholder` — de-mock ticket "Real draw-call accounting". A defensible real value exists (`renderables.length + 1` for the background pass), but this is a software rasteriser with no batching, so the number would be a constant 1 or 2 and means nothing; leave the semantics to de-mock. Use the primitives ticket's placeholder convention: `data-placeholder="true"` + `title` + `aria-describedby`. |
| POLY BUDGET label + bar | `<triangles> / <budget>`, `Math.min(100, tris / budget * 100).toFixed(1)` % | Real, with a computed denominator — see below. |

The mock's 4096 budget is wrong for this repo and must not be copied. The torus knot builds `PATH_SEGMENTS 220 × TUBE_SEGMENTS 18 × 2 = 7920` triangles (src/data/shapes/torusKnot.ts L11–L12, L189–L210), so the bar would pin at 100% on that shape. Compute the budget once at boot as the maximum `triangles.length` across the `data` registry rounded up to the next power of two (8192 today), export it as a constant, and render it in the label so the number is self-documenting.

## Files

- `src/index.html` — desktop card markup; the mobile POLY BUDGET block inside the frame-time ticket's BUDGETS card; the mobile `statGroups` GEOMETRY card
- `src/ui/telemetry/GeometryWidget.ts` — new; owns the row values, the derived edge count and the budget percentage
- `src/primitives/Mesh.ts` — add the `triangleCount` getter
- `src/index.ts` — track submitted-vs-drawn triangles alongside the existing `renderedTriangles`, compute the poly budget constant at boot, feed the widget from the 90ms display gate
- `src/styles/components/geometry.css` — new; the POLY BUDGET footer and bar only. Card shell, header and stat rows come from the primitives ticket.
- `src/styles/main.css` — import

## Done when

- [ ] Desktop card renders 5 `.stat-row` plus a footer pinned by `margin-top:auto` with a 6px / 3px-radius bar
- [ ] Mobile renders both halves: the 8px / 4px-radius bar appended to the frame-time ticket's BUDGETS card, and the 5-row GEOMETRY stat card at 28px rows using `.panel__body--pad-stats`
- [ ] VERTICES and TRIANGLES track the active shape and stay correct across a shape transition (two meshes active, submitted > current shape's registry count)
- [ ] CULLED reads 0 when backface culling is off and equals submitted − drawn when it is on, verified against a shape with a known registry count, with the degenerate-UV caveat recorded in a code comment
- [ ] Poly budget denominator is derived from the registry maximum, not hardcoded to 4096, and the bar never exceeds 100% on the torus knot (7920 triangles)
- [ ] DRAW CALLS shows an em dash in `--color-text-dim` and carries the primitives placeholder affordance
- [ ] `geometry.css` declares no card, header or stat-row recipe
- [ ] No raw hex/px outside the token files
