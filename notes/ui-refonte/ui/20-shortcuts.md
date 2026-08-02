# Shortcuts panel and mobile gestures card

A documentation strip pinned to the bottom of the right panel listing the keyboard shortcuts, plus a mobile counterpart. The engine binds no `keydown` handler today — `grep -rn keydown src/` returns nothing — so the chips are documentation for bindings a later ticket makes live. Both the chips and the future key handler must read the same table so they cannot drift.

**Design source** — `3D Engine UI.dc.html` desktop L640–L652, no mobile branch — mobile spec below is new.

## Desktop

**Container** (L640): last child of the right panel's scroll body, `margin-top: auto`, `display: flex; flex-direction: column`, `gap: var(--space-2)` (5px), `padding-top: var(--space-4-5)` (9px), `border-top: var(--size-hairline) solid var(--color-border-panel)`.

Caveat: the parent (L457) is `flex: 1; overflow: auto; padding: 8px; gap: 9px`. `margin-top: auto` only pins to the bottom while the tab content is shorter than the panel; once the WORLD tab overflows, the strip scrolls with the content. That is the design's behaviour — do not add `position: sticky` to force it, because a sticky footer over a scrolling list needs a background and the design gives it none.

**Heading** (L641): text `SHORTCUTS`, `var(--font-weight-bold) var(--text-sm)/var(--leading-none) var(--font-sans)`, `letter-spacing: var(--tracking-2xl)` (.14em), `color: var(--color-text-muted)`. Note this is the only section heading in the file that is *not* accent-coloured — the right panel's other section titles use the same font at `var(--color-accent)`. Keep it muted; it marks the block as reference material rather than a control group.

**Chip row** (L642): `display: flex; flex-wrap: wrap; gap: var(--space-1-5)` (4px).

**Chip** (L643–L650): the `.pill` recipe from primitives' `badge.css`, unmodified — 5px inner gap, 3px 6px padding, sunken background, subtle 1px border, 2px radius, 8px mono in `var(--color-text-tertiary)`. This ticket declares no chip surface, border or type.

The design writes each chip as a single text node, so its declared `gap: 5px` never renders. Split it into `<kbd>` (key) + `<span>` (action) so the gap becomes real; keep both at the same colour and weight as the design.

**The eight chips**, in order: `SPACE pause`, `W wireframe`, `G grid`, `C culling`, `R reset`, `S sky`, `F floor`, `1-8 shape`.

**Two chip states.** The bindings split by *why* they are not live:

- **Feature exists, handler pending** — SPACE, W, C, R, S, F and the number range. `togglePause` and `resetControls` exist on `Main` (`src/app/Main.ts:390,409`), `toggleWireframe` and `toggleBackfaceCulling` on the render pipeline panel (`src/ui/RenderPipelinePanel.ts:126,136`); the shape picker is the `#primitives` select wired by `PrimitivePicker.populate` (`src/ui/PrimitivePicker.ts:30`), which the SHAPE tab ticket replaces with a chip grid calling `requestPrimitiveChange`, so by the time this ticket lands the number keys target that; and SKY and FLOOR are real shared `UIStateStore` booleans driving `BackgroundRenderer.setLayers({sky, floor})` from the WORLD tab ticket (D11). Only the `keydown` listener is missing. Render all seven with normal chip styling.
- **Feature does not exist** — G alone. The engine has no grid at all, and GRID stays a placeholder that defaults OFF until the de-mock ticket `WORLD: ground grid` lands (D11). Render it with the shared placeholder affordance defined in the primitives ticket — `data-placeholder="true"` plus a `title` and an `aria-describedby` hint node reading `Grid is not drawn yet — ships with the ground-grid work.` (D4). The affordance carries the dimming; this ticket writes no opacity rule of its own.

