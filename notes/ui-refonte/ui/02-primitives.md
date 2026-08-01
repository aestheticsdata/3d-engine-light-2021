# Panel and control primitives (shared CSS component layer)

Every widget in the mockup is assembled from about a dozen repeated pieces: the panel card, its header strip, the label/value row, the chip, the ON/OFF toggle, the slider row, the stat tile, the badge, the HUD chip, the divider, the scrollbar and the placeholder affordance. Building them once as a shared component layer keeps the 30-odd widget tickets to markup plus a couple of modifiers each, and keeps the hover and active states identical everywhere. This ticket adds `src/styles/components/`, consumed by every UI ticket that follows; it ships no new markup of its own.

**Design source** — `3D Engine UI.dc.html` global style L14–L28, desktop L33–L671, mobile L673–L1114, state helpers L1313–L1341 (`chip`, `toggleRow`, `quick`) and L1383–L1392 (`tabOn`, `mTab`).

Depends on the tokens ticket, and on nothing else. Class naming is BEM-ish kebab-case (`.block__element`, `.block--variant`, `.is-active` / `.is-on` / `.is-disabled` for state). The legacy camelCase classes (`.sidePanel`, `.panelHeader`, `.infoRow`, `.sliderRow`, …) are left untouched here — the shell ticket owns the legacy teardown. One exception: `.hoverTooltip` keeps its name, because `src/ui/tooltip.ts` L18 hardcodes `this.tooltipNode.className = "hoverTooltip"`.

### What this ticket owns, and what nobody else may redeclare

This layer is the single home for every shared visual recipe: the panel card, both header variants, the panel title and note, the info row, the stat row, the stat tile, the chip and its colour table, the segmented toggle and its four-slot colour table, the slider row geometry, the range-input skin, the swatch, the badge, the HUD chip, the divider, the custom scrollbar and the placeholder affordance. Consequences:

- **There is no `telemetryCard.css`.** The framerate ticket must not create one. All six telemetry cards (framerate, frame-time, geometry, z-buffer, camera, system) are `.panel--fill` + `.panel__header--card` + `.panel__body--*` + `.stat-list` / `.stat-row` / `.stat-tile`, on both branches. Framerate is therefore not a blocker for the other five.
- The shell ticket consumes `.panel`; it must not ship a second `.panel` recipe in `layout.css`. Shell owns the flex boxes, the `display:contents` + `order` map and the base rules only.
- The tab tickets own TS factories only (`chipGrid.ts`, `sliderRow.ts`, `toggleRow.ts`) and never restate a colour table or a geometry.

Buttons and tabs are included beyond the listed set: they repeat across the toolbar, the mobile action row, the inspector tab strip and the mobile tab bar, so five later tickets would otherwise each redefine them.

## Desktop

All values below are the design's; express each through the token it maps to. Every 1px border is `var(--size-hairline)`; every media block is `@media (max-width: 899px)`.

### panel.css

`.panel` — `background: var(--color-panel-bg); border: var(--size-hairline) solid var(--color-border-panel); border-radius: var(--radius-lg); overflow: hidden;` and `display:flex; flex-direction:column;`. Modifier `.panel--fill` adds `flex:1; min-height:0` for cards that must clip a scroll area or a flexing canvas (the design relies on `min-height:0` in 11 places; without it the nested flex scrollers do not clip).

`.panel__header` — `height: var(--size-panel-header)` (24px sidebar; `.panel__header--card` uses `--size-panel-header-card`, 22px, for the telemetry row), `display:flex; align-items:center; justify-content:space-between; padding: 0 var(--space-4); background: var(--color-panel-header-bg); border-bottom: var(--size-hairline) solid var(--color-border-panel); flex: 0 0 auto`.

`.panel__title` — `font: var(--font-weight-bold) var(--text-sm)/var(--leading-none) var(--font-sans); letter-spacing: var(--tracking-3xl); color: var(--color-accent); text-transform: uppercase`.

`.panel__note` — right-hand meta, `font: var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono); color: var(--color-text-dim)`. Headers with no note simply omit the element (the header stays `justify-content:space-between`, which is harmless with one child).

