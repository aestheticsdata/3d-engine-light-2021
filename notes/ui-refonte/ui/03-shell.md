# App shell, legacy teardown and shared state layer

Replace the current `#wrapper` / two-`aside` markup with the redesign's shell: a flex column of toolbar, main row and status bar on desktop, and a single stacked column with a sticky header and a 5-tab switcher on mobile. Beyond the skeleton, this ticket owns the demolition — the base rules, the legacy `main.css` blocks and `<aside id="controls">` — and the shared state layer every widget ticket imports. It ships no visual recipes: the panel card, its header strip, buttons, tabs, chips, toggles, sliders and dividers all come from the primitives ticket (`src/styles/components/`), which lands first. Every widget that fills a slot is a separate ticket.

**Design source** — `3D Engine UI.dc.html` base styles L15–L18 and L31, desktop L33–L671, mobile L673–L1114.

## Desktop

Root `#app`: `display:flex; flex-direction:column; gap:var(--size-stack-gap)`, `padding:var(--size-page-pad)`, `background:var(--color-bg-app)`. Both tokens change value inside the media block, so the shell never restates 8px vs 10px.

**Deviation from the mockup, decided here:** the design frame is a fixed `1440px × 900px` box (L34). The rebuild makes desktop fluid — `width:100%; min-height:100vh`, optional `max-width: 1440px` centred (a one-off layout literal; the tokens ticket deliberately does not tokenise the design's 1440 × 900 frame). The two sidebars keep fixed flex bases, the centre column flexes, and the viewport card keeps its fixed 530px height. The design's HUD literally reads `848 × 530` (L179), which is the centre column at exactly the 1440px frame width.

Children of `#app`, in order:

1. **Toolbar row** (L36) — `flex:0 0 var(--size-toolbar-h)` (40px), `display:flex; align-items:stretch; gap:var(--size-stack-gap)`. Two `.panel` boxes: brand block (L37) `flex:0 0 var(--size-sidebar-w)` (264px), `gap:var(--space-4-5)` (9px), `padding:0 var(--space-5)`; action strip (L45) `flex:1`, `gap:var(--space-2-5)` (6px), `padding:0 var(--space-4)`. Contents belong to the toolbar ticket.
2. **Main row** (L75) — `flex:1; display:flex; gap:var(--size-stack-gap); min-height:0`.
   - Left column (L77) — `flex:0 0 var(--size-sidebar-w)`, column, `gap:var(--size-stack-gap)`, `min-height:0`. Slots: SCENE GRAPH (`flex:0 0 auto`), SHAPE INFO (`flex:0 0 auto`), SHAPE STORY (`.panel--fill`, own `overflow:auto` body at L140).
   - Centre column (L164) — `flex:1`, column, `gap:var(--size-stack-gap)`, `min-width:0`. Slots: viewport card (L166) `flex:0 0 var(--size-viewport-h)` (530px), `position:relative`, `background:var(--color-surface-sunken)`, `overflow:hidden`; telemetry area (L256) `flex:1`, column, `gap:var(--size-stack-gap)`, `min-height:0`.
   - Telemetry row 1 (L257) — `flex:1; display:flex; gap:var(--size-stack-gap); min-height:0`; FRAMERATE `flex:1.15`, FRAME TIME `flex:1`, GEOMETRY `flex:1`.
   - Telemetry row 2 (L368) — same flex recipe; Z-BUFFER HISTOGRAM `flex:1.15`, CAMERA `flex:1`, SYSTEM `flex:1`. The design gates this row behind its `statsFull` preview prop (L367); the rebuild drops the prop and always renders the row — see Data.
   - Right panel (L450) — `flex:0 0 var(--size-inspector-w)` (296px), `.panel`, column, `min-height:0; overflow:hidden`. Tab strip (L451) is `.tabs` (primitives) with three equal `.tabs__tab`. Body (L457) `flex:1; overflow:auto; padding:var(--space-4); display:flex; flex-direction:column; gap:var(--space-4-5)` (9px). SHORTCUTS footer (L640) `margin-top:auto; gap:var(--space-2); padding-top:var(--space-4-5); border-top:var(--size-hairline) solid var(--color-border-panel)` — desktop only.
3. **Status bar** (L657) — `flex:0 0 var(--size-statusbar-h)` (24px). Own ticket.

Every card above is `.panel` / `.panel__header` / `.panel__title` / `.panel__note` from `src/styles/components/panel.css`. This ticket declares no surface, border, radius, header strip, title or note rule anywhere — only flex boxes, the `display:contents` + `order` map and the media block.

## Mobile

Root below 900px (L674): `width:100%; min-height:100vh; padding:var(--size-page-pad)` (10px via the media block), column, `gap:var(--size-stack-gap)` (10px), `background:var(--color-bg-app)`.

Stack order, top to bottom:

| order | Item | Spec |
|---|---|---|
| 0 | Sticky header (L676) | `position:sticky; top:0; z-index:var(--layer-sticky)` (6), `height:var(--size-appbar-h)` (52px), `padding:0 var(--space-5)`, `gap:var(--space-4-5)`, `.panel` |
| 1 | Action scroller (L691) | `display:flex; gap:var(--space-2-5); overflow-x:auto; padding-bottom:var(--space-0-5)` (2px); children are `.btn--secondary`, `flex:0 0 auto`, height from `--size-button` (40px on mobile) |
| 2 | Viewport card (L699) | `width:100%; aspect-ratio:16/10`, `background:var(--color-surface-sunken)`, `.panel` border + radius, `position:relative; overflow:hidden` |
| 3 | Quick-toggle grid (L740) | `display:grid; grid-template-columns:repeat(5,1fr); gap:var(--space-2-5)`; cells `--size-chip-quick` (46px on mobile) |
| 4 | FRAMERATE card (L746) | `.panel`, header height from `--size-panel-header` (26px on mobile) |
| 5 | Tab bar (L774) | `display:flex`, `background:var(--color-panel-header-bg)`, `.panel` border + radius, `overflow:hidden`; five tabs `flex:1`, height `--size-tab` (44px on mobile) |
| 6 | Active tab panel | `display:flex; flex-direction:column; gap:var(--size-stack-gap)`; all five tab panels share this order value since only one is displayed |
| 7 | Status strip (L1104) | own ticket |
| 8 | RESET SCENE (L1112) | `height:var(--size-button-reset)` (48px on mobile), `.btn--secondary` with `font:var(--font-weight-bold) var(--text-md)/var(--leading-none) var(--font-sans)`, `letter-spacing:var(--tracking-xl)` — mobile only; desktop RESET lives in the toolbar. Both run the toolbar ticket's single reset path |

The sticky header's `--layer-sticky` (6) is the only z-index in the mobile stack. No widget may introduce a competing one; the viewport HUD stacks inside its own `position:relative` card and must stay below 6.

Tab-to-content mapping:

| Mobile tab | Cards | Desktop home |
|---|---|---|
| SCENE (L780) | SCENE GRAPH, SHAPE INFO, SHAPE STORY, then GESTURES last | left column; GESTURES is mobile-only, from the shortcuts ticket |
| SHAPE (L867) | PRIMITIVE, TRANSFORM, MATERIAL | right panel, SHAPE tab (L459) |
| RENDER (L930) | SHADING MODE, PIPELINE, LIGHTING | right panel, RENDER tab (L536) |
| WORLD (L979) | ENVIRONMENT, then CAMERA | right panel, WORLD tab (L588) — note the desktop order is CAMERA (L591) then ENVIRONMENT (L616); mobile reverses it (L983 / L1009). Keep each branch's own order |
| STATS (L1035) | BUDGETS (FRAME TIME + POLY BUDGET bars, L1037–L1065), the four stat-group cards (FRAME TIME, GEOMETRY, CAMERA, SYSTEM, L1067–L1082), Z-BUFFER | centre column telemetry area |

The desktop SHORTCUTS block has no mobile counterpart in the design; keep it desktop-only (`display:none` below 900px) rather than inventing a mobile home for it, since the keyboard shortcuts it lists are not reachable on touch. The mobile equivalent is the GESTURES card, owned by the shortcuts ticket.

## Base rules and legacy teardown

`src/styles/main.css` L3–L9 (`body { background:#ccc; font-family:Arial; font-size:12px; color:#10afff; overflow-x:auto }`) is deleted and replaced in place, directly below the token imports, by the design's base rules (L15–L18, L31):

```css
html, body { margin: 0; padding: 0; background: var(--color-bg-app); }
* { box-sizing: border-box; }
body {
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--color-accent); text-decoration: none; }
a:hover { color: var(--color-accent-hover); }
```

Every legacy rule the new console supersedes is deleted here, named explicitly so no widget ticket has to guess: `body`, `#wrapper`, `#canvasWrapper`, `canvas`, `.sidePanel`, `.panelContent`, `#controls` (L98–L100), `.controlsHeader`, `button` and `button:hover`, `#selectButton` and `#selectButton select`, `.fpsRow`, `.statsBadge` / `.statsBadgeRight`, `.statsLabel`, `.statsValue`, `.toggleRow` / `.toggleRowOff`, `.toggleLabel` / `.toggleLabelMuted`, `#toggleWireframe`, `#toggleBackfaceCulling`, `.sliderGroup`, `.sliderRow`, `.sliderText`, `input[type="range"]` and its `:active` / `:disabled` variants, `#resetControls` and `#resetControls:hover`, and the whole `@media (max-width: 1360px)` block. Widget tickets delete only the rules unique to their own widget (`.panelTitle`/`.panelSubTitle`, `.infoRow`/`.infoLabel`/`.infoValue`, `.panelSection`, `.storyTitle`/`.storyText`/`.storyBadgeRow`/`.storyLinks`/`.storyLink`, the panel fade keyframes, `.hoverTooltip`).

`<aside id="controls">` is removed from `src/index.html` in full, including `.controlsHeader`, `.fpsRow` and `.sliderGroup`. Its live controls are not deleted — they move into the slots their widget tickets will finally own, as bare unstyled elements: play/pause and reset into the toolbar action strip, the `#primitives` select and the six range inputs into the inspector SHAPE tab body, the wireframe and backface-culling toggles into the RENDER tab body.

Accepted consequence: between this ticket and the last widget ticket those elements are functional but unstyled, because the legacy `button` and `input[type="range"]` rules are gone and the primitives classes are not applied to them yet. That is the intended intermediate state — this ticket is the demolition, not a restyle of the old controls.

## Element-id contract

`Main`'s constructor resolves 22 element ids (`src/index.ts` L130–L151) and throws `"UI controls are missing."` if any is absent (guard L152–L177): 21 presence checks plus `#opacitySlider`, which must additionally be an `HTMLInputElement`. Since this ticket replaces `src/index.html` wholesale, the skeleton must re-provide every one of them, even where the widget that will finally own the element has not landed yet:

`fpsCounterNb`, `trianglesRenderedNb`, `playPause`, `shapeInfoPanelContent`, `shapeInfoName`, `shapeInfoPoints`, `shapeInfoTriangles`, `shapeInfoTextures`, `shapeInfoOpacity`, `shapeStoryTitle`, `shapeStoryDescription`, `shapeStoryFeature`, `shapeStoryDensity`, `shapeStoryReferences`, `toggleWireframe`, `wireframeRow`, `wireframeLabel`, `toggleBackfaceCulling`, `backfaceCullingRow`, `backfaceCullingLabel`, `resetControls`, `opacitySlider`.

Two of those leave the contract in this ticket. `#fpsCounterNb` and `#trianglesRenderedNb` are migrated once here rather than three times across the toolbar, framerate and geometry tickets: drop both `getElementById` lookups and both guard clauses from the constructor, and route the three write sites — `fpsCounter()` (L379–L380), `renderPausedFrame()` (L517) and `stop()` (L582–L583) — through `fields.write('fps', …)` and `fields.write('trisDrawn', …)`. The skeleton carries `[data-field="fps"]` and `[data-field="trisDrawn"]` nodes instead, and the id contract drops to 20.

Five further ids are not guarded but are behaviour-load-bearing and must also be re-provided: `#primitives` (without it `PrimitivePicker.populate` returns early and shape switching dies, `src/ui/PrimitivePicker.ts:36,45`) and `#zoomSlider`, `#pitchSlider`, `#yawSlider`, `#rollSlider`, `#rotationSpeedSlider` (`SliderBank.attach` skips any selector it cannot resolve, `src/ui/SliderBank.ts:67`, so the sliders would become no-ops without a thrown error). `#opacitySlider` is reached the same way but is already in the guarded set above.

Acceptance criterion, stated explicitly because nothing downstream re-checks it: **the branch must boot and stay fully functional after this ticket alone.**

## Shared state layer

Four new engine-agnostic modules under `src/ui/`, shipped here so no widget ticket invents a fourth mechanism:

- **`FieldWriter.ts`** — `write(name, value)` on an injected instance (**not** an ambient `FieldWriter.write`) writes to **every** `[data-field="<name>"]` node. This is how a value that appears in two branch-specific nodes (`camPos`, `frameMs`, `fov`, `zoom`, `selectedId`, `drawnLabel`, `fps`, `trisDrawn`, `uptime`) stays in sync without any caller reading the breakpoint.
- **`UIStateStore.ts`** — the store class, with `getState()`, `setState(patch)`, `registerSlice(slice)`, `resetAll()` and `subscribe(listener)`, shipped empty here. **`Main` constructs the one instance and injects it**; there is no module-scope singleton and nothing imports an ambient store, so a panel registers its slice from its own constructor (`this.store.registerSlice({…})`) rather than at import time. Every value with no engine home yet lives in one slice per owning ticket (shading mode, texture, base colour, UV scale, scale, the four lighting values, fog, grid step, projection, sky / floor / grid / shadow, dropped frames). Quick-toggles and scene-graph subscribe rather than owning private stores. Contract to state in the module header: a slice is only complete when the toolbar's RESET path restores it.
- **`TabGroup.ts`** — `new TabGroup({ tablist, root, attribute, initial, onChange? })`. Each tab button carries `data-tab-id`; the module writes `attribute` (`data-tab` or `data-mtab`) on `root` and sets `aria-selected` and a roving `tabindex`. It sets no inline styles — CSS reacts to the root attribute. Two instances: the desktop strip with `shape|render|world`, initial `shape` (design L1174), and the mobile bar with `scene|shape|render|world|stats`, initial `shape` (design L1181). Accessibility: `role="tablist"` / `role="tab"` / `role="tabpanel"`, `aria-controls`, ArrowLeft/ArrowRight move selection, Home/End jump to ends.
- **`sceneObjectId.ts`** — stays a plain exported arrow, not a class (oop-refonte D1b). `sceneObjectId(key)` = `key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase() + "_01"`, so `torusKnot` → `TORUS_KNOT_01`. The viewport HUD, scene graph and status bar all import it; none of them may re-derive the string.

## Branch switch: recommended approach

The design resolves the branch in JS — `narrow = window.innerWidth < 900` (L1207) — and renders one of two complete trees (L33 / L673).

**Do not port that.** Build **one DOM tree plus CSS media queries**, because:

- This is vanilla TS with no framework and no VDOM. Two trees means two sets of element ids, two sets of `addEventListener` calls and two binding paths for every widget, all torn down and rebuilt when the window crosses the breakpoint.
- The engine canvas can exist only once. A second tree would force either moving the canvas node between trees on resize (losing the 2D context state) or a second context — neither is acceptable.
- Every widget ticket would have to ship two templates instead of one stylesheet with a media query.

Mechanism:

- The breakpoint is exclusive at 900: desktop is the unqualified default, mobile is `@media (max-width: 899px)`, matching the design's `< 900` test and the tokens ticket's own override block. Never `max-width: 900px` — at exactly 900px that would lay out as mobile while every `--size-*` token is still at its desktop value.
- `#app` is the flex column. Below 899px, `.appMain`, `.colLeft`, `.colCenter`, `.colRight` and the telemetry wrapper get `display:contents`, so their children become direct flex items of `#app` and can be positioned with the `order` values in the mobile table. Items sharing an `order` value keep DOM order.
- The root carries `data-tab` (desktop: `shape|render|world`) and `data-mtab` (mobile: `scene|shape|render|world|stats`). Panel visibility is pure CSS attribute selectors — no JS runs at the breakpoint, and the two tab states stay independent exactly as the design keeps `state.tab` and `state.mtab` separate (L1174 / L1181).
- The handful of genuinely branch-specific nodes exist once in the DOM and are hidden with `display:none` at the breakpoint: the desktop 4-row camera readout (L192) vs the mobile 3-chip stack (L704), the desktop bottom-centre HUD chip (L245, absent on mobile), the desktop tab strip vs the mobile tab bar, the desktop toolbar action group vs the mobile action scroller, the mobile RESET SCENE bar, the desktop SHORTCUTS block.
- The literal `899px` is repeated in each `@media` block with a comment pointing at `--breakpoint-md`, since a media condition cannot read a custom property.

## Canvas constraint (hard)

`src/index.html` hard-codes `<canvas id="canvasID" width="1024" height="640">`. `src/index.ts` derives `centerX`/`centerY` from `this.stage.canvas.width/height` once in the constructor and passes the same numbers into `ShapeTransitionMachine` at construction; `boot()` passes `canvas.width` / `canvas.height` into `BackgroundRenderer` at construction; `Point3D` caches its viewport halves per point. None of them recomputes on resize — the sky gradient, sky bitmap, atmosphere, checker floor and vignette are all laid out against the captured size.

So **this ticket ships the CSS box only**. The canvas keeps its 1024×640 intrinsic buffer and is fitted inside the viewport card with `display:block; width:100%; height:100%; object-fit:contain`. Both branches are 1.6 ratio boxes (desktop 848 × 530 at the design width, mobile `aspect-ratio:16/10`) and 1024/640 is also 1.6, so the fit is exact at the design width and letterboxes cleanly elsewhere. The HUD's resolution chip therefore reports the canvas **buffer** size (1024 × 640), not the CSS box.

Follow-up, de-mock ticket E9 "Resizable render target", not this ticket: give `BackgroundRenderer` and `ShapeTransitionMachine` a `resize(width, height)`, recompute `centerX`/`centerY`/focal in `Main`, and drive `canvas.width/height` from a `ResizeObserver` on the viewport card multiplied by `devicePixelRatio`.

## Data

| Field | Value shown | Source today |
|---|---|---|
| Desktop active tab | one of SHAPE / RENDER / WORLD | real: `data-tab` on `#app`, owned by `createTabGroup`, initial `shape` |
| Mobile active tab | one of SCENE / SHAPE / RENDER / WORLD / STATS | real: `data-mtab` on `#app`, initial `shape` |
| Telemetry density | both telemetry rows always render | the design's `statsMode` (`full` / `compact`, L1119 / L1397) is a Claude Design preview prop with no production surface. **Dropped.** No `data-stats` attribute, no control, no ticket owns it |
| HUD overlays | always on | the design's `hudOverlays` prop (L1119) is the same kind of preview control. **Dropped** — the viewport HUD is unconditional |
| Viewport resolution | `1024 × 640` | real: `canvas.width` / `canvas.height`; the design's literal `848 × 530` (L179) is the design frame's CSS box and does not apply |
| Shape story card | always rendered | real: `src/data/shapeInfo.ts` has an entry per primitive; the design's `showShapeStory` prop (L1398) has no engine equivalent and is dropped |

## Files

- `src/index.html` — replaced markup: `#app` skeleton, the toolbar/main/status/reset containers, the column wrappers, both tab strips, empty widget slots with stable ids, all 20 remaining contract ids plus `#primitives` and the six range inputs. `<aside id="controls">` removed. Canvas keeps `width="1024" height="640"`.
- `src/styles/layout.css` — new: shell flex boxes, the `display:contents` + `order` map, the single `@media (max-width: 899px)` block, the canvas fit rule. No panel recipe.
- `src/styles/main.css` — the base rules above replace L3–L9 in place; import order `reset.css` → `tokens/*.css` → `components/*.css` → `layout.css`; delete every legacy rule listed in the teardown section, including the `@media (max-width: 1360px)` block.
- `src/ui/FieldWriter.ts`, `src/ui/UIStateStore.ts`, `src/ui/TabGroup.ts`, `src/ui/sceneObjectId.ts` — new.
- `src/index.ts` — update DOM lookups for moved nodes, drop the `#fpsCounterNb` / `#trianglesRenderedNb` lookups and guard clauses, route those three write sites through `FieldWriter.write`, instantiate the two tab groups. `document.querySelector("canvas")` in `boot()` is unchanged.

## Done when

- [ ] The branch boots after this ticket alone: `npm run dev` throws no `"UI controls are missing."`, the canvas renders, and pause, wireframe, backface culling, reset, the primitive select and all six sliders still work.
- [ ] At >= 900px the shell renders as toolbar (40px) / main row / status bar (24px) with 8px page padding and 8px gaps; sidebars are 264px and 296px, the centre column flexes, the viewport card is 530px tall.
- [ ] At <= 899px the shell renders as the single 10px-padded, 10px-gapped column in the order given in the mobile table, with the 52px sticky header pinned at `top:0` above the scroller.
- [ ] The mobile branch is produced entirely by CSS from the same DOM as desktop: crossing 900px in devtools re-lays out without any JS re-render, and no listener is re-attached.
- [ ] Desktop tabs switch between SHAPE / RENDER / WORLD; mobile tabs switch between SCENE / SHAPE / RENDER / WORLD / STATS; the two selections are independent and survive crossing the breakpoint.
- [ ] Tabs are keyboard-operable (arrows, Home/End) and expose `role="tablist"` / `role="tab"` / `aria-selected`.
- [ ] All mobile tab targets are >= 44px tall; the RESET SCENE bar is 48px; nothing in the mobile stack declares a z-index above `--layer-sticky`.
- [ ] The canvas still renders at 1024×640 with sky, checker floor and vignette intact, scaled by `object-fit:contain` inside the viewport card at both breakpoints; no letterbox bar at the design width.
- [ ] `src/styles/layout.css` contains no `background`, `border`, `border-radius` or header/title/note declaration for `.panel` — every card in the skeleton is styled by `src/styles/components/panel.css`.
- [ ] `main.css` L3–L9 are gone and the base rules render `#05091A` behind `#app` on a short page; `grep -nE '#wrapper|#canvasWrapper|\.sidePanel|#controls|\.controlsHeader|\.sliderGroup|\.statsBadge|\.toggleRow|#selectButton|max-width: 1360px' src/styles/main.css` returns nothing.
- [ ] `<aside id="controls">` is absent from `src/index.html`, and `grep -n 'data-stats' src/` returns nothing.
- [ ] `Main`'s constructor no longer resolves `#fpsCounterNb` or `#trianglesRenderedNb`; both values reach the DOM only through `FieldWriter.write`, and the FPS and triangle readouts still update on the existing 90ms throttle and zero on pause exactly as before.
- [ ] `sceneObjectId('torusKnot')` returns `TORUS_KNOT_01`, and no other module derives that string.
- [ ] No raw hex and no raw px outside `src/styles/tokens/*.css`, except the `899px` literal inside `@media` conditions (commented with `--breakpoint-md`) and the one-off `max-width: 1440px` page clamp.
- [ ] `npm run build` passes.