Do **not** reuse `FollowCursorTooltip` for the hint. It is a range-input helper: `src/ui/tooltip.ts` L2 types `target: HTMLInputElement`, so a `<span>` or `<kbd>` is a type error, and L43–L59 gate display on proximity to the computed range thumb, which on a chip with no `min`/`max`/`value` collapses to a 14px band at the chip's left edge. It stays exactly where it is, on the disabled opacity slider (D4).

The dim value is `--elevation-opacity-pending: .55`, the single placeholder-opacity token (D3), defined in `tokens/elevation.css` and applied by the primitives affordance. This ticket adds no token.

**Shared table.** Create `src/ui/shortcuts.ts` exporting a `ShortcutBinding` type — `{ keyLabel: string; keys: string[]; action: string; status: 'pendingHandler' | 'pendingFeature'; handler?: string }` — and the `SHORTCUTS` array. `handler` names either the `src/index.ts` method or the `UIStateStore` slice the key will drive. The chip row renders from it; the de-mock ticket `Keyboard shortcut handler` imports the same array and dispatches on `keys`. Neither side may hardcode a key.

**The number range is computed.** `1-8` is not a literal: it is `1-${Object.keys(data).length}` from `src/data/data.ts`, which currently holds exactly eight primitives (`sphere, cube, pyramid, cross, donut, torusKnot, menger, cuboctahedron`). Adding a ninth must turn the chip into `1-9` and extend `keys` to `['1'…'9']` with no edit here.

**Hover.** None — the chips are not interactive.

## Mobile

The mockup has no mobile version of this widget at all. Shipping the keyboard chips on a touch device would be dead documentation: there is no keyboard, so eight key hints are pure noise. This ticket therefore specifies an equivalent **GESTURES** card carrying the same information in the form a touch user can act on, placed in the SCENE tab as the **last** card, below SHAPE STORY (design L837–L863), with the standard `var(--space-5)` (10px) stack gap (D11). The keyboard chip row does not render under 900px.

**Card**: full-bleed inside the 10px page padding, `.panel` from the primitives ticket. This ticket declares no surface, border or radius.

**Header**: `.panel__header` with `.panel__title` `GESTURES` and no note. The 26px height, the 9px padding and the accent 9px `.16em` title type all come from primitives' `@media (max-width: 899px)` block — do not restate them.

**Body**: `.panel__body--pad-form` (9px 11px 12px), the primitives variant, not a local padding rule.

**Rows**: three, each `height: 44px` (the mobile touch floor; these rows are non-interactive but sit in a touch layout, so match the tab/scene-row rhythm rather than the 48px toggle row), `display: flex; align-items: center; justify-content: space-between`, `border-bottom: var(--size-hairline) solid var(--color-border-row)` except the last — the row divider the mobile branch draws and desktop does not, so it is its own literal rather than a per-branch copy of another token. Gesture label left: `var(--font-weight-medium) var(--text-md)/var(--leading-none) var(--font-sans)` (11px), `letter-spacing: var(--tracking-xs)` (.08em), `color: var(--color-text-secondary)` — the mobile toggle-row label recipe. Effect right: `var(--font-weight-medium) var(--text-md)/var(--leading-none) var(--font-mono)`, `color: var(--color-text-primary)` — the mobile value recipe.

| Gesture | Effect |
| --- | --- |
| `DRAG` | `orbit` |
| `PINCH` | `zoom` |
| `DOUBLE TAP` | `reset` |

**Pointer line** — the four keyboard bindings with no gesture equivalent become one footer line under the rows, pointing at the real controls: `8 primitives in the SHAPE tab · sky, floor, grid in the WORLD tab`, `var(--font-weight-regular) var(--text-base)/var(--leading-none) var(--font-mono)` (10px), `color: var(--color-text-dim)`, `padding-top: var(--space-2-5)`. The count is the same `Object.keys(data).length` the desktop range uses.

**Pending note** — all three gestures are pending-feature (the canvas has no pointer, touch or wheel handlers at all), so dimming each row individually would just dim the whole card. Instead add one footer line below the pointer line, same type and colour: `Gestures ship with pointer camera control.` No per-row placeholder affordance, no tooltip.