`.panel__body` — `padding: var(--space-3) var(--space-4)` (7px 8px) for sidebar panels, `.panel__body--pad-4` = `var(--space-4)` (8px) for telemetry cards, `.panel__body--scroll` adds `overflow:auto; flex:1; min-height:0`.

`.section-title` — the in-panel section heading used by the inspector: `font: var(--font-weight-bold) var(--text-sm)/var(--leading-none) var(--font-sans); letter-spacing: var(--tracking-2xl); color: var(--color-accent); margin-bottom: var(--space-2-5)`.

### rows.css

`.info-row` — `display:flex; align-items:center; justify-content:space-between; height: var(--size-row-info)` (19px). Container gap is `var(--space-px)` (1px) on desktop; expose it as `.info-list { display:flex; flex-direction:column; gap: var(--space-px) }`.
`.info-row__label` — `font: var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-sans); letter-spacing: var(--tracking-lg); color: var(--color-text-muted)`.
`.info-row__value` — `font: var(--font-weight-medium) var(--text-base)/var(--leading-none) var(--font-mono); color: var(--color-text-primary)`. Modifier `.info-row__value--ok` → `var(--color-state-ok)` (SHADING and MATERIAL rows).

`.stat-row` — telemetry variant: no fixed height on desktop, `.stat-list { display:flex; flex-direction:column; gap: var(--space-1-5) }` (4px); label `var(--font-weight-medium) var(--text-sm)` with `--tracking-sm` and `--color-text-tertiary`; value `var(--font-weight-medium) var(--text-base)` mono, colour set per row via a modifier (`--ok`, `--warn`, `--info`, `--dim`).

### button.css

`.btn` base — `display:inline-flex; align-items:center; justify-content:center; height: var(--size-button); border-radius: var(--radius-md); cursor:pointer; border: var(--size-hairline) solid transparent; white-space:nowrap`.

| Variant | Background | Border | Type | Padding | Hover |
|---|---|---|---|---|---|
| `.btn--primary` (pause/play) | `--color-accent` | none | `700 var(--text-base)/var(--leading-none)` sans, `--tracking-xl`, `--color-on-accent` | `0 var(--space-6)` | background `--color-accent-hover` |
| `.btn--secondary` (STEP, RESET, CAPTURE PNG, SAVE PRESET, LOAD) | `--color-button-secondary-bg` | `--color-border-control` | `500 var(--text-base)/var(--leading-none)` sans, `--tracking-md`, `--color-text-button` | `0 var(--space-5)` | background `--color-button-secondary-bg-hover` |
| `.btn--code` (COPY CODE) | `--color-surface-sunken` | `--color-border-muted` | `500 var(--text-base)/var(--leading-none)` mono, `--color-state-ok` | `0 var(--space-5)` | border-color `--color-state-ok` |

Inconsistency resolved here: STEP/RESET are `500 10px` (L49–L50) while CAPTURE PNG/SAVE PRESET/LOAD are `500 9px` (L68–L70), all at `.1em`. Every secondary button is `--text-base` (10px), which is what STEP/RESET and the whole mobile action row already use; the design's 9px action cluster is deliberately not preserved, and the toolbar ticket uses this recipe rather than a class of its own.

### tabs.css

`.tabs` — `display:flex; height: var(--size-tab); background: var(--color-panel-header-bg); border-bottom: var(--size-hairline) solid var(--color-border-panel); flex: 0 0 auto`.
`.tabs__tab` — `flex:1; display:flex; align-items:center; justify-content:center; cursor:pointer; border-bottom: var(--size-mark) solid transparent; font: 700 var(--text-sm)/var(--leading-none) var(--font-sans); letter-spacing: var(--tracking-xl); color: var(--color-text-muted); background: transparent`.
`.tabs__tab.is-active` — `color: var(--color-accent); background: var(--color-panel-bg); border-bottom-color: var(--color-accent)`.

### chip.css

