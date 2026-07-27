# System widget

The system card reports the render target and the host environment: buffer dimensions, buffer memory, JS heap, device pixel ratio and uptime. Four of the five rows are real today; only JS heap is browser-dependent. This ticket also owns the uptime clock and its formatter for the whole console — the status bar reads the same value rather than keeping its own. Card shell, header and stat rows come from the primitives ticket.

**Design source** — `3D Engine UI.dc.html` desktop L417–L444, mobile L1476–L1482 (`statGroups` SYSTEM rows).

## Desktop

Card sits last in the second telemetry row at `flex:1`.

- `.panel--fill` + `.panel__header--card` (22px). `.panel__title` `SYSTEM`, `.panel__note` `software raster`.
- Body: `.panel__body--pad-4` (8px) plus `flex:1`.
- Rows (5): `.stat-list` + `.stat-row`, which already supply the 4px gap, the label type and the value type. Labels in order: `BUFFER`, `COLOR BUFFER` (see Data — renamed from the mock's `COLOR + DEPTH`), `JS HEAP`, `DPR`, `UPTIME`. JS HEAP takes `.stat-row__value--dim` only when the API is unavailable.

## Mobile

`statGroups` SYSTEM card in the STATS tab (L1476–L1482), last of the four `statGroups` cards. Entirely the primitives' mobile stat-card recipe: `.panel__header--card` (26px, 9px padding), `.panel__body--pad-stats` (8px 11px 10px), five `.stat-row` at `--size-row-stat` (28px) with the mobile label/value type. Title `SYSTEM`, note `software raster`. Do not re-derive the padding, the row height or the type here.

`1024 × 640 × 32` is the widest value in the mobile stats stack at 15 characters. At 320px the card content box is 278px (320 − 10px page padding each side − 1px borders − 11px body padding each side); the value at 11px mono is roughly 99px, leaving about 179px for the 6-character `BUFFER` label. It fits with room to spare, but give `.stat-row__value` `white-space:nowrap` and let the label truncate, so a future longer label can never push the number onto a second line. Verify at 360px and 320px. Display-only card, no touch targets.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| BUFFER | `1024 × 640 × 32` | Real — read `canvasID.width` / `.height` once at boot; do not hardcode. The mock's `848 × 530 × 32` is the design's own viewport size and must not be copied. Use the `×` multiplication sign (U+00D7) as in the design, not `x`. |
| COLOR BUFFER | `2.50 MB` | Real, computed: `(width * height * 4) / 1048576`, 2 decimals. Renamed from the mock's `COLOR + DEPTH`, whose `3.43 MB` assumes 4 bytes of colour plus 4 bytes of depth — this engine has no depth buffer (see the z-buffer ticket), so counting it would be fiction. Keep the `MB` suffix as designed even though the divisor is MiB, matching the mock's own arithmetic. |
| JS HEAP | `<n> MB`, or em dash | Real in Chromium only: `performance.memory.usedJSHeapSize / 1048576`, 2 decimals. Non-standard, absent in Firefox and Safari, and quantised on pages that are not cross-origin isolated. Feature-detect once at boot; when absent render the row with an em dash in `var(--color-text-dim)` plus the primitives placeholder affordance (`data-placeholder="true"` + `title="unavailable in this browser"` + `aria-describedby`) — keep the row rather than removing it so the row count and card height stay stable across browsers. De-mock path: `performance.measureUserAgentSpecificMemory()` (async, requires `crossOriginIsolated`). |
| DPR | `window.devicePixelRatio.toFixed(2)` | Real. Re-read on change by arming a `matchMedia(\`(resolution: ${devicePixelRatio}dppx)\`)` `change` listener and re-arming it on each fire — a plain `resize` listener misses monitor swaps. |
| UPTIME | `m:ss` — minutes unpadded, seconds padded: `mm + ':' + String(ss).padStart(2, '0')` (design L1452) | Real — `performance.now() - bootTime`. **Driven by a dedicated `setInterval(…, 1000)` owned by this widget**, not by the 90ms fps gate. The design keeps counting while paused (`tick()` advances `secs` in the paused branch, L1223), and this engine cancels rAF on pause: `togglePause` calls `stop()` (src/index.ts L520–L524), `stop()` runs `cancelAnimationFrame` and resets `lastFpsDisplayUpdateAt` (L577–L584), and `fpsCounter()` — which owns the 90ms gate (L374) — is only called from `step()`, the rAF callback (L566–L570). A rAF-driven clock would freeze on pause. |
| Header note | `software raster` | Real, static — accurate description of this renderer. |

The uptime clock and its formatter live here and are exported once. The status bar consumes the formatted string via `setField`; it must not start a second interval. Clear the interval on teardown.

This card carries no triangle number and must not grow one. The **drawn count** (what `Surface3D.render` returns) belongs to the viewport and the toolbar; the **registry count** belongs to SHAPE INFO and GEOMETRY.

Constraint to record: the canvas is fixed at 1024×640 (src/index.html L57) and cannot be resized at runtime. `BackgroundRenderer` and `ShapeTransitionMachine` are constructed with `{width, height}` and `Point3D` caches `vpX` / `vpY` per point at construction, so BUFFER and COLOR BUFFER can be computed once at boot and never recomputed. There is also no CSS-driven backing-store scaling on `#canvasID` — its width/height attributes are the backing store — so DPR does not affect the buffer figures reported here.

## Files

- `src/index.html` — desktop card markup and the mobile `statGroups` SYSTEM card
- `src/ui/telemetry/SystemWidget.ts` — new; boot-time buffer figures, the heap feature detection, the DPR listener, and the uptime interval plus the exported formatter
- `src/index.ts` — record `bootTime`, pass the canvas to the widget, drive heap from the existing 90ms display gate
- `src/styles/components/system.css` — new; the mobile value overflow rule only. Card shell, header and stat rows come from the primitives ticket.
- `src/styles/main.css` — import

## Done when

- [ ] Desktop card renders 5 `.stat-row` under a 22px header noting `software raster`
- [ ] Mobile `statGroups` SYSTEM card renders 5 rows at 28px with `1024 × 640 × 32` fully visible at 360px and 320px width
- [ ] BUFFER and COLOR BUFFER are read from the canvas element, never hardcoded, and COLOR BUFFER reads `2.50 MB` at 1024×640
- [ ] JS HEAP shows a live figure in Chromium and a dimmed em dash with the primitives placeholder affordance elsewhere, with identical card height in both cases
- [ ] DPR updates when the window is dragged to a display with a different pixel ratio
- [ ] UPTIME advances once per second as `m:ss` with the minute field unpadded, keeps counting while paused, and is driven by exactly one `setInterval(…, 1000)` that is cleared on teardown
- [ ] The status bar's uptime segment reads this widget's exported value and starts no timer of its own
- [ ] `system.css` declares no card, header or stat-row recipe
- [ ] No raw hex/px outside the token files
