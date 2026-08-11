# Design tokens: split the console palette into per-type files

The rebuilt console skin is one visual language repeated across ~30 widgets, so every UI ticket that follows needs a single source of truth for colour, type, spacing and size. This ticket creates `src/styles/tokens/` with one file per token type — the same split the pfa project uses — and loads the two typefaces the design depends on. It defines only; it repaints nothing, so the branch stays visually identical until the shell ticket becomes the first consumer.

**Design source** — `3D Engine UI.dc.html` global style L14–L28, desktop L33–L671, mobile L673–L1114, state helpers L1313–L1341 and L1383–L1392.

## Desktop

### File layout and import order

Create eight files under `src/styles/tokens/`, each a single `:root` block (plus `@keyframes` in `motion.css`), and import them from `src/styles/main.css`:

```css
@import url(reset.css);
@import url(tokens/breakpoints.css);
@import url(tokens/colors.css);
@import url(tokens/typography.css);
@import url(tokens/spacing.css);
@import url(tokens/radius.css);
@import url(tokens/sizing.css);
@import url(tokens/elevation.css);
@import url(tokens/motion.css);
```

`reset.css` stays first. Reason: token files are not purely custom properties (`motion.css` carries `@keyframes recblink`, and any of them may grow element-level rules later), and the reset uses very broad selectors — keeping the order reset → tokens → components → layout means nothing a token file adds can be clobbered by the reset. All `@import` rules must remain above every other rule in `main.css`; the existing declarations stay below them.

### colors.css

37 hex literals and 12 rgba literals, each with exactly one home. `#0B1637` and `#3A4E7E` each serve several semantic roles, so they get aliases pointing at the same literal — future theming can split them without a find-and-replace. An alias is always `var(--base)`, never a second copy of the literal.

```css
:root {
  /* app + surfaces */
  --color-bg-app: #05091A;
  --color-surface-sunken: #0A1330;
  --color-panel-bg: #0B1637;
  --color-on-accent: var(--color-panel-bg);   /* foreground on yellow */
  --color-panel-header-bg: #0E1B40;
  --color-tab-active-bg: #122152;
  --color-button-secondary-bg: #152A5C;
  --color-button-secondary-bg-hover: #1D3670;
  --color-row-selected-bg: #172E62;
  --color-row-hover-bg: #142654;
  --color-chip-active-bg: #1E3B7A;
  --color-badge-info-bg: #12285C;

  /* borders */
  --color-border-panel: #1E3364;
  --color-border-subtle: #1B2E5C;
  --color-border-muted: #23386B;
  --color-border-control: #26406F;
  --color-border-row: #142653;
  --color-border-badge-info: #2A4A8F;
  --color-slate-500: #3A4E7E;            /* separator / toggle dim / chart label */
  --color-scrollbar-thumb-hover: #35538F;

  /* accent */
  --color-accent: #FFC81E;
  --color-accent-hover: #FFE07A;
  --color-accent-overlay: rgba(255,200,30,.92);
  --color-accent-overlay-border: rgba(255,200,30,.5);
  --color-accent-fade-top: rgba(255,200,30,.30);
  --color-accent-fade-bottom: rgba(255,200,30,0);

  /* text ramp, lightest to dimmest */
  --color-text-max: #FFFFFF;
  --color-text-primary: #EAF0FF;
  --color-text-button: #BFD0F5;
  --color-text-secondary: #B9C8EC;
  --color-text-tertiary: #8FA3CE;
  --color-text-hud-label: #7E93C4;
  --color-text-muted: #6F86B8;
  --color-text-dim: #5A6E9E;
  --color-text-disabled: #4E608E;
  --color-text-info: #7FA8FF;

  /* state */
  --color-state-ok: #6FE3A8;
  --color-state-ok-border: rgba(111,227,168,.45);
  --color-state-warn: #FF9E4E;
  --color-state-danger: #FF5A4E;
  --color-state-info: #5B9BFF;

  /* axis gizmo */
  --color-axis-x: var(--color-state-danger);
  --color-axis-y: var(--color-state-ok);
  --color-axis-z: var(--color-state-info);

  /* z-buffer histogram */
  --color-zbuf-near: var(--color-state-ok);
  --color-zbuf-mid: var(--color-state-info);
  --color-zbuf-far: #2C4A8A;

  /* frame-time segments */
  --color-ft-transform: var(--color-accent);
  --color-ft-clip: var(--color-state-info);
  --color-ft-raster: var(--color-state-ok);
  --color-ft-present: var(--color-slate-500);        /* bar segment + legend swatch */
  --color-ft-present-text: var(--color-text-tertiary); /* text label, see note */

  /* base colour swatch palette, in design order */
  --color-swatch-red: #E01B1B;
  --color-swatch-yellow: var(--color-accent);
  --color-swatch-green: var(--color-state-ok);
  --color-swatch-blue: var(--color-state-info);
  --color-swatch-white: var(--color-text-primary);

  /* HUD overlays */
  --color-hud-bg: rgba(5,9,26,.82);
  --color-hud-bg-dense: rgba(5,9,26,.85);
  --color-hud-bg-gizmo: rgba(5,9,26,.7);
  --color-hud-border: rgba(255,255,255,.14);
  --color-hud-border-strong: rgba(255,255,255,.16);
  --color-crosshair: rgba(255,255,255,.55);
  --color-crosshair-dim: rgba(255,255,255,.5);
}
```