One base, four size modifiers. `.chip` — `display:flex; align-items:center; justify-content:center; border-radius: var(--radius-sm); cursor:pointer; background: var(--color-surface-sunken); border: var(--size-hairline) solid var(--color-border-subtle); color: var(--color-text-tertiary)`.
`.chip.is-active` — `background: var(--color-chip-active-bg); border-color: var(--color-accent); color: var(--color-accent)`.
Hover (desktop only, see below) — `border-color: var(--color-accent)`.

| Modifier | Height | Grid | Type |
|---|---|---|---|
| `.chip--shape` | `--size-chip-shape` 44px | `repeat(4,1fr)` gap `--space-1-5` | column, gap 4px; label `500 var(--text-xs)` mono `--tracking-normal`; meta `400 var(--text-xs)` mono `--color-text-dim` |
| `.chip--mode` | `--size-chip-mode` 26px | `repeat(3,1fr)` gap `--space-1-5` | `500 var(--text-sm)` mono |
| `.chip--tex` | `--size-chip-tex` 24px | `repeat(2,1fr)` gap `--space-1-5` | `500 var(--text-sm)` mono |
| `.chip--view` | `--size-chip-view` 24px | `repeat(5,1fr)` gap `--space-1-5` | `500 var(--text-xs)` mono |
| `.chip--proj` | `--size-chip-proj` 24px | `flex:1` pair, gap `--space-1-5` | `500 var(--text-sm)` mono |

Provide `.chip-grid` with a `--chip-cols` custom property so the widget tickets set columns without new CSS: `display:grid; grid-template-columns: repeat(var(--chip-cols,4),1fr); gap: var(--space-1-5)`.

Swatch (`.swatch`) belongs here too — `width: var(--size-swatch-w); height: var(--size-swatch-h); border-radius: var(--radius-sm); border: var(--size-mark) solid var(--color-border-subtle); cursor:pointer`, `.swatch.is-active` → `border-color: var(--color-text-max)`.

### toggle.css

`.toggle-row` — `display:flex; align-items:center; justify-content:space-between; height: var(--size-toggle-row)` (26px).
`.toggle-row__label` — `500 var(--text-sm)/var(--leading-none)` sans, `--tracking-sm`, `--color-text-tertiary`.
`.toggle` — `display:flex; width: var(--size-toggle-w); height: var(--size-toggle-h)` (62 × 19), `border: var(--size-hairline) solid var(--color-border-control); border-radius: var(--radius-sm); overflow:hidden; cursor:pointer`.
`.toggle__half` — `flex:1; display:flex; align-items:center; justify-content:center; font: 700 var(--text-xs)/var(--leading-none) var(--font-mono)`.

The control paints both halves; four colour slots, from `toggleRow()` L1319–L1326:

| State | ON half bg / fg | OFF half bg / fg |
|---|---|---|
| `.toggle.is-on` | `--color-accent` / `--color-on-accent` | `--color-surface-sunken` / `--color-slate-500` |
| `.toggle` (off) | `--color-surface-sunken` / `--color-slate-500` | `--color-slate-500` / `--color-text-primary` |

The design has no hover on the toggle — do not invent one.

### slider.css

Desktop slider row, one line:

```css
.slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-0-5) 0;
}
.slider-row__label {
  flex: 0 0 var(--size-slider-label-col);          /* 66px, wraps to 2 lines */
  font: 500 var(--text-sm)/var(--leading-snug) var(--font-sans);
  letter-spacing: var(--tracking-sm);
  color: var(--color-text-muted);
}
.slider-row input[type="range"] { flex: 1; height: var(--size-slider-input); }
.slider-row__value {
  flex: 0 0 var(--size-slider-value-col);          /* 44px */
  text-align: right;
  font: 500 var(--text-base)/var(--leading-none) var(--font-mono);
  color: var(--color-text-primary);
}
```

Range element skin, ported from the design's global block (L19–L22) and extended:

