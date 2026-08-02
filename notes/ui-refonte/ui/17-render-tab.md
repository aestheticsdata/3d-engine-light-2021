# RENDER tab: shading mode, pipeline, lighting

The RENDER tab is the second inspector tab: how faces are shaded, which pipeline stages are on, and where the light is. Two of its controls are the real engine flags that the shell ticket parked in this tab body as the two bare text-button rows from `src/index.html` L62–L69; the rest are built now and wired by the de-mock epic. This tab must be scrupulous about the difference, because it is the one place where a visitor could reasonably believe the renderer does something it does not. It also owns the `shadingMode` slice of `src/ui/UIStateStore.ts` and the exported `modeLabel()` that four other widgets read.

**Design source** — `3D Engine UI.dc.html` desktop L536–L586, mobile L930–L977.

## Desktop

Same tab body as the SHAPE tab: the shell's scroll container at `padding: var(--space-4); gap: var(--space-4-5)`, sections stacked with that gap, headings in `.section-title`. One `.divider` sits between PIPELINE and LIGHTING (L560). There is no rule between SHADING MODE and PIPELINE.

The chip recipe, the segmented toggle and its four colour slots, the slider row geometry and the range skin all belong to the primitives ticket (`src/styles/components/{chip,toggle,slider}.css`). This ticket restates none of them; it composes `.chip-grid` / `.chip--mode` / `.toggle-row` / `.toggle` / `.slider-row` and owns the `toggleRow.ts` factory.

### SHADING MODE (L538–L545)
`.chip-grid` with `--chip-cols: 3`, chips `.chip--mode`. Six chips in `MODES` order (L1162): POINTS, WIRE, FLAT, GOURAUD, DEPTH, NORMALS.

### PIPELINE (L548–L558)
Five `.toggle-row`s, no divider between them on desktop. Rows in order: WIREFRAME, BACKFACE CULLING, Z-BUFFER, DITHERING, EDGE ANTIALIAS (`pipeToggles`, L1502–L1508).

The control paints both halves at all times and swaps four colours between states — that asymmetry is deliberate and is specified once, in primitives. `toggleRow.ts` is a TS factory over `.toggle-row` / `.toggle` / `.toggle__half`: it renders the markup, sets `.is-on`, applies `role="switch"` and `aria-checked`, binds click plus Space and Enter, and on mobile binds the whole row as the hit area.

### LIGHTING (L562–L585)
Four `.slider-row`s built by the SHAPE tab's `sliderRow.ts`: AZIMUTH 0..360 `°`, ELEVATION 0..90 `°`, AMBIENT 0..100 `%`, SPECULAR 0..100 `%` (`lightSliders`, L1416–L1419).

## Mobile

Three full-bleed `.panel` cards in the page column with `gap: var(--space-5)`, each with a 26px `.panel__header` carrying the section name as its `.panel__title`. Card order matches desktop: SHADING MODE, PIPELINE, LIGHTING.

- SHADING MODE card (L932–L941): plain `.panel__body`. `.chip-grid` stays `--chip-cols: 3`; `--size-chip-mode` resolves to 44px and the grid gap to `var(--space-2-5)`. At a 320px viewport that is 300px less 18px body padding and two 6px gaps, giving 90px per chip — GOURAUD, the longest label, is 7 glyphs of 10px mono and fits with margin.
- PIPELINE card (L943–L958): `.panel__body--pad-list`. Rows take the primitives mobile treatment: `--size-toggle-row` 48px, a `border-bottom` in `var(--color-border-row)` on every row including the last (matching the design), and a brighter, larger label than desktop (`var(--text-md)` in `var(--color-text-secondary)`, not `var(--text-sm)` in tertiary). The control paints 88 × 32.
- LIGHTING card (L960–L975): `.panel__body--pad-form`. The four `.slider-row`s pick up the mobile stacked layout — label and value in a `.slider-row__head` above a full-width input at `var(--size-slider-input)` (26px), no value column.

The painted toggle is 32px tall inside a 48px row. `toggleRow.ts` binds the click and the `role="switch"` semantics to the whole row on mobile, so the hit area is the full 48px without changing the painted 88 × 32; primitives' `.tap-pad` covers the toggle itself for pointer users who aim at the control.

## Shading mode — do not ship a fake

