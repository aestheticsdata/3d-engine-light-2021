# Status bar

The persistent one-line readout at the bottom of the app: run state, selected object, the shading/texture/projection triple, world units, the project URL and uptime. Every value is derived somewhere else — this widget owns no state of its own, it renders six fields and their layout, so it doubles as the sanity check that the shared state layer is wired to real engine state.

**Design source** — `3D Engine UI.dc.html` desktop L657–L669, mobile L1104–L1110.

## Desktop

The bar is a `.panel` from the primitives ticket with a `.statusBar` layout class that overrides the panel's column direction; this ticket declares no surface, border or radius of its own. Layout (L657): `flex:0 0 var(--size-statusbar-h)` (24px), `display:flex; flex-direction:row; align-items:center`, `gap:var(--space-5)` (10px), `padding:0 var(--space-5)`.

Segments, left to right:

| # | Content | Type |
|---|---|---|
| 1 | run state, `RUNNING` / `PAUSED` | `font:var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-mono)`, `color:var(--color-state-ok)` |
| 2 | `<selected> selected` | `font:var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)`, `color:var(--color-text-tertiary)` |
| 3 | `<MODE> · <TEXTURE> · <PROJECTION>` | same as 2 |
| 4 | `units: metres` | same as 2 |
| 5 | `1991computer.com/3dengine` | same font, `color:var(--color-text-dim)` |
| 6 | `<uptime> uptime` | same as 5 |

Dividers (L659/L661/L663/L667) reuse the `.divider-v--status` geometry from primitives — `var(--size-hairline)` × `var(--size-divider-status)` (11px) in `var(--color-border-muted)` — but drawn as a `::before` on `.statusItem + .statusItem` rather than as the design's standalone spans, so wrapping cannot strand one. No new divider recipe is declared here.

The design uses a `flex:1` spacer div at L665 to push segments 5 and 6 right. Implement as `margin-left:auto` on the first right-hand segment instead of an empty element.

Group the six segments into three `.statusGroup` wrappers so mobile wrapping is predictable: A = 1 + 2, B = 3 + 4, C = 5 + 6. Each group is `display:flex; align-items:center; gap:var(--space-5); flex-wrap:nowrap`. On desktop the A→B group boundary divider is drawn the same way as the intra-group one; the B→C boundary carries none — the design puts the `flex:1` spacer there (L665) — so suppress it with `.statusGroup--right::before { content: none }`.

All segments `white-space:nowrap`. The bar never scrolls horizontally.

## Mobile

The mockup's mobile strip (L1104–L1110) drops four of the six segments — selected id, projection, `units: metres` and the URL — and keeps only run state, `<MODE> · <TEXTURE>` and uptime. **Restore full parity**: every segment exists on mobile, wrapped rather than dropped.

Container below 900px: `display:flex; flex-wrap:wrap; align-items:center`, `gap:var(--space-4)` (8px), `padding:var(--space-4-5) var(--space-5)` (9px 10px), same `.panel` surface; `height:auto` — `--size-statusbar-h` has no mobile override, so the fixed 24px must be released explicitly. `margin-left:auto` on group C is reset to `0` so the groups pack naturally.

Mobile type sizes step up per the design: run state `var(--font-weight-medium) var(--text-base)` (10px) mono, `var(--color-state-ok)`; all other segments `var(--font-weight-regular) var(--text-base)` mono, `var(--color-text-tertiary)` for segments 2–4 and `var(--color-text-dim)` for 5–6. Dividers keep `var(--size-hairline)` × `var(--size-divider-status)` in `var(--color-border-muted)`.

Wrapping and truncation, narrowest supported width 320px:

- The three `.statusGroup` wrappers wrap as units; intra-group dividers are kept, and the inter-group divider is suppressed below 900px (`.statusGroup + .statusGroup::before { content: none }`) so a wrapped line never opens with a stranded rule. Group separation comes from the 8px gap.
- Only the URL segment may truncate: `flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`. Everything else is `flex:0 0 auto; white-space:nowrap`.
- If the selected id ever exceeds the line, the id span (not the word `selected`) is the second candidate to ellipsize; ids today are at most 16 characters (`CUBOCTAHEDRON_01`, from the keys in `src/data/data.ts`), so size the segment for that before the ellipsis triggers.
- At 320px the strip lays out in three rows; the whole strip stays a single tap-inert readout, so the 44px touch-target rule does not apply — but it must not clip and must not introduce horizontal page scroll.

## Data