```css
input[type="range"] {
  -webkit-appearance: none; appearance: none;
  background: transparent; cursor: ew-resize; margin: 0;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: var(--size-range-track);                 /* 3px */
  background: var(--color-border-muted);           /* #23386B */
  border-radius: var(--radius-sm);
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: var(--size-range-thumb-w);                /* 9px */
  height: var(--size-range-thumb-h);               /* 15px */
  margin-top: -6px;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--color-accent);
}
input[type="range"]:disabled { cursor: not-allowed; }
input[type="range"]:disabled::-webkit-slider-thumb { background: var(--color-slate-500); }
```

**No opacity fade on the disabled state.** The design has no alpha-dimming idiom on a control anywhere; the disabled slider reads as disabled through the slate thumb and the `not-allowed` cursor. The current `main.css` L283–L286 `opacity: .45` is not carried over. This layer paints the state; the shape-tab ticket owns the binding that sets `opacitySlider.disabled`.

NEW, not in the design: matching `::-moz-range-track` / `::-moz-range-thumb` rules including the disabled thumb colour (the design only ships the WebKit pseudo-elements), and a `:focus-visible` outline on the thumb using `--color-accent-hover` for keyboard users.

Hover (desktop only): `input[type="range"]:hover::-webkit-slider-thumb { background: var(--color-accent-hover) }`.

### tile.css

`.stat-tile` — `flex:1; padding: var(--space-1-5) var(--space-2-5)` (4px 6px), `background: var(--color-surface-sunken); border: var(--size-hairline) solid var(--color-border-subtle); border-radius: var(--radius-sm)`.
`.stat-tile__caption` — `500 var(--text-xs)/var(--leading-none)` sans, `--tracking-md`, `--color-text-muted`.
`.stat-tile__value` — `margin-top: var(--space-1)` (3px), `700 var(--text-2xl)/var(--leading-none)` mono (13px), default colour `--color-text-primary`; modifiers `--warn` (`--color-state-warn`) and `--ok` (`--color-state-ok`).
`.stat-tile-row` — `display:flex; gap: var(--space-2-5)`; the design gives the DROPPED tile `flex:1.1`, exposed as `.stat-tile--wide`.

### badge.css

`.badge` — `display:inline-flex; align-items:center; gap: var(--space-2-5); align-self:flex-start; padding: var(--space-2) var(--space-4-5)` (5px 9px), `border-radius: var(--radius-sm)`.
`.badge--info` (DENSITY) — `background: var(--color-badge-info-bg); border: var(--size-hairline) solid var(--color-border-badge-info)`; label `500 var(--text-sm)/var(--leading-none)` sans `--tracking-lg` `--color-text-info`; value `700 var(--text-base)/var(--leading-none)` mono `--color-text-primary`.
`.pill` (keyboard shortcuts) — `display:flex; align-items:center; gap: var(--space-2); padding: var(--space-1) var(--space-2-5)` (3px 6px), `background: var(--color-surface-sunken); border: var(--size-hairline) solid var(--color-border-subtle); border-radius: var(--radius-sm); font: 400 var(--text-xs)/var(--leading-none) var(--font-mono); color: var(--color-text-tertiary)`.

### hud.css

`.hud-chip` — `display:flex; align-items:center; gap: var(--space-2-5); height: var(--size-hud-chip)` (22px), `padding: 0 var(--space-4); background: var(--elevation-hud-bg); border: var(--size-hairline) solid var(--elevation-hud-border); border-radius: var(--radius-sm); backdrop-filter: var(--blur-hud)`. Text `400 var(--text-sm)/var(--leading-none)` mono `--color-text-secondary`.
`.hud-chip--accent` — `border-color: var(--color-accent-overlay-border)`, text `700 var(--text-sm)/var(--leading-none)` mono `--tracking-xs` `--color-accent`.
`.hud-panel` (camera readout) — same surface, `flex-direction:column; gap: var(--space-1); padding: var(--space-3) var(--space-4-5); min-width: var(--size-camera-readout-minw)`; key `400 var(--text-sm)/var(--leading-hud)` mono `--color-text-hud-label`, value `500 var(--text-sm)/var(--leading-hud)` mono `--color-text-primary`.
`.quick-toggle` — `height: var(--size-chip-quick)` (24px), `padding: 0 var(--space-5); border-radius: var(--radius-sm); backdrop-filter: var(--blur-hud); font: 700 var(--text-sm)/var(--leading-none) var(--font-mono); letter-spacing: var(--tracking-chip)`. Off: `background: var(--color-hud-bg); color: var(--color-text-tertiary); border: var(--size-hairline) solid var(--color-hud-border-strong)`. `.quick-toggle.is-on`: `background: var(--color-accent-overlay); color: var(--color-on-accent); border-color: var(--color-accent)`. Hover: `border-color: var(--color-accent)`.