The mockup sells its six shading modes with a CSS filter over a static viewport image (`FILTERS`, L1163–L1170: `grayscale(1) contrast(1.35) brightness(.9)` for DEPTH, `hue-rotate(155deg) saturate(1.6)` for NORMALS, and so on). **This repo renders for real, and a CSS filter laid over a real render is a lie about the rasterizer.** Do not port `FILTERS`. Do not apply any filter to `#canvasID`.

What to do instead:
- All six chips render, are selectable, are keyboard reachable, and write `shadingMode` in `src/ui/UIStateStore.ts`.
- WIRE is the only chip with an engine behind it. Selecting it turns wireframe on; the canvas visibly changes.
- The other five change the chip's selected state and nothing else. The engine ignores `shadingMode` until de-mock E3 (shading pipeline).
- Mark the section rather than each chip, reusing an idiom the design already has: the SHADING MODE header becomes a `space-between` row with a right-aligned `.panel__note` reading `PREVIEW` — identical typography and placement to the PRIMITIVE header's count on the SHAPE tab. Each unbacked chip additionally carries the primitives placeholder affordance: `data-placeholder="true"` + a `title` stating the mode is not implemented yet + `aria-describedby`. No new colours, no new shapes, no badge invented from nothing.

### One flag, three controls
WIREFRAME appears as the WIRE shading chip, as the PIPELINE WIREFRAME toggle, and as the WIRE viewport quick toggle. There is one boolean (`wireframeEnabled`, `src/index.ts` L546–L550), exposed as `store.wireframe`, and all three read and write it. Rules:
- Selecting the WIRE chip sets wireframe on.
- Selecting any other shading chip sets wireframe off.
- Turning the WIREFRAME toggle (or the quick toggle) on selects the WIRE chip; turning it off returns the chip selection to FLAT.

Default shading chip is **FLAT**, not the mockup's `gouraud` (L1174) — this rasterizer fills triangles flat, and defaulting to a mode it cannot do would misdescribe the very first frame.

### `modeLabel()` belongs to this ticket
`src/ui/shadingMode.ts` is new and owned here: it exports the key→label map that titles the chips (POINTS, WIRE, FLAT, GOURAUD, DEPTH, NORMALS) and `modeLabel()`, which returns the label for the current `store.shadingMode`. SHAPE INFO's SHADING row, the viewport HUD mode chip and the status bar's mode segment all import it instead of deriving their own string; the viewport HUD's hardcoded GOURAUD goes away with it. One value, one derivation.

## Pipeline — what is real

WIREFRAME and BACKFACE CULLING are live and replace the two text-button rows. Both reach the rasterizer as `TriangleRenderOptions` (`src/primitives/Triangle.ts` L61–L65) through `Surface3D.render`. Backface culling defaults to **on** (`src/index.ts` L198), wireframe defaults to **off** (L197) — the mockup's defaults (`wire: true, cull: false`, L1178) are the opposite and are wrong for this engine.

Enabling culling resets opacity to 100 and disables the OPACITY slider with its follow-cursor tooltip (`toggleBackfaceCulling`, `src/index.ts` L552–L564). That rule is owned by the SHAPE tab ticket; this ticket must not regress it when the flip arrives from the PIPELINE toggle.

Drop the current label inversion while porting: `syncToggleButtons` (L526–L544) prints the *action* (`wireframeEnabled ? "off" : "on"`), while the segmented control prints the *state*. Delete `syncToggleButtons` and the `wireframeBtn` / `wireframeRow` / `wireframeLabel` / `backfaceCullingBtn` / `backfaceCullingRow` / `backfaceCullingLabel` lookups it drives, together with their entries in the constructor's element-id guard (L130–L177). The matching `.toggleRow*` / `.toggleLabel*` rules in `src/styles/main.css` are deleted by the shell ticket's teardown, not here.

## Lighting

There is no light in this engine. `Triangle` fills with the material string baked into the shape data; no normal is ever computed for shading. All four sliders are placeholders: they render, move, format their value, carry the placeholder affordance, and write the `lighting` slice of `src/ui/UIStateStore.ts`.

The mockup's scene graph carries a `KEY_LIGHT` entry whose row participates in the scene-graph ticket's visibility state. Both tickets read the same `lighting` slice, so hiding KEY_LIGHT and moving AZIMUTH cannot end up describing two different fictional lights.

## Data