**Touch-target note**: nothing in this card is tappable, so the 44px rows are rhythm, not hit area. If the de-mock ticket later makes a row tappable it already meets the minimum.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Chip list (8 chips) | key + action per chip | real — `SHORTCUTS` in `src/ui/shortcuts.ts`, the same array the future key handler reads |
| Number-range chip label | `1-8` | real — `1-${Object.keys(data).length}` from `src/data/data.ts` |
| SPACE / W / C / R chip state | normal styling | placeholder binding — the actions exist (`togglePause` L520, `toggleWireframe` L546, `toggleBackfaceCulling` L552, `resetControls` L635 in `src/index.ts`) but no `keydown` listener does; de-mock `Keyboard shortcut handler` |
| S / F chip state | normal styling | placeholder binding — SKY and FLOOR are real shared `UIStateStore` booleans driving `BackgroundRenderer.setLayers` (WORLD tab ticket, D11); only the key dispatch is missing; de-mock `Keyboard shortcut handler` |
| Number-range chip state | normal styling | placeholder binding — the shape picker is real (`PrimitivePicker.populate`, `src/ui/PrimitivePicker.ts:30`, replaced by the SHAPE tab chip grid calling `requestPrimitiveChange`); only the key dispatch is missing; de-mock `Keyboard shortcut handler` |
| G chip state | placeholder affordance | placeholder — no grid exists and GRID defaults OFF; de-mock `WORLD: ground grid` |
| Mobile gesture rows | `DRAG orbit`, `PINCH zoom`, `DOUBLE TAP reset` | placeholder — the canvas has no pointer, touch or wheel handlers; de-mock `Pointer orbit, pinch zoom, double-tap reset` |
| Mobile pointer line | `8 primitives in the SHAPE tab · sky, floor, grid in the WORLD tab` | real — `Object.keys(data).length` |

## Files

- `src/ui/shortcuts.ts` (new) — `ShortcutBinding` type, the `SHORTCUTS` array, and the derived shape-key range.
- `src/ui/shortcutsPanel.ts` (new) — renders the desktop chip row and the mobile gestures card from `SHORTCUTS`; applies the primitives placeholder affordance to the one pending-feature chip.
- `src/index.html` — the right-panel footer slot and the mobile SCENE-tab slot, appended after the SHAPE STORY card.
- `src/styles/components/shortcuts.css` (new) — both branches, imported from `main.css`.
- `src/styles/main.css` — component import.

## Done when

- [ ] Eight chips render in the design order, generated from `SHORTCUTS`; no key string is hardcoded in the markup or CSS.
- [ ] Each chip is a `<kbd>` + `<span>` pair, so the declared 5px inner gap is visible.
- [ ] Adding a ninth primitive to `src/data/data.ts` changes the chip to `1-9` and extends its `keys` array with no edit to the panel or the CSS.
- [ ] G is the only chip carrying the placeholder affordance (`data-placeholder="true"` + `title` + `aria-describedby`, dimmed by `var(--elevation-opacity-pending)`); the other seven render at full opacity.
- [ ] `FollowCursorTooltip` is not imported by this ticket and `src/ui/tooltip.ts` is unchanged.
- [ ] No token is added by this ticket.
- [ ] The block sits at the bottom of the right panel via `margin-top: auto` above a `var(--color-border-panel)` top rule, and scrolls with the content once the WORLD tab overflows.
- [ ] The heading is `var(--color-text-muted)`, not accent.
- [ ] Under 900px the keyboard chips do not render and the GESTURES card is the last card in the SCENE tab, below SHAPE STORY, at the 10px stack gap, with 44px rows, the pointer line and the pending note.
- [ ] No `keydown` listener is added in this ticket; each pending state names its de-mock ticket in a code comment.
- [ ] No raw hex or px outside the token files, and no `*-mobile` token name is referenced.
