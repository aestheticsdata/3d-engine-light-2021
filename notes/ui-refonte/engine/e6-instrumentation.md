# Renderer instrumentation: staged timings, draw calls, fill rate and depth bins

The console shows a frame-time breakdown, a fill-rate figure, a draw-call count and a 28-bar depth histogram, and the renderer today produces none of them: `Mesh.renderMesh` does transform, cull and fill in one loop per triangle and `Surface3D.render` returns a single integer. This ticket restructures the render pass into separately timed transform / clip-cull / rasterise / present stages, counts canvas submissions, accounts rasterised pixels analytically, and bins the per-triangle depths the sort already computes. It also picks up the JS heap measurement outside the Chromium `performance.memory` path, because that is the same "what can we actually measure about ourselves" problem. Instrumentation must not distort what it measures, so timing is sampled rather than run every frame.

**Unblocks**

- FRAME TIME desktop legend values TRANSFORM / CLIP / CULL / RASTERIZE / PRESENT and the four percentage segments of the 12px stacked bar, replacing the single `data-state="unattributed"` segment (frame-time)
- FRAME TIME mobile: the 14px bar in the BUDGETS card and the five `statGroups` rows, which today render em dashes in both branches (frame-time)
- FILL RATE, desktop footer (` px/f`) and the mobile `statGroups` row (` px`) (frame-time)
- DRAW CALLS row and its `.stat-row__value--dim` placeholder treatment, desktop and mobile (geometry)
- The 28 histogram bars, the axis labels and the card title, replacing the frozen seed curve `h(i) = 18 + Math.exp(-((i - 9) / 7) ** 2) * 74` and the `--elevation-opacity-pending` wash (zbuffer)
- JS HEAP where `performance.memory` is absent (system) — see the honest limit recorded under Approach

## Approach

### Split the per-triangle loop into passes

`Mesh.renderMesh` (`src/primitives/Mesh.ts` L13–L29) sorts by `Triangle.depth` descending and then calls `Triangle.render()` per triangle; `Triangle.render()` (`src/primitives/Triangle.ts` L106–L226) projects three vertices (L112–L118), runs the 2D backface test (L121–L127) and rasterises (L133–L225) inside that one call. Break `Triangle` into three public methods and keep `render()` as their composition so nothing outside the class changes behaviour:

- `project(offsetX, offsetY)` — L112–L118 verbatim.
- `isFrontFacing(): boolean` — the sign of the 2D cross product `(b − a) × (c − a)` over the stored projections, L121–L127.
- `fill(context, options): boolean` — the wireframe branch (L133–L144), the flat-colour branch (L146–L159) and the affine texture branch (L161–L225), including the degenerate-UV guard at L186–L189 which keeps returning `false`.

`renderMesh` then runs: transform pass over all triangles, clip-cull pass (the depth sort plus the facing test, writing a `Uint8Array` mask), raster pass over the surviving triangles. Same work, same order of arithmetic, three loops instead of one.

There is no clipping in this engine *today* — `Point3D.convert3D2D()` (`src/primitives/Point3D.ts` L28–L34) has no near or far plane and the canvas clips for us — so the CLIP / CULL stage measures culling only. Keep the design's label, and say so in the widget's `title`. **E2 adds real near/far rejection** in the same place this ticket puts its facing test, so the stage becomes honestly named once E2 lands; write the pass so a rejection test slots in beside the facing test rather than hardcoding "cull only" into the loop, and update the `title` when E2 merges.

### What PRESENT means here

Canvas 2D has no present or swap; the browser composites outside our control. Define PRESENT as the background pass — `BackgroundRenderer.render()` at `src/primitives/Surface3D.ts` L27, or the `clearRect` fallback at L28–L35 — plus the residue between the outer frame bracket and the sum of the three measured stages. That keeps the four segments summing to the header total the frame-time ticket already measures, with no fifth segment and no markup change, and it is truthful as long as the definition is stated in code and in the widget tooltip. Do not normalise the four stages to 100% of a total they do not account for.

### Sampling, not per-frame timing