| Field | Value shown | Source today |
|---|---|---|
| Shading chip: WIRE | selected / not | real — `wireframeEnabled` (`src/index.ts` L546) |
| Shading chips: POINTS, FLAT, GOURAUD, DEPTH, NORMALS | selected / not | `placeholder` — default FLAT; chip selects and the engine ignores it; owned by de-mock E3 |
| WIREFRAME toggle | ON / OFF | real — `store.wireframe`, default off |
| BACKFACE CULLING toggle | ON / OFF | real — `store.cull` backing `backfaceCullingEnabled` (`src/index.ts` L552), default on; enabling it resets and disables OPACITY |
| Z-BUFFER toggle | ON / OFF | `placeholder` — default ON; the renderer has no depth buffer (painter order only); owned by de-mock E3 |
| DITHERING toggle | ON / OFF | `placeholder` — default OFF; de-mock E3 |
| EDGE ANTIALIAS toggle | ON / OFF | `placeholder` — default ON; de-mock E3 |
| AZIMUTH | `v + "°"` | `placeholder` — default 135 |
| ELEVATION | `v + "°"` | `placeholder` — default 42 |
| AMBIENT | `v + "%"` | `placeholder` — default 30 |
| SPECULAR | `v + "%"` | `placeholder` — default 55 |

All four lighting placeholders are owned by de-mock E3, which is also what makes the KEY_LIGHT scene-graph row mean something.

## Files

- `src/ui/inspector/renderTab.ts` — new
- `src/ui/shadingMode.ts` — new; the shading key→label map and `modeLabel()`, imported by shape-info, viewport-hud and status
- `src/ui/inspector/controls/toggleRow.ts` — new; the shared ON/OFF factory over the primitives classes (`role="switch"`, `aria-checked`, keyboard, full-row hit area on mobile), reused by the WORLD tab. Declares no colours
- `src/ui/inspector/controls/chipGrid.ts` — reused from the SHAPE tab ticket, extended with an optional per-chip placeholder affordance and an optional section-header note
- `src/ui/inspector/controls/sliderRow.ts` — reused from the SHAPE tab ticket
- `src/ui/UIStateStore.ts` — extended with `shadingMode` (owned here), `zbuffer`, `dither`, `edgeAA`, `lighting.{azimuth,elevation,ambient,specular}`, and the shared `wireframe` / `cull` booleans
- `src/index.ts` — expose wireframe and culling through the shared store instead of the two button handlers; delete `syncToggleButtons` and the six element lookups it needs, including their entries in the constructor guard
- `src/index.html` — mount the tab into the RENDER slot the shell created; the two parked text-button rows are consumed here

No new stylesheet: every rule this tab needs already exists in `src/styles/components/`.

## Done when

- [ ] No CSS filter is applied to `#canvasID` or any ancestor, and `FILTERS` from the mockup appears nowhere in the repo
- [ ] Selecting WIRE turns wireframe on and the canvas changes; selecting any other shading chip turns it off; the PIPELINE toggle, the shading chip and the viewport quick toggle never disagree
- [ ] The five unbacked shading chips select visually, persist in `UIStateStore`, carry `data-placeholder="true"` with a `title` and `aria-describedby`, and provably change nothing about the rendered frame
- [ ] The SHADING MODE header carries the `PREVIEW` note in the same typography and position as the PRIMITIVE header's count
- [ ] `modeLabel()` is exported from `src/ui/shadingMode.ts` and is the only derivation of the mode string in the tree; no widget hardcodes GOURAUD
- [ ] BACKFACE CULLING still defaults to on, and flipping it from this tab still resets OPACITY to 100, disables the OPACITY slider and leaves its follow-cursor tooltip working
- [ ] `syncToggleButtons` and the six wireframe/culling element lookups are gone, including from the constructor's id guard, and the branch still boots
- [ ] The segmented toggle reads as ON/OFF state rather than as an action, in both branches, using only the primitives colour slots — this ticket declares no colour table
- [ ] Toggles are `role="switch"` with `aria-checked`, keyboard operable with Space and Enter, and have a visible focus state
- [ ] The toolbar's RESET path restores every slice this ticket adds — shading mode back to FLAT, wireframe off, culling on, z-buffer on, dithering off, edge AA on, and the four lighting values
- [ ] At `max-width: 899px`: three cards with 26px headers, 44px shading chips, 48px toggle rows each with a bottom rule, the whole row acting as the 48px hit target for the painted 88 × 32 control, and 26px slider tracks with the label/value row above
- [ ] Hover rules are inside `@media (hover: hover)`
- [ ] No raw hex or raw px for a tokenised value outside `src/styles/tokens/*.css`