Four of these literals appear only in the mobile branch — `--color-tab-active-bg` (`#122152`, the mobile tab card's active cell; the desktop active tab is simply `--color-panel-bg`), `--color-border-row` (`#142653`, the mobile toggle-row divider, which desktop does not draw), `--color-hud-bg-dense` (`.85`) and `--color-crosshair-dim` (`.5`). They are named by role, not by branch: there is no `*-mobile` token anywhere in this rebuild, because a token keeps one name and only ever changes value inside the media block. These four are separate literals with separate jobs, not per-branch copies of one value, so nothing overrides them.

Inconsistency resolved here: the PRESENT segment paints `#3A4E7E` everywhere except the mobile STATS stat-row text, which uses `#8FA3CE` (L1459). Keep both — `--color-ft-present` for the bar and legend swatch, `--color-ft-present-text` for text, because `#3A4E7E` at 11px on `#0B1637` is too dark to read.

### typography.css

```css
:root {
  --font-sans: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  --text-2xs: 7px;    /* axis gizmo letters */
  --text-xs: 8px;     /* captions, chip meta, toggle halves, build string */
  --text-sm: 9px;     /* panel + section titles, field labels, HUD */
  --text-base: 10px;  /* desktop values and buttons, mobile labels */
  --text-md: 11px;    /* mobile values, toolbar fps, desktop brand */
  --text-lg: 11.5px;  /* desktop story paragraph only */
  --text-xl: 12px;    /* mobile brand, mobile header fps */
  --text-2xl: 13px;   /* desktop fps tile value, mobile story paragraph */
  --text-3xl: 14px;   /* mobile fps tile value */
  --text-4xl: 22px;   /* desktop story title */
  --text-5xl: 26px;   /* mobile story title */

  --leading-none: 1;
  --leading-tight: 1.05;   /* story titles */
  --leading-snug: 1.2;     /* desktop slider labels, 2-line wrap in 66px */
  --leading-hud: 1.3;      /* desktop camera readout */
  --leading-relaxed: 1.55; /* story paragraphs */

  --tracking-tight: -.01em;
  --tracking-normal: .04em;
  --tracking-chip: .06em;
  --tracking-xs: .08em;
  --tracking-sm: .09em;
  --tracking-md: .1em;
  --tracking-lg: .11em;
  --tracking-xl: .12em;
  --tracking-2xl: .14em;
  --tracking-3xl: .16em;   /* panel header titles, the identity value */
}
```

`.05em`, `.07em`, `.13em` and `.15em` are unused in the design — do not add them. Root also sets `-webkit-font-smoothing: antialiased` (design L31); that lives in the shell ticket's base rules, not in a token.

### Fonts

Both families come from Google Fonts in the design (L11–L13). Load them with a `<link>` in `src/index.html` `<head>`, above the `main.css` stylesheet link:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

Decision: `<link>` in the HTML head, not `@import` in `main.css` — a CSS `@import` serialises the font request behind the stylesheet download, and the mono face is load-bearing (every number in the UI is mono; a fallback swap visibly reflows the HUD chips and the fixed-width value columns). Rejected alternative, recorded for later: self-host the six woff2 files under `src/styles/fonts/` with local `@font-face` rules. Revisit if offline dev or a zero-third-party-request deploy becomes a requirement; note that Vite has `root: "src"` and `base: "/"`, so self-hosted files must sit under `src/` to be emitted.

### spacing.css

The design's gaps and paddings form a dense 1px-step scale from 0 to 12 plus 14. No value between 14px and the fixed component sizes exists. No branch overrides: the scale is identical on both.

```css
:root {
  --space-0: 0;
  --space-px: 1px;    /* desktop shape-info column gap */
  --space-0-5: 2px;
  --space-1: 3px;
  --space-1-5: 4px;   /* desktop chip grids, scene-graph padding */
  --space-2: 5px;
  --space-2-5: 6px;   /* mobile grid gaps */
  --space-3: 7px;
  --space-4: 8px;     /* desktop page padding + every desktop grid gap */
  --space-4-5: 9px;
  --space-5: 10px;    /* mobile page padding + mobile stack gap */
  --space-5-5: 11px;
  --space-6: 12px;
  --space-7: 14px;
}
```

Composite paddings (`7px 8px`, `9px 11px 12px`, `12px 12px 14px`, …) are assembled from the scale in the component layer, not tokenised. Negative margins used for centring (`-.5px`, `-6px` on the range thumb, `-10px`, `-12px`) stay literal.

### radius.css

```css
:root {
  --radius-xs: 1px;              /* brand mark, legend swatches, range thumb */
  --radius-sm: 2px;              /* the default: chips, toggles, rows, bars */
  --radius-md: 3px;              /* buttons, toolbar HUD chips */
  --radius-lg: 4px;              /* panels, cards, toolbar, status bar */
  --radius-full: 50%;            /* REC dot */
  --radius-bar-top: 1px 1px 0 0; /* z-buffer bars */
}
```

### sizing.css

Desktop values are the defaults; mobile overrides live in the `@media` block described in the Mobile section below.

```css
:root {
  /* shells */
  --size-page-pad: 8px;
  --size-stack-gap: 8px;
  --size-sidebar-w: 264px;
  --size-inspector-w: 296px;
  --size-viewport-h: 530px;
  --size-toolbar-h: 40px;
  --size-statusbar-h: 24px;

  /* panels */
  --size-panel-header: 24px;       /* sidebar panels */
  --size-panel-header-card: 22px;  /* telemetry cards */

  /* controls */
  --size-button: 26px;
  --size-button-primary: 26px;
  --size-button-reset: 26px;
  --size-tab: 26px;
  --size-chip-shape: 44px;
  --size-chip-mode: 26px;
  --size-chip-tex: 24px;
  --size-chip-view: 24px;
  --size-chip-proj: 24px;
  --size-chip-quick: 24px;
  --size-hud-chip: 22px;
  --size-hud-chip-sm: 22px;
  --size-toggle-w: 62px;
  --size-toggle-h: 19px;
  --size-toggle-row: 26px;
  --size-slider-input: 15px;
  --size-slider-label-col: 66px;
  --size-slider-value-col: 44px;
  --size-row-info: 19px;
  --size-row-scene: 26px;
  --size-row-stat: auto;
  --size-scene-kind-col: 26px;
  --size-vis-button: 14px;
  --size-swatch-w: 22px;
  --size-swatch-h: 18px;

  /* chrome + charts */
  --size-brand-mark: 16px;
  --size-rec-dot: 6px;
  --size-legend-swatch: 7px;
  --size-ft-bar: 12px;
  --size-budget-bar: 6px;
  --size-fps-canvas: auto;   /* flex:1 inside the card on desktop */
  --size-zbuf-h: auto;       /* flex:1 inside the card on desktop */
  --size-gizmo: 66px;
  --size-gizmo-axis-xy: 34px;
  --size-gizmo-axis-z: 24px;
  --size-crosshair: 24px;
  --size-selection-box: 190px;
  --size-selection-corner: 14px;
  --size-selection-label-h: 16px;
  --size-camera-readout-minw: 148px;
  --size-tooltip-max-w: 220px;   /* NEW — no design equivalent, carried over from main.css L330 */

  /* dividers + primitives */
  --size-divider-toolbar: 20px;
  --size-divider-status: 11px;
  --size-divider-hud: 10px;
  --size-scrollbar: 8px;
  --size-range-track: 3px;
  --size-range-thumb-w: 9px;
  --size-range-thumb-h: 15px;
  --size-story-rule-w: 28px;
  --size-story-rule-h: 2px;
  --size-hairline: 1px;      /* every 1px border in the rebuild */
  --size-mark: 2px;          /* tab underline, row mark, swatch border */

  /* mobile-only shells: no desktop counterpart, so nothing overrides them */
  --size-appbar-h: 52px;
  --size-actionrow-h: 40px;
  --size-appbar-fps-chip: 30px;
  --size-pause-minw: 84px;
}
```

Do not tokenise the design's `1440px × 900px` frame (L34). That is a design-tool canvas, not a layout: the rebuild is fluid above 900px with the two sidebars fixed at `--size-sidebar-w` / `--size-inspector-w` and the centre column flexing; the shell ticket may cap it with a one-off `max-width: 1440px` literal. The viewport itself cannot flex either way — the canvas is hard-coded `1024 × 640` in `src/index.html` L57 and that size is baked into `BackgroundRenderer` and `ShapeTransitionMachine` at construction, so `--size-viewport-h: 530px` describes the design's frame and the real canvas box is handled by the viewport ticket.

### elevation.css

The design has zero `box-shadow` and zero `transition` declarations. Depth is expressed only as background steps (`#05091A` → `#0A1330` → `#0B1637` → `#0E1B40` → `#152A5C`) plus a 1px border. Do not add shadows anywhere in this rebuild.

```css
:root {
  --blur-hud: blur(3px);                              /* the only blur in the design */
  --elevation-hud-bg: var(--color-hud-bg);
  --elevation-hud-bg-dense: var(--color-hud-bg-dense);
  --elevation-hud-bg-gizmo: var(--color-hud-bg-gizmo);
  --elevation-hud-border: var(--color-hud-border);
  --elevation-opacity-pending: .55;                   /* NEW — placeholder affordance, not extracted */
  --layer-sticky: 6;                                  /* mobile sticky header, design L676 */
}
```

The blur is applied on desktop HUD chips only. Mobile compensates with a denser background (`--color-hud-bg-dense`, `.85` vs `.82` alpha) and no blur — preserve that asymmetry, it is deliberate.

`--elevation-opacity-pending` is the one token for every inert control in the epic. The primitives ticket defines the affordance that consumes it (`data-placeholder="true"` + `title` + `aria-describedby`); the toolbar, quick-toggles, shortcuts and z-buffer tickets consume it and must not invent `--opacity-placeholder` or `--opacity-pending`.

### motion.css

```css
:root {
  --duration-blink: 1.6s;
  --opacity-blink-min: .15;

  /* NEW — not extracted from the design, which declares no transitions or easings.
     Use only if a later ticket adds hover/tab animation. */
  --duration-fast: 120ms;
  --ease-standard: cubic-bezier(.2,0,0,1);
}

@keyframes recblink {
  0%, 45% { opacity: 1 }
  55%, 100% { opacity: var(--opacity-blink-min) }
}
```

Keep the 45/55 stops exactly — the near-square wave is what makes the dot read as a hardware LED rather than a pulse.

### breakpoints.css

```css
:root {
  /* Documentation + JS only. A media query condition cannot read a custom
     property, so the literals are repeated in every @media block.
     The breakpoint is exclusive at 900: desktop is min-width: 900px,
     mobile is max-width: 899px. Never max-width: 900px. */
  --breakpoint-md: 900px;
}
```

This mirrors the design's own test, `const n = window.innerWidth < 900` (L1207). At exactly 900px the app is desktop, in the shell layout and in every token value.

### fps chart constants

The framerate chart draws with canvas 2D (`drawFps`, design L1258–L1301) and cannot read custom properties. Create `src/ui/chartTokens.ts` — that exact path, importable as `@ui/chartTokens` through the alias already in `vite.config.js`. It sits directly under `src/ui/`, not under `src/ui/telemetry/` — that directory is for the telemetry widget classes and must not hold a second copy of these constants. It exports one frozen object with the five colours and the font string, with a header comment pointing at `colors.css` so the pair is maintained together: `#0A1330` fill, `#1B2E5C` gridline, `#3A4E7E` axis label, `#FFC81E` line and last-sample dot, gradient `rgba(255,200,30,.30)` → `rgba(255,200,30,0)`, font `500 8px 'JetBrains Mono', monospace`. Decision: a hand-mirrored TS constant rather than `getComputedStyle(document.documentElement)` — no per-frame layout read, and it works before the stylesheet resolves.

### Superseding the current palette

`src/styles/main.css` today is a different design: `body { background:#ccc; color:#10afff; font-family:Arial, serif }`, `#ffef93` labels, `#a7d2ff` canvas wrapper, `rgba(173,220,255,.95)` badges, `Futura, "Century Gothic", sans-serif` on every control, plus four `box-shadow` blocks (L21–L23, L36–L38, L305–L307, L338). None of those values enters a token file. This ticket does not delete them — deleting them before the shell and widget tickets land would leave the app unstyled. Instead:

- add the eight imports and the font `<link>`;
- add a `/* LEGACY — superseded by the UI rebuild; the shell ticket owns the teardown */` banner above the first legacy rule in `main.css`;
- change nothing else, so this ticket has a zero-pixel visual diff.

From this ticket onward, no other ticket may introduce a raw hex or a raw px for a value that has a token. Raw values remain legal only inside `src/styles/tokens/*.css`, inside `src/ui/chartTokens.ts`, for the `899px` / `900px` media-query literals, and for one-off geometry the design itself uses inline (percentage anchors, negative centring offsets, flex ratios).

### Renames other tickets must apply

Every name below was invented by a draft and resolves to nothing. Use the right-hand side:

- `--size-frame-w` → not a token; use the literal `1440px`
- `--size-divider-v` → `--size-divider-toolbar` / `--size-divider-status` / `--size-divider-hud`
- `--size-border-mark`, `--border-2` → `--size-mark`
- `--size-selection-label` → `--size-selection-label-h`
- `--size-slider-track-row` → `--size-slider-input`
- `--size-panel-header-telemetry` → `--size-panel-header-card`
- `--size-panel-header-mobile` → `--size-panel-header` (26px via the media block)
- `--size-fps-chart-mobile` → `--size-fps-canvas` (64px via the media block)
- `--size-ft-bar-mobile` → `--size-ft-bar` (14px via the media block)
- `--size-stat-row-mobile` → `--size-row-stat` (28px via the media block)
- `--size-zbuf-mobile` → `--size-zbuf-h` (76px via the media block)
- `--size-bar-min` → not a token; the 2px histogram bar minimum stays a literal
- `--opacity-placeholder`, `--opacity-pending` → `--elevation-opacity-pending`
- `--color-hud-bg-mobile` → `--color-hud-bg-dense`; `--elevation-hud-bg-mobile` → `--elevation-hud-bg-dense`
- `--color-tab-active-bg-mobile` → `--color-tab-active-bg`
- `--color-border-row-mobile` → `--color-border-row`
- `--color-crosshair-mobile` → `--color-crosshair-dim`
- every `1px` border → `var(--size-hairline)`

### Docs note

Add a `## Styles` section to the repo README, matching how pfa documents its split: the one-file-per-token-type rule, the import order and why `reset.css` is first, the naming prefixes (`--color-*`, `--font-*` / `--text-*` / `--tracking-*` / `--leading-*`, `--space-*`, `--radius-*`, `--size-*`, `--elevation-*` / `--blur-*`, `--layer-*`, `--opacity-*`, `--breakpoint-*`, `--duration-*` / `--ease-*`), the no-`*-mobile`-names rule with the exclusive 900 breakpoint, the rule that new values are added to a token file rather than inline, and the two known duplications (the `899px` / `900px` literals, and `chartTokens.ts` mirroring five colours). Each token file also opens with a two-line comment stating what it owns and what it must not own.

## Mobile

A token layer's entire mobile surface is one override block — that is the point of the split, and it is the whole of this section. Only `sizing.css` carries a `@media` block; colours, type, spacing, radii, elevation and motion are identical on both branches, and no token is redefined per branch anywhere else.

`sizing.css` ends with:

```css
/* Exclusive at 900: desktop is min-width:900px, mobile is max-width:899px.
   The literal is repeated because a media query cannot read --breakpoint-md. */
@media (max-width: 899px) {
  :root {
    --size-page-pad: 10px;
    --size-stack-gap: 10px;
    --size-panel-header: 26px;
    --size-panel-header-card: 26px;
    --size-button: 40px;
    --size-button-primary: 36px;
    --size-button-reset: 48px;
    --size-tab: 44px;
    --size-chip-shape: 56px;
    --size-chip-mode: 44px;
    --size-chip-tex: 40px;
    --size-chip-view: 40px;
    --size-chip-proj: 40px;
    --size-chip-quick: 46px;
    --size-hud-chip-sm: 20px;
    --size-toggle-w: 88px;
    --size-toggle-h: 32px;
    --size-toggle-row: 48px;
    --size-slider-input: 26px;
    --size-slider-label-col: 46px;
    --size-row-info: 24px;
    --size-row-scene: 44px;
    --size-row-stat: 28px;
    --size-scene-kind-col: 28px;
    --size-vis-button: 30px;
    --size-swatch-w: 38px;
    --size-swatch-h: 32px;
    --size-brand-mark: 18px;
    --size-ft-bar: 14px;
    --size-budget-bar: 8px;
    --size-fps-canvas: 64px;
    --size-zbuf-h: 76px;
    --size-gizmo: 52px;
    --size-gizmo-axis-xy: 26px;
    --size-gizmo-axis-z: 18px;
    --size-crosshair: 20px;
    --size-divider-hud: 9px;
  }
}
```

`--size-slider-value-col` has no mobile value: the mobile slider stacks its label/value row above a full-width input, so the fixed value column disappears rather than resizing. That layout change is specified in the primitives ticket, not here.

Several mobile controls fall under the 44px touch target: the 36px PAUSE button (L688), the 40px action-row buttons (L692–L696), the 40px material / view / projection chips (L907, L1014, L1018), the `88 × 32` ON/OFF toggle and the `30 × 30` visibility button. Their painted sizes are correct as tokenised — the design is the reference, not the guideline. Hit-area padding is a component concern: the primitives ticket pads the toggle and the visibility button, the two worst offenders.

## Data

This ticket binds nothing and renders nothing. Its only TypeScript artefact, `src/ui/chartTokens.ts`, is a frozen constant hand-mirrored from `colors.css` and read by the framerate ticket; it holds no runtime state.

## Files

- `src/styles/tokens/breakpoints.css` — new
- `src/styles/tokens/colors.css` — new
- `src/styles/tokens/typography.css` — new
- `src/styles/tokens/spacing.css` — new
- `src/styles/tokens/radius.css` — new
- `src/styles/tokens/sizing.css` — new (only file with a `@media` block)
- `src/styles/tokens/elevation.css` — new
- `src/styles/tokens/motion.css` — new (holds `@keyframes recblink`)
- `src/ui/chartTokens.ts` — new
- `src/styles/main.css` — add the eight imports below the existing `reset.css` import; add the LEGACY banner
- `src/index.html` — add the two preconnects and the Google Fonts stylesheet link
- `README.md` — add the `## Styles` section

## Done when

- [ ] `src/styles/tokens/` contains exactly the eight files, each a `:root` block opening with a two-line ownership comment
- [ ] All 37 hex and 12 rgba literals from the design exist in `colors.css`, each declared exactly once; aliases (`--color-on-accent`, `--color-axis-*`, `--color-zbuf-*`, `--color-ft-*`, `--color-swatch-*`) reference the base token with `var()` rather than repeating the literal
- [ ] `grep -o '#[0-9A-Fa-f]\{6\}' src/styles/tokens/*.css | sort -u` returns 37 lines from `colors.css` and nothing from the other seven files
- [ ] No token name contains `mobile`; `grep -rn -- '-mobile' src/styles/tokens/` is empty
- [ ] `typography.css` has 11 `--text-*`, 5 `--leading-*`, 10 `--tracking-*`, 3 weights and 2 families; the unused `.05/.07/.13/.15em` steps are absent
- [ ] `motion.css` reproduces `recblink` with the 0/45/55/100 stops unchanged
- [ ] `elevation.css` contains no `box-shadow`; `blur(3px)` appears once; `--elevation-opacity-pending` and `--layer-sticky` are declared there and nowhere else
- [ ] `main.css` imports resolve in order with `reset.css` first, and every `@import` sits above all other rules
- [ ] Both font families render in `npm run dev` (inspect a mono value: computed family is JetBrains Mono, not the monospace fallback)
- [ ] `src/ui/chartTokens.ts` exists at that path and resolves through the `@ui` alias; no copy of it is created under `src/ui/telemetry/` (that directory belongs to the telemetry widget classes, not to tokens)
- [ ] Mobile: at 899px wide, `getComputedStyle(document.documentElement).getPropertyValue('--size-toggle-h')` is `32px` and `--size-page-pad` is `10px`; at 900px they are `19px` and `8px`. No media query in the repo uses `max-width: 900px`
- [ ] The app looks pixel-identical to `master` after this ticket — tokens are defined, nothing is consumed yet
- [ ] No raw hex or raw px for a tokenised value outside `src/styles/tokens/*.css` and `src/ui/chartTokens.ts` (the `899px` media literal and `chartTokens.ts` are the two documented duplications)
- [ ] README `## Styles` section documents the split, the import order, the prefixes including `--layer-*` and `--opacity-*`, the no-`*-mobile` rule and both duplications