`performance.now()` is not free and the raster loop runs up to 7920 triangles on the torus knot (`src/data/shapes/torusKnot.ts` L11–L12), doubling during the 1250ms shape transition when two meshes are active. Take five reads per sampled frame (frame start, after transform, after cull, after raster, after background) — never per triangle, never per mesh-triangle. Sample every 6th frame (`INSTRUMENT_SAMPLE_INTERVAL = 6`, about 10 Hz at 60fps, comfortably ahead of the existing 90ms display gate at `src/index.ts` L34) and hold the last sample. Unsampled frames execute the identical pass structure with the timer calls skipped, so the sampled frame is representative rather than a different code path. Smooth with the EMA already used for fps (`FPS_SMOOTHING_FACTOR = 0.2`, `src/index.ts` L35, L368–L372) so the bar does not jitter.

Clock resolution is the limiting factor, not the call cost: `performance.now()` is clamped to 100µs in Chromium and coarser in Firefox and Safari unless the page is cross-origin isolated, where it drops to 5µs. Against a 4ms frame a 1ms clamp makes the stage split meaningless. Add the COOP/COEP dev headers (below), and gate the stage rows on a boot-time resolution probe: if two successive `performance.now()` reads around a busy loop cannot resolve better than 0.2ms, keep the stage values dashed and marked rather than shipping noise.

### Stats object

New `src/rendering/RenderStats.ts`: `interface RenderStats { transformMs; clipCullMs; rasterMs; presentMs; totalMs; drawCalls; fillPx; submitted; drawn; depthBins: Uint32Array }` plus a reusable accumulator instance (allocate once, reset per frame). `Surface3D.render` (L23–L48) returns `RenderStats` instead of `number`; `stats.drawn` is exactly the integer it returns today, so the D6 drawn-count contract is unchanged. Two call sites to update: `src/index.ts` L500 and L512.

### Draw calls

In a software rasteriser with no batching, `renderables.length + 1` is a constant 1 or 2 and means nothing — which is why the geometry ticket left the row dashed. Give the row the meaning that is true here: canvas submissions per frame. Count one per `fill()`/`stroke()` in the flat and wireframe branches, one per `drawImage` in the texture branch, and one for the background pass. That lands around `drawn + 1`, in the thousands, so the row must format with `toLocaleString()` grouping. That is a formatting change inside the existing stat row, not a layout change. State the definition in the row's `title`.

### Fill rate

Canvas 2D reports nothing about rasterised pixels, so account them analytically. For each drawn triangle the screen-space area is `|(b − a) × (c − a)| / 2` over the projections the transform pass already computed — one cross product and one `abs` per drawn triangle, no extra projection. Sum into `fillPx`.