| Field | Value shown | Source today |
|---|---|---|
| Run state | `RUNNING` / `PAUSED` | real: `Main.isPlaying` (`src/index.ts` L235, flipped in `togglePause`, L520–L524); push through `fields.write('statusLabel', …)` alongside the existing pause-button label update |
| Selected object | `SPHERE_01 selected`, `TORUS_KNOT_01 selected` | real for the single-mesh scene: `sceneObjectId(Main.currentPrimitiveName)` from `src/ui/sceneObjectId.ts` (shell ticket) — do not re-derive the string here, the snake-case rule is what makes this match the scene-graph row and the viewport bracket. Multi-object selection is `placeholder`, owned by de-mock E7 |
| Shading mode | `WIRE` / `FLAT` today | import `modeLabel()` from the render-tab ticket, which owns `shadingMode` in `UIStateStore`. It reads `Main.wireframeEnabled` (`src/index.ts` L110) until the full six-mode set POINTS/WIRE/FLAT/GOURAUD/DEPTH/NORMALS (design L1162) becomes real in de-mock E3 |
| Texture | `TEXTURED` / `SOLID` | import the derivation the shape-info ticket owns and exports — unique non-`rgba` material strings off `object3D.triangles` (`src/index.ts` L286–L294), reduced to the two-value label. Do not print the raw material list here; the viewport HUD, shape info and this bar must all show the same string |
| Projection | `PERSPECTIVE` / `ORTHOGRAPHIC` | ~~`placeholder`~~ real since COS-236 (de-mock E2). It is a `projection` field the status bar publishes, and the same write reaches the viewport HUD's chip and the CAMERA card's header note |
| Units | `units: metres` | `placeholder`: static design copy, the engine has no world-unit concept; owned by de-mock E5 |
| URL | `1991computer.com/3dengine` | real: static string, matches vite `base: "/3dengine"` |
| Uptime | `m:ss uptime` | real, read-only here. The **system ticket** owns the clock and the formatter: one `setInterval(…, 1000)` started in `Main.init`, published as `fields.write('uptime', …)`. This bar adds no timer. The rAF display throttle cannot drive it — `Main.stop()` cancels the loop on pause (`src/index.ts` L577–L584), while the design deliberately keeps counting while paused (L1223) |

Both placeholder segments carry the shared placeholder affordance from the primitives ticket — `data-placeholder="true"` plus `title` and `aria-describedby` naming the owning de-mock ticket. That convention adds no visual treatment to a read-only text segment, so the bar reads as one uniform line.

All writes go through the injected `FieldWriter` — `this.fields.write(name, value)`, `src/ui/FieldWriter.ts` (shell ticket) — so the desktop and mobile copies of any duplicated node stay in sync.

## Files

- `src/index.html` — one `.statusBar` element carrying `.panel`, with three `.statusGroup` wrappers and six `.statusItem` segments, each carrying `data-field`.
- `src/styles/components/status-bar.css` — new; layout only, imported from `src/styles/main.css` after the shared component files.
- `src/ui/StatusBar.ts` — new: `class StatusBar`, constructed with the shared `FieldWriter`, exposing `setRunState(isPlaying)`, `setSelected(primitive)`, `setMode(wireframeEnabled)` and `setTexture(summary)`. No uptime logic, no timer.
- `src/index.ts` — instantiate the status bar, push run state on pause toggle, push mode on the wireframe toggle, push selected id and texture on primitive change.

## Done when

- [ ] Desktop renders a 24px bar with all six segments, 10px gaps, 1px × 11px dividers, and segments 5–6 pushed right by `margin-left:auto` with no spacer element in the DOM.
- [ ] No divider is drawn at the B→C boundary on desktop, matching the design's spacer at L665.
- [ ] Mobile renders all six segments — including selected id, projection, `units: metres` and the URL that the mockup dropped — wrapping across at most three rows at 320px with no clipping and no horizontal page scroll.
- [ ] Only the URL segment ellipsizes; every other segment stays intact at 320px, including `CUBOCTAHEDRON_01 selected`.
- [ ] No divider ever appears at the start of a wrapped line.
- [ ] Pausing flips the label to `PAUSED` and back, in the same frame as the toolbar pause button.
- [ ] Toggling wireframe flips the mode segment via the shared `modeLabel()`; switching primitive updates the selected id via `sceneObjectId()` and the texture segment to `TEXTURED` (cube) or `SOLID` (the rest) — the same strings the viewport HUD and shape info show.
- [ ] Uptime advances once per second in `m:ss`, keeps advancing while paused, and this ticket adds no `setInterval` of its own.
- [ ] `src/styles/components/status-bar.css` declares no panel surface, border, radius or divider recipe — only layout, wrapping and truncation.
- [ ] No raw hex/px outside the token files.
