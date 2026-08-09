# Binding decisions — apply these; do not re-litigate them

These resolve every overlap, contradiction and ownership question the critic raised. They are decided. Where a draft ticket contradicts one, the draft is wrong.

## D1 — `primitives` owns every shared visual recipe
`src/styles/components/` under the primitives ticket owns: the panel card, the panel header strip (both the 24px sidebar and 22px telemetry variants, and their 26px mobile value), the panel title and note, the info row, the stat row, the stat tile, the chip and its four-slot colour table, the ON/OFF segmented toggle and its four-slot colour table, the slider row geometry, the range-input skin, the swatch, the badge, the HUD chip, the divider, the custom scrollbar, and the placeholder affordance.

No other ticket declares any of these. `telemetryCard.css` does not exist — the framerate ticket must not create it, and the six telemetry tickets consume `.panel` + `.stat-row` + `.stat-tile`. The shell ticket must not ship a second `.panel` recipe. The tab tickets own TS factories only (`chipGrid.ts`, `sliderRow.ts`, `toggleRow.ts`) and must never restate a colour table.

## D2 — `shell` owns the teardown and the shared state layer
Beyond the layout skeleton, the shell ticket owns:
- **Base rules.** Delete `main.css` L3–L9 (`body{background:#ccc;font-family:Arial;color:#10afff}`) and replace with the design's base: `html,body{margin:0;padding:0;background:var(--color-bg-app)}`, `*{box-sizing:border-box}`, `-webkit-font-smoothing:antialiased`, and the `a` / `a:hover` accent rules (design L15–L18, L31).
- **Full legacy-CSS teardown.** Every rule in `main.css` that the new console supersedes, named explicitly: `body`, `#wrapper`, `#canvasWrapper`, `canvas`, `.sidePanel`, `.panelContent`, `.controlsHeader`, `button`, `#selectButton`, `.fpsRow`, `.statsBadge*`, `.statsLabel`, `.statsValue`, `.toggleRow*`, `.toggleLabel*`, `.sliderGroup`, `.sliderRow`, `.sliderText`, `input[type=range]*`, `#resetControls`, and the `@media (max-width:1360px)` block. Widget tickets delete only the rules unique to their widget.
- **`<aside id="controls">` removal**, including `.controlsHeader` and `.sliderGroup`.
- **The element-id contract.** `Main`'s constructor resolves 21 element ids and throws `"UI controls are missing."` if any is absent (`src/index.ts` L130–L177). The shell skeleton must re-provide every one of those ids, even where the widget that will finally own the element has not landed yet. Add this as an explicit acceptance criterion: the branch must boot after the shell ticket alone.
- **The shared state layer**: `src/ui/FieldWriter.ts` (DOM field writer), `src/ui/UIStateStore.ts` (the store plus a subscribe API), `src/ui/TabGroup.ts`, `src/ui/sceneObjectId.ts`.
- **The `#fpsCounterNb` / `#trianglesRenderedNb` id migration**, done once here rather than three times across toolbar, framerate and geometry.

## D3 — Token naming: one name, overridden in the media block
There are no `*-mobile` token names. A token keeps one name and changes value inside `@media (max-width: 899px)`. Delete every `-mobile` variant a draft invented and use the base name.

Corrections to apply verbatim:
`--size-frame-w` → not a token, use the literal `1440px` · `--size-divider-v` → `--size-divider-toolbar` / `--size-divider-status` / `--size-divider-hud` · `--size-border-mark` → `--size-mark` · `--size-selection-label` → `--size-selection-label-h` · `--size-slider-track-row` → `--size-slider-input` · `--border-2` → `--size-mark` · `--size-panel-header-telemetry` → `--size-panel-header-card` · `--size-panel-header-mobile` → `--size-panel-header` · `--size-fps-chart-mobile` → `--size-fps-canvas` · `--size-ft-bar-mobile` → `--size-ft-bar` · `--size-stat-row-mobile` → `--size-row-stat` · `--size-zbuf-mobile` → `--size-zbuf-h`.

The two competing placeholder-opacity tokens collapse to one: `--elevation-opacity-pending: .55` in `elevation.css`. The 2px histogram bar minimum stays an untokenised literal.

The prefix list gains `--layer-*` and `--opacity-*` so `--layer-sticky` and `--opacity-blink-min` are legal as drafted.

**The breakpoint is exclusive at 900**: desktop is `min-width: 900px`, mobile is `max-width: 899px`. Never `max-width: 900px`.