### divider.css

`.divider` — `height: var(--size-hairline); background: var(--color-border-panel)` (the section rules between inspector groups).
`.divider--inset` — adds `margin: var(--space-2) 0` (the 5px rule inside the shape-info list).
`.divider--subtle` — `background: var(--color-border-subtle)`, used as `border-top` equivalents inside cards.
`.divider-v` — `width: var(--size-hairline); background: var(--color-border-muted)`, height by modifier: `--toolbar` `var(--size-divider-toolbar)` 20px with `margin: 0 var(--space-1-5)`, `--status` `var(--size-divider-status)` 11px, `--hud` `var(--size-divider-hud)` 10px with `background: var(--color-slate-500)`.

### scrollbar.css

```css
::-webkit-scrollbar { width: var(--size-scrollbar); height: var(--size-scrollbar); }
::-webkit-scrollbar-track { background: var(--color-surface-sunken); }
::-webkit-scrollbar-thumb { background: var(--color-border-muted); border-radius: var(--radius-lg); }
::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }
```

NEW, not in the design: `* { scrollbar-width: thin; scrollbar-color: var(--color-border-muted) var(--color-surface-sunken); }` so Firefox is not left with the light default.

### tooltip.css

`.hoverTooltip` keeps its class name and its `position:fixed; z-index:1000; display:none; pointer-events:none; max-width: var(--size-tooltip-max-w)` behaviour, restyled onto the console palette: `background: var(--color-hud-bg); border: var(--size-hairline) solid var(--color-hud-border); border-radius: var(--radius-sm); backdrop-filter: var(--blur-hud); padding: var(--space-2) var(--space-3); font: 500 var(--text-sm)/var(--leading-hud) var(--font-mono); color: var(--color-text-primary)`. Drop the `box-shadow` — the design has none anywhere. `--size-tooltip-max-w` (220px) is defined by the tokens ticket and marked NEW there; this ticket only consumes it.

Blocking detail: `src/ui/tooltip.ts` L20–L21 writes `this.tooltipNode.style.backgroundColor = options.backgroundColor ?? "#ffffff"` and the same for `color`, and inline styles beat the class rule — restyling the class alone leaves the tooltip white-on-black. Change the constructor to assign those inline styles only when the option is actually provided, so CSS owns the default. Do not add `pointer-events:none` to the disabled range input: `FollowCursorTooltip` binds `mousemove` on the input itself (L26), and the opacity slider is the one disabled control in the app.

### placeholder.css

One convention for every control the epic ships inert, defined here and consumed by the toolbar, quick-toggles, shortcuts and z-buffer tickets: `data-placeholder="true"` on the element, a `title` attribute carrying the sentence, and `aria-describedby` pointing at a visually-hidden hint node with the same text.

```css
[data-placeholder="true"] { opacity: var(--elevation-opacity-pending); }
.placeholder-hint {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
```

The control keeps its hover and active states, keeps pointer events and stays focusable — the affordance says "not wired yet", it does not disable anything. `--elevation-opacity-pending` (.55) is the only token for this; `--opacity-placeholder: .45` and `--opacity-pending: .55` from other drafts are both dead.

Do not reuse `FollowCursorTooltip` for these hints. It is typed `target: HTMLInputElement` (`src/ui/tooltip.ts` L2), so a `<button>` or a `<span>` is a type error, and `isPointerNearThumb` (L43–L59) only shows the node within 14px of a range-thumb position computed from `min`/`max`/`value` — on a chip that resolves to the element's left edge. It stays where it is, on the disabled opacity slider. Generalising it to any `HTMLElement` is out of scope for this epic.