This is submitted coverage, not resolved coverage: under painter's order overlapping triangles each count, so the figure exceeds the buffer's pixel count (655360 at today's 1024×640; read it from the render target, since E9 makes it fluid) whenever there is overdraw. That is the correct and useful reading — it is the overdraw number — so do not clamp it to the buffer size; label it in the tooltip.

One guard is mandatory. `convert3D2D()` computes `scale = fl / (fl + z + zOffset)`. With `DEFAULT_FOCAL_LENGTH = 300` (`src/index.ts` L20) and the zoom slider at maximum, `zOffset` is `-220` (L25), so the denominator is `80 + z`. The sphere spans ±100 (`src/data/shapes/sphere.ts` L4) and the torus knot ±116 (`src/data/shapes/torusKnot.ts` L8–L10), so the denominator genuinely reaches negative values on both shapes at full zoom: the projection inverts and a single triangle can contribute millions of pixels. Skip triangles whose vertex denominators are not all positive from the fill accounting and count them in a separate `inverted` field rather than letting them poison the average.

### Depth bins

`Triangle.depth` is the mean of the three vertex z values (`src/primitives/Triangle.ts` L102–L104), taken after `transformMesh` has rotated the points and before the perspective divide adds `zOffset`. The projection denominator `d = fl + z + zOffset` is the eye-space distance, so bin on `d`.

Fixed bin edges, not per-frame min/max — a rescaling histogram breathes and its axis labels lie. Rotation is rigid, so the mesh bounding radius `R = max |p|` over `points` is orientation-invariant: compute it once in `buildMesh` (`src/index.ts` L394–L421) and expose it as `Mesh.boundingRadius`. The axis is then `[fl + zOffset − R, fl + zOffset + R]`, moving only when the zoom slider moves, and bin index is

`i = clamp(((d − near) / (far − near) * 28) | 0, 0, 27)`

Bin the **submitted** set, not the drawn set — culled triangles still occupy depth (zbuffer ticket). Cost is one pass over the depths the clip-cull pass already computed, plus a 28-entry zero-fill per frame.

Two copy changes follow, and the zbuffer ticket explicitly invites them: the axis labels become the computed `near` / `far` to one decimal instead of the mock's `0.1` / `1000.0`, and the title becomes `DEPTH HISTOGRAM` (desktop) / `DEPTH` (mobile), both no wider than the strings they replace. It is a triangle-depth distribution, not a z-buffer, and the card must stop claiming otherwise. At maximum zoom `near` is negative (`300 − 220 − 116 = −36` on the torus knot); bin 0 then legitimately collects geometry behind the eye — keep it, and note it in the tooltip rather than clamping the axis.

### JS heap

`performance.memory` is Chromium-only and quantised outside a cross-origin-isolated context. `performance.measureUserAgentSpecificMemory()` is more accurate and unquantised but is also Chromium-only, async, rate-limited, and requires `crossOriginIsolated`. There is no Gecko or WebKit equivalent. So the deliverable is: prefer `measureUserAgentSpecificMemory()` when `crossOriginIsolated` is true, poll it no more than once every 10s, fall back to `performance.memory` on the 90ms gate, and where neither answers keep the em dash and the placeholder marker — decided at runtime, not hardcoded per browser. Add `server.headers` to `vite.config.js` (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) so the isolated path is testable in dev; the three image assets are bundled same-origin imports (`src/index.ts` L13–L15), so COEP breaks nothing here. Production isolation depends on the static host and is out of scope for this ticket.

### Wiring

`renderFrame` (`src/index.ts` L490–L505) and `renderPausedFrame` (L507–L518) receive the stats; publish to the store from the throttled branch of `fpsCounter()` (L374–L381), which is where every other telemetry number is already published. Extend `stop()` (L577–L584) to zero the stage times, fill rate and draw calls alongside the counters it already zeroes, so a paused console shows no stale timings.

### This is large — split it

Four independent pieces, in dependency order:

1. Pass restructuring plus stage timing and sampling (frame-time card). The bulk of the risk.
2. Fill rate and draw calls. Small, rides on 1.
3. Depth histogram. Independent of 1 — it needs only the depths and the bounding radius, so it can land first.
4. JS heap and the COOP/COEP headers. Independent of everything, half a day.

If the epic wants smaller tickets, ship 3 and 4 first and keep 1+2 as the real engine ticket.

## Constraints and risks

- **Painter's order must not shift.** The sort at `Mesh.ts` L19 currently sorts the `Triangle[]` array itself with a stable sort. Moving to an index sort over a parallel depths array changes tie-breaking among equal-depth triangles, and coplanar equal-depth triangles exist (cube faces, Menger faces), so a changed tie order flips which one paints last. Keep sorting the `Triangle[]` array with the same comparator, and diff screenshots of the cube, the Menger sponge and the torus knot before and after.
- **Three passes cost loop overhead and cache pressure**, not extra maths — every projection, cross product and fill still happens exactly once. Pay for it by killing the two `Point2D` allocations per triangle per frame at `Triangle.ts` L116–L118 (7920 triangles at 60fps is roughly 950k allocations per second on the torus knot): store the six projected scalars on the triangle instead. `aproj`/`bproj`/`cproj` are read only inside `Triangle` (verified: no other file references them), so this is a contained change.
- **`Surface3D.render`'s return type changes** from `number` to `RenderStats`. Two call sites, both in `src/index.ts`. Anything reading `renderedTriangles` keeps working if `stats.drawn` is assigned to it unchanged.
- **Per-frame cost added even on unsampled frames**: one cross product per drawn triangle (fill rate), one bin increment per submitted triangle, one 28-entry zero-fill. Budget it against the torus knot and record the measured before/after in the PR.
- **The stage split is only as good as the clock.** Without cross-origin isolation the numbers are coarse; the resolution probe must keep the rows dashed rather than showing a confident split of a 1ms-quantised measurement.
- **Do not let PRESENT become a dumping ground.** If the unmeasured residue exceeds 20% of the frame, that is a bug in the bracketing, not a rendering fact — log it in dev.
- **The frame-time header total stays the frame-time ticket's `frameMs`** (D5). The stages must sum to it; do not introduce a second total.
- **Order.** E6 lands after E2 and before E3, E4, E5 and E7 — it is the ticket that opens `Triangle` and `Surface3D` for everyone else. Its `project()` / `isFrontFacing()` / `fill()` split is the seam E3's rasteriser backend, E4's pattern texture fill and E5b's fog overlay all need; if any of them lands first, that ticket restructures `render()` and this one rebases onto its shape rather than splitting the method twice. Its `RenderStats` return replaces `Surface3D.render`'s `number` — E5b passes a view object through the same two call sites (`src/index.ts` L500, L512) and E7 changes the argument to `scene.renderables()`, so the three edits to those two lines need one agreed order. Its `Mesh.boundingRadius` and transform pass should also serve E7's `projectedBounds()` and E5b's `getBounds()` instead of each ticket walking the points again. E2 must be in first so the depth-bin axis and the fill-rate guard use the real near plane rather than this ticket's `denominator > 0` test.

## Files

- `src/primitives/Triangle.ts` — split `render()` into `project()` / `isFrontFacing()` / `fill()`, keep `render()` as their composition, add `screenArea()`, replace the `Point2D` projection fields with scalars
- `src/primitives/Mesh.ts` — three passes, stats accumulator parameter, `boundingRadius` getter (coordinate with the geometry ticket's `triangleCount` getter, same file)
- `src/primitives/Point3D.ts` — expose the projection denominator so the singularity guard and the depth bins do not recompute it
- `src/primitives/Surface3D.ts` — return `RenderStats`, time the background pass
- `src/rendering/RenderStats.ts` — new: interface, reusable accumulator, sampling gate, EMA, clock-resolution probe
- `src/index.ts` — call sites L500 and L512, publication from `fpsCounter()`, reset in `stop()`, `boundingRadius` in `buildMesh`
- `src/ui/telemetry/FrameTimeWidget.ts` — four real stage values, four bar segments, fill rate; delete the em dashes and the unattributed segment
- `src/ui/telemetry/GeometryWidget.ts` — DRAW CALLS value and grouping
- `src/ui/telemetry/ZBufferWidget.ts` — real bins, computed axis labels, retitle; delete the frozen curve
- `src/ui/telemetry/SystemWidget.ts` — the isolated heap path and the runtime-decided marker
- `vite.config.js` — dev-server COOP/COEP headers

## Done when

- [ ] `Mesh.renderMesh` runs three named passes; `Triangle` exposes `project`, `isFrontFacing` and `fill`, and `Triangle.render` still composes them with unchanged behaviour
- [ ] Cube, Menger sponge and torus knot render pixel-identically before and after the split, culling on and off, verified by screenshot diff
- [ ] FRAME TIME shows four measured values that sum to the header total, and the bar renders four percentage segments in both branches; `data-state="unattributed"` and the card's `data-placeholder="true"` are gone
- [ ] PRESENT is documented in code and in the widget `title` as background plus clear plus unmeasured residue, and a residue over 20% of the frame logs in dev
- [ ] FILL RATE reports summed projected triangle area and exceeds 655360 px when there is overdraw; both the desktop `px/f` and mobile `px` placeholder markers are gone
- [ ] Triangles whose projection denominator is not positive are excluded from fill accounting, verified at maximum zoom on the torus knot
- [ ] DRAW CALLS reports canvas submissions per frame with `toLocaleString()` grouping, its definition is in the row `title`, and its placeholder marker is gone
- [ ] Histogram bars come from the submitted triangle set over fixed `[fl + zOffset ± R]` edges, move only with the zoom slider, and the frozen seed curve is deleted
- [ ] Histogram axis labels show the computed near/far to one decimal; the title reads `DEPTH HISTOGRAM` / `DEPTH`; the card's `data-placeholder="true"` and its `--elevation-opacity-pending` rule are gone
- [ ] Instrumentation is sampled: an unsampled frame makes zero `performance.now()` calls inside the render pass, verified by instrumenting the instrumentation once in dev
- [ ] Stage rows stay dashed and marked when the boot-time clock probe cannot resolve better than 0.2ms
- [ ] `Surface3D.render` returns `RenderStats`, both call sites are updated, and `stats.drawn` equals the integer `renderedTriangles` holds today
- [ ] JS HEAP shows a live figure in Chromium, prefers `measureUserAgentSpecificMemory()` when `crossOriginIsolated`, and keeps the em dash plus marker only when no API answered
- [ ] `stop()` zeroes stage times, fill rate and draw calls so a paused console shows no stale timings
- [ ] Measured frame-cost delta on the torus knot (7920 triangles) is recorded in the PR; a regression over 1ms at 60fps blocks merge