## D4 — Placeholder affordance, defined once
`data-placeholder="true"` + a `title` attribute + `aria-describedby`. Defined in the primitives ticket, consumed everywhere.

**Do not reuse `FollowCursorTooltip` for this.** It is typed `target: HTMLInputElement` (`src/ui/tooltip.ts` L2) and only displays when the pointer is near a range thumb (L43–L59). It stays exactly where it is: on the disabled opacity slider. Generalising it is out of scope for this epic.

## D5 — One derivation per shared value
| Value | Owner | Everyone else |
| -- | -- | -- |
| `sceneObjectId` | shell, `src/ui/sceneObjectId.ts`, snake-case rule → `TORUS_KNOT_01` | import it |
| shading mode | the engine owns the vocabulary, `src/rendering/shadingMode.ts` — the `ShadingMode` union and `SHADING_MODES` | import the union, print it |
| `MaterialSummary` | shape-info owns the derivation, values `TEXTURED` / `SOLID` | take the instance |
| `frameMs` | frame-time, measured with `performance.now()` around the render call | import it |
| uptime clock | system owns the `setInterval(…, 1000)` and the formatter | status reads it via `FieldWriter.write` |
| triangle counts | see D6 | — |

## D6 — The triangle numbers, reconciled in one place
The design derives one number from `sceneTris()`. This engine has three genuinely different numbers, and every ticket must use the right one and say which:
- **registry count** — `objects3D[key].triangles.length`, static per shape → SHAPE INFO TRIANGLES, the primitive chips' meta line, GEOMETRY TRIANGLES (submitted).
- **drawn count** — the number `Surface3D.render` returns → the viewport's `tris drawn`, the scene-graph mesh row, the toolbar/telemetry live count.
- **culled** — `registry − drawn` while culling is on, else 0. Caveat that must appear in the geometry ticket: `Triangle.render()` also returns `false` at the degenerate-UV guard for textured triangles (`src/primitives/Triangle.ts` L186–L189), so on textured shapes the difference slightly overcounts. Say so rather than claiming exactness.

## D7 — RESET resets everything
The toolbar ticket owns RESET on desktop and the `RESET SCENE` bar on mobile, and both run the same path. Its acceptance criteria must enumerate every control restored — the existing `resetControls` values plus every new `UIStateStore` slice (shading mode, texture, base colour, UV scale, scale, the four lighting values, fog, grid step, projection, sky/floor/grid/shadow, and the dropped-frame counter). A control added by a later ticket is only Done when RESET restores it too; state that rule in the epic.

## D8 — Poly budget is computed, not copied
The mockup's 4096 is wrong for this repo: the torus knot alone builds 7920 triangles (`src/data/shapes/torusKnot.ts`), while the level-2 Menger sponge builds 2112. Derive the budget from the registry maximum rather than hardcoding a number that pins the bar at 100% on a real shape.

## D9 — Transform semantics: keep the engine's rates
Where a draft offers "option A (keep rotation rates) or option B (move to absolute angles)", **option A is chosen**. The UI epic does not change renderer behaviour. The sliders are relabelled honestly (a rate, not an angle) and absolute angles move to de-mock ticket E1. Every dependent ticket — camera, world-tab view presets, the viewport `cam.rot` readout — must be written against option A.

## D10 — Preview-only props are dropped
`statsMode` and `hudOverlays` are Claude Design preview controls with no production surface. The shell ticket states that both are dropped: all telemetry cards always render, and the HUD is always on. No `data-stats` attribute pointing at a ticket that does not exist.

## D11 — Small style rulings
- Secondary buttons are 10px everywhere; the design's 9px action cluster (L68–L70) is deliberately not preserved.
- The disabled slider gets no opacity fade: `cursor: not-allowed` and the thumb in `--color-slate-500`. Strike `opacity:.45` from the primitives draft.
- SKY and FLOOR are **real** and shared: world-tab ships `BackgroundRenderer.setLayers({sky, floor})`, quick-toggles consumes the same `UIStateStore` booleans. Rewrite the quick-toggles draft, which currently asserts they change nothing.
- GRID defaults **OFF** in both tickets, and stays a placeholder until de-mock E5 — a pill must not claim something the canvas is not drawing.
- Picking a primitive resets scene-graph selection to the mesh row.
- The mobile sticky header is `--layer-sticky: 6`; no widget may introduce a competing z-index.
- The mobile GESTURES card is the **last** card in the SCENE tab, below SHAPE STORY.