### Hover

Every hover in the design is desktop-only (`style-hover` exists on desktop nodes; no mobile node carries one). Wrap all `:hover` rules in `@media (hover: hover)` so they do not stick after a tap. Full list to implement: secondary buttons → `--color-button-secondary-bg-hover`; primary button → `--color-accent-hover`; chips and quick toggles → `border-color: var(--color-accent)`; COPY CODE → `border-color: var(--color-state-ok)`; scene-graph row → `background: var(--color-row-hover-bg)`; range thumb → `--color-accent-hover`; scrollbar thumb → `--color-scrollbar-thumb-hover`. Anchor hover (`a:hover`, design L18) is not here — the shell ticket owns the `a` base rules.

Add `:focus-visible` outlines on every interactive class using `--color-accent`; the design has none, so mark them NEW in a comment. No `transition` on any primitive — the design declares zero.

## Mobile

Every primitive above exists in the mobile branch. Most differences are absorbed by the `@media (max-width: 899px)` token overrides from the tokens ticket (`--size-*` swap automatically), so this section lists only what needs its own media block because the layout or the type changes, not just the number.

- `.panel__header`: padding becomes `0 var(--space-4-5)` (9px); height comes from the token (26px, uniform — mobile does not distinguish sidebar from card headers). Title and note keep their desktop type (`700 var(--text-sm)` `--tracking-3xl` and `400 var(--text-sm)`).
- `.panel__body`: `var(--space-4-5)` (9px), with the asymmetric variants the design uses — `.panel__body--pad-form` = `9px 11px 12px`, `.panel__body--pad-list` = `5px 11px 9px`, `.panel__body--pad-stats` = `8px 11px 10px`, `.panel__body--pad-chart` = `10px` (the Z-BUFFER card, L1089).
- **The mobile telemetry stat card is defined here, once** (design L1067–L1082): `.panel--fill` off, `.panel__header--card` at 26px, `.panel__body--pad-stats` (`var(--space-4) var(--space-5-5) var(--space-5)`), and `.stat-row` at `height: var(--size-row-stat)` (28px) with label `500 var(--text-base)/var(--leading-none)` sans `--tracking-sm` `--color-text-tertiary` and value `500 var(--text-md)/var(--leading-none)` mono. The FRAME TIME, GEOMETRY, CAMERA and SYSTEM tickets consume exactly this and re-declare no padding, no row height and no type.
- `.info-row`: `.info-list` gap becomes `var(--space-1)` (3px); label `500 var(--text-base)/var(--leading-none)` with `--tracking-md`; value `500 var(--text-md)/var(--leading-none)`.
- `.btn--primary`: `700 var(--text-md)/var(--leading-none)` with `--tracking-md`, `min-width: var(--size-pause-minw)` (84px), `height: var(--size-button-primary)` (36px). `.btn--secondary`: padding `0 var(--space-7)` (14px), `height: var(--size-button)` (40px), type stays `500 var(--text-base)` `--tracking-md`. `.btn--block` (RESET SCENE): full width, `height: var(--size-button-reset)` (48px), `700 var(--text-md)/var(--leading-none)` `--tracking-xl`.
- `.tabs`: becomes a standalone card — `border: var(--size-hairline) solid var(--color-border-panel); border-radius: var(--radius-lg); overflow:hidden` instead of a bottom border only; tab height 44px from `--size-tab`, type `700 var(--text-base)/var(--leading-none)` `--tracking-md`; `.tabs__tab.is-active` background is `--color-tab-active-bg` (`#122152`), not `--color-panel-bg`.
- `.chip-grid`: gap becomes `var(--space-2-5)` (6px). `.chip--shape` label `500 var(--text-sm)` mono and meta `400 var(--text-sm)`, inner gap 5px; `.chip--mode`, `.chip--tex`, `.chip--view`, `.chip--proj` all move to `500 var(--text-base)` mono. No hover.
- `.toggle-row`: `border-bottom: var(--size-hairline) solid var(--color-border-row)` (`#142653`) — desktop has no divider; label `500 var(--text-md)/var(--leading-none)` `--tracking-xs` `--color-text-secondary` (lighter than desktop's tertiary). `.toggle__half` type `700 var(--text-base)/var(--leading-none)`.
- `.slider-row`: layout changes, not just size — `flex-direction: column; align-items: stretch; gap: var(--space-2); padding: var(--space-3) 0`; the label and value sit in a `.slider-row__head` (`display:flex; justify-content:space-between`) above a `width:100%` input at `var(--size-slider-input)` (26px). Label `500 var(--text-base)/var(--leading-none)` `--tracking-md` `--color-text-muted`; value `500 var(--text-md)/var(--leading-none)` `--color-text-primary`; the 44px value column is not used. World sliders use `padding: var(--space-4-5) 0 var(--space-1)` — expose as `.slider-row--tight-bottom`.
- `.stat-tile`: `padding: var(--space-2) var(--space-3)` (5px 7px), value `700 var(--text-3xl)/var(--leading-none)` (14px) with `margin-top: var(--space-1-5)`; the row becomes `display:grid; grid-template-columns: repeat(4,1fr); gap: var(--space-2-5)` with no `--wide` tile. At a 320px device the four tiles are `(300 − 18) / 4 = 70.5px` wide inside the 9px card padding, which clears the 14px mono value plus its caption.
- `.badge--info`: `padding: var(--space-3) var(--space-5)` (7px 10px), `gap: var(--space-3)`, label `500 var(--text-base)` `--tracking-md`, value `700 var(--text-md)`.
- `.hud-chip`: `background: var(--elevation-hud-bg-dense)` (`.85`) and **no** `backdrop-filter` — the denser background replaces the blur; `.hud-chip--sm` is 20px with `padding: 0 var(--space-3)`. `.hud-panel` is not used on mobile (the readout collapses to three stacked chips — the viewport ticket owns that).
- `.quick-toggle`: leaves the viewport entirely and becomes a 5-column grid row — `height: var(--size-chip-quick)` (46px), `border-radius: var(--radius-md)` (3px, not 2px), `font: 700 var(--text-base)/var(--leading-none)` mono `--tracking-chip`, no blur.
- `.divider-v--hud`: 9px, from the token.
- Touch targets: `.toggle` paints 88 × 32 and the scene-graph visibility button paints 30 × 30, both under 44px. Pad the hit area without changing the painted size — a `.tap-pad` helper (`position: relative` plus `::after { content:""; position:absolute; inset: calc(-1 * var(--tap-pad, 6px)) }`), with `--tap-pad: 6px` on the toggle, `7px` on the visibility button, `6px` on the `38 × 32` swatch and `4px` on the 36px mobile PAUSE button. Painted sizes never change — the design's 36px PAUSE and its 40px action-row and chip heights stay exactly as drawn. `.tap-pad` is defined here and only here; the toolbar, scene-graph and shape-tab tickets set the class and the custom property, never a pseudo-element of their own.

## Data

| Field | Value shown | Source today |
|---|---|---|
| `.slider-row` disabled state on the opacity slider | slate thumb, `not-allowed` cursor, no opacity fade | real — `opacitySlider.disabled` set from backface culling, `src/index.ts:646` |
| `.hoverTooltip` copy | "Turn backface culling off to adjust opacity." | real — `FollowCursorTooltip` constructed at `src/index.ts:228` |
| `.chip.is-active` | selected primitive | real — the 8 keys in `src/data/data.ts` |
| `.toggle.is-on` | wireframe, backface culling | real — `TriangleRenderOptions` flags passed to `Surface3D.render` |
| `[data-placeholder="true"]` | nothing; the `title` explains why | n/a — the affordance is defined here, applied by the consuming tickets |
| every other primitive | static skin only | n/a — this layer renders no data; widget tickets bind it |

## Files

- `src/styles/components/panel.css` — new (`.panel`, `.panel--fill`, `.panel__header`, `.panel__header--card`, `.panel__title`, `.panel__note`, `.panel__body` + variants, `.section-title`)
- `src/styles/components/rows.css` — new (`.info-list`, `.info-row`, `.stat-list`, `.stat-row`)
- `src/styles/components/button.css` — new (`.btn` + 4 variants)
- `src/styles/components/tabs.css` — new
- `src/styles/components/chip.css` — new (`.chip-grid`, `.chip` + 5 variants, `.swatch`)
- `src/styles/components/toggle.css` — new
- `src/styles/components/slider.css` — new (`.slider-row` + the `input[type="range"]` skin)
- `src/styles/components/tile.css` — new (`.stat-tile-row`, `.stat-tile`)
- `src/styles/components/badge.css` — new (`.badge`, `.pill`)
- `src/styles/components/hud.css` — new (`.hud-chip`, `.hud-panel`, `.quick-toggle`)
- `src/styles/components/divider.css` — new
- `src/styles/components/scrollbar.css` — new
- `src/styles/components/tooltip.css` — new (`.hoverTooltip` restyle)
- `src/styles/components/placeholder.css` — new (`[data-placeholder]`, `.placeholder-hint`, `.tap-pad`)
- `src/styles/main.css` — add the fourteen `@import`s directly below the token imports, above every other rule
- `src/ui/tooltip.ts` — apply `backgroundColor` / `textColor` inline only when the option is provided
- No HTML changes: markup for these classes lands with each widget ticket

## Done when

- [ ] Fourteen files exist under `src/styles/components/`, imported from `main.css` after the token imports and before any other rule
- [ ] Every declaration references a token — borders use `var(--size-hairline)` (e.g. `border: var(--size-hairline) solid var(--color-border-panel)`) — so `grep -nE '#[0-9A-Fa-f]{3,8}|[0-9]+px' src/styles/components/*.css` returns only the documented exceptions: the `899px` media literals, `margin-top:-6px` on the range thumb, the `--tap-pad` defaults, and the `1px`/`50%` clip idiom in `.placeholder-hint`
- [ ] A throwaway demo page (not committed) renders each primitive in both states and matches the mockup at 1440px: panel 4px radius with a 1px `#1E3364` border, 24px header with a yellow `.16em` 9px title, 22px `--card` header, chip active/inactive/hover, toggle in both states with all four colour slots correct, slider row at 66/flex/44
- [ ] A telemetry card built only from `.panel` + `.panel__header--card` + `.panel__body--pad-4` + `.stat-list`/`.stat-row`/`.stat-tile` matches the design's FRAMERATE and CAMERA cards without a single card-specific rule; no `telemetryCard.css` exists anywhere in the tree
- [ ] Hover rules exist only inside `@media (hover: hover)`; no `transition` and no `box-shadow` anywhere in the component layer
- [ ] Range input renders identically in Chrome and Firefox (Moz pseudo-elements present, including the disabled thumb colour)
- [ ] The opacity slider still disables when backface culling is on, shows the slate thumb and the `not-allowed` cursor with no opacity change, and the follow-cursor tooltip still appears with the console styling — no `pointer-events:none` anywhere in the new CSS
- [ ] `FollowCursorTooltip` no longer forces white-on-black inline; passing `backgroundColor`/`textColor` explicitly still overrides the CSS; its `target` type is unchanged and it is attached to nothing but the opacity slider
- [ ] `[data-placeholder="true"]` renders at `var(--elevation-opacity-pending)`, remains focusable and clickable, and its `title` text is duplicated in an `aria-describedby` target
- [ ] Mobile: at 899px the toggle is 88 × 32 inside a 48px row with a 1px `#142653` bottom border, slider rows stack label/value above a 26px full-width input, chips take their mobile heights, tab cells are 44px with the `#122152` active background, HUD chips lose the blur and gain the `.85` background, stat cards render at 8/11/10 padding with 28px rows, and both the toggle and the visibility button have a ≥ 44px hit area (verified with the devtools hit-test overlay)
- [ ] No raw hex or raw px for a tokenised value outside `src/styles/tokens/*.css`
