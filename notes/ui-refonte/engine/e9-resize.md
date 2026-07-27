# Resizable render target

Every consumer of the canvas takes its size exactly once: the element is hard-coded `1024 × 640` (`src/index.html` L57), `BackgroundRenderer` and `ShapeTransitionMachine` capture `{width, height}` in their constructors, `Point3D` caches its viewport halves per point, and `Main` derives `centerX` / `centerY` in its constructor. The console therefore letterboxes a fixed raster inside a fluid card, upscales it on every HiDPI display, and reports resolution and buffer figures that are boot-time constants dressed as measurements. This ticket makes the render target follow its box at device-pixel resolution, without changing what the projection looks like at the current size.

**Unblocks**

- A fluid viewport: `.viewportStage`'s `aspect-ratio: 16/10` letterbox comes out on desktop and the canvas fills the viewport card (viewport-hud ticket)
- The resolution HUD chip stops being a boot-time constant and tracks the live backing store, desktop and mobile (viewport-hud ticket)
- SYSTEM's BUFFER and COLOR BUFFER rows (the mock's `COLOR + DEPTH`, renamed by that ticket) recompute on resize instead of once at boot (system ticket)
- CAMERA's ASPECT becomes live; FOV becomes constant-by-construction rather than constant-by-accident (camera ticket)
- DPR-correct rendering: the raster is no longer bilinearly upscaled by the compositor on any retina display (viewport-hud, system)

## Approach

This is a two-stage change and should land as two commits in this order. Stage one is a provable no-op and can be QA'd on its own; splitting it into its own ticket is reasonable, but stage two is meaningless without it.

### Stage one — decouple, at scale 1

**One shared render target.** New `src/rendering/renderTarget.ts`: a module-level `{ width, height, centerX, centerY, scale }` plus `setSize(width, height)`. `scale = height / REFERENCE_HEIGHT` with `REFERENCE_HEIGHT = 640` — the height the world coordinates in `src/data/shapes/` and `DEFAULT_FOCAL_LENGTH = 300` were authored against. Every consumer reads this instead of touching a canvas element.

**Projection: scale after the perspective divide, do not scale the focal.** `Point3D.convert3D2D()` (L28–L34) is

```ts
const scale = this.fl / (this.fl + this.z + this.zOffset);
const tmpX = this.vpX + this.x * scale;
```

with `vpX` / `vpY` `readonly`, captured per point from `document.querySelector("canvas")` in the constructor (L13, L17–L21). Replace with

```ts
const persp = this.fl / (this.fl + this.z + this.zOffset);
const tmpX = target.centerX + this.x * persp * target.scale;
const tmpY = target.centerY + this.y * persp * target.scale;
```

Four other tickets rewrite this same expression — E2 splits it into perspective and orthographic branches and hangs `near` / `far` off a shared camera record, E4 inserts `modelScale`, E7 factors it into `project(out): boolean` with a denominator guard, and E5 reads it as a standalone `s(z)` for the ground plane. Stage one is the smallest of the five and deliberately goes first, so the others fold into a `convert3D2D` that already reads the shared target instead of each rebasing the others. E2's record then carries `fl`, `k`, `mode`, `near` and `far`, and `renderTarget` carries the centre and the scale; do not let the same value end up in both.

Multiplying after the divide is what keeps framing exact at any size. The vertical half-angle satisfies `y · persp · scale = height / 2`, i.e. `y · persp = REFERENCE_HEIGHT / 2`, so vertical FOV stays `2·atan(320 / 300) = 93.7°` and the mesh occupies the same fraction of the frame regardless of resolution. Scaling `focal` instead does not work: `zOffset` runs 260 → −220 and the point z values stay in world units, so `fl / (fl + z + zOffset)` is not a similarity transform — the object's apparent size would drift across the zoom slider — and it would silently invalidate the CAMERA card's POSITION, DISTANCE and FOCAL / OFFSET rows, all of which read `300 + zOffset`. `DEFAULT_FOCAL_LENGTH` stays 300.

Side benefit worth taking: the per-point `document.querySelector("canvas")` disappears. That is one DOM query per vertex today — 3960 of them when the torus knot is built (`PATH_SEGMENTS 220 × TUBE_SEGMENTS 18`), 4224 on the Menger sponge, which is the registry maximum — and it is also a latent crash: the field is typed `HTMLCanvasElement` while `querySelector` returns `null`, so the `if (this.canvas)` guard at L18 leaves `vpX` / `vpY` `undefined` and every projection `NaN` if a mesh is ever built before the canvas exists.

**Rotation neutrals stop being the screen centre.** Delete `Main.centerX` / `centerY` (L97–L98, L181–L182). Their only readers are in `rotateMesh` (L427, L432), where they are the neutral points of a rate mapping, not a screen centre: `((pitch − centerY) / 110) · speed` and `(−(yaw − centerX) / 110) · speed`. Left alone, a resize silently changes the spin rate and can reverse it — the pitch slider defaults to 400, which spins one way against a 320 neutral and the other way against the 450 neutral a 900px-tall target would produce. It would also contradict the CAMERA card, whose SPIN RATE row already hardcodes 320 and 512. Replace with `PITCH_RATE_NEUTRAL = 320` and `YAW_RATE_NEUTRAL = 512` — exactly the values a 1024 × 640 canvas yields today, so default motion is unchanged to the last decimal. This is the decoupling D9 defers here; E1 replaces the whole mapping with absolute angles and deletes both constants, so build nothing new on them.

Stage one ships with `setSize(1024, 640)` called once at boot. The invariant to check before moving on: `scale === 1`, `centerX === 512`, `centerY === 320`, and every projected coordinate identical to the previous build.

### Stage two — resize

**Device pixels everywhere, no base canvas transform.** Set `canvas.width = Math.round(cssWidth · dprEffective)` and `canvas.height = Math.round(cssHeight · dprEffective)`, and leave the context transform at identity. Do **not** use `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` as the DPR strategy: `Triangle.render()` calls `context.setTransform(m11, m12, m21, m22, dx, dy)` (`src/primitives/Triangle.ts` L220) for every textured triangle, which is absolute and wipes the base scale — the dog and galaxy textures would draw at `1/dpr` size, offset, inside a correctly placed clip. Working in device pixels also means `renderTarget.scale` absorbs DPR for free. One consequence to handle: `Triangle.render` hardcodes `context.lineWidth = 1` (L135), which is a half-thickness hairline at DPR 2. Add `lineWidth?: number` to `TriangleRenderOptions` (default 1) and pass `renderTarget.scale` from `Main`'s two `surface3D.render` calls.

**`BackgroundRenderer.resize(width, height)`.** `width` / `height` are `readonly` (L2–L3) and everything else derives from them at draw time — the sky gradient, the sky bitmap's cover scale, the horizon at `height · 0.56` / `0.57`, the floor's `focal = width · 0.95`, the vignette. Dropping `readonly` and adding a setter is the entire change. Behaviour note to record: the checker floor's column count is fixed at 144 and its `focal` tracks width, so a wider target renders the same grid wider rather than showing more of it. That matches the mock and is acceptable.

**`ShapeTransitionMachine.resize(width, height)`.** `travelX` / `travelY` are computed once into the context (L152–L153) as `width + margin` / `height + margin`, and both animating states read `context.travelY` on every tick, so writing the two fields is sufficient and an in-flight transition follows the new size. Store `margin` on the context so `resize` can recompute it — today the `?? 160` default is consumed in the constructor and forgotten.

**`Main.resize(cssWidth, cssHeight)`.** Compute the backing size, return early if it is unchanged, set `canvas.width` / `canvas.height`, then `renderTarget.setSize`, `backgroundRenderer.resize`, `transitionMachine.resize`, then `renderPausedFrame()` — assigning `canvas.width` clears the bitmap, so a paused viewport goes blank until the next resize otherwise.

**The observer.** One `ResizeObserver` on `.viewportStage`, constructed in `Main.init` and disconnected in teardown. Prefer `entry.devicePixelContentBoxSize[0]` where available — it is already in device pixels and immune to fractional-CSS rounding — falling back to `contentBoxSize` / `contentRect` multiplied by `devicePixelRatio`. Round to integers and compare against the current backing size so a sub-pixel layout change does not reallocate the bitmap. A DPR change from dragging the window to another display does not reliably fire `resize`, so re-run the same path from the `matchMedia('(resolution: Xdppx)')` listener the SYSTEM widget already arms rather than adding a second listener. Coalesce to one resize per rAF tick: `ResizeObserver` fires every frame during a drag, and each resize reallocates the bitmap and repaints the entire background.

**Pixel budget, not optional.** This is a software rasteriser filling canvas paths on the main thread, so cost is linear in `width × height`. Today's 1024 × 640 is 0.65 MP; a 1400px-wide centre column at DPR 2 is 2800 × 1750 = 4.9 MP, roughly 7.5× the fill work per frame — and the checker floor draws about 8000 filled quads before the mesh gets a look in. Introduce `MAX_RENDER_PIXELS` (start at 1.6 MP, about 1600 × 1000) and derive `dprEffective = Math.min(devicePixelRatio, Math.sqrt(MAX_RENDER_PIXELS / (cssW · cssH)))`, so a large window degrades resolution instead of frame rate. The clamp is visible rather than hidden, because the resolution HUD chip reports the real backing store.

**Downstream readouts.** The three widgets that computed from the canvas once at boot subscribe to the resize path and publish through `setField`, so both branch mounts update from one write: the resolution HUD chip, SYSTEM's BUFFER and COLOR BUFFER (`width · height · 4 / 1048576`, 2 decimals), and CAMERA's ASPECT. The CAMERA ticket's FOV formula `2·atan((canvas.height / 2) / 300)` becomes `2·atan((canvas.height / renderTarget.scale / 2) / 300)`, which is 93.7° at every size. Leave the FRAMERATE sparkline alone — it owns a separate canvas with `dpr = 2` pinned by its own ticket and its own size check inside `drawFps()`, and must not be attached to this observer.

**CSS.** `src/styles/components/viewport.css` drops `aspect-ratio: 16 / 10` from `.viewportStage` on desktop and lets the stage fill the card (`position: absolute; inset: 0`). That is the one sanctioned layout change in this epic: the letterbox *is* the placeholder. Mobile keeps the card's own `aspect-ratio: 16 / 10`, so the stage keeps its shape there and HUD anchoring is untouched in both branches.

## Constraints and risks

- The whole change rests on one invariant: at 1024 × 640 with DPR 1 every projected coordinate must be identical to today. `scale === 1` and `centerX / centerY === 512 / 320` make that true; assert it once at boot so a later refactor cannot quietly break framing.
- Fill cost is linear in pixels. Without the pixel cap, a maximised window on a 4K display turns a 60 fps scene into a slideshow — a software rasteriser has no GPU to absorb it.
- Reallocating the backing store clears it, so every resize must repaint; a paused viewport that is not explicitly re-rendered goes blank.
- A resize during a shape transition moves `travelX` / `travelY` under a running lerp and the incoming mesh jumps. Accepted — deferring resize until the machine is idle leaves the canvas stale for up to 1250 ms, which is worse.
- Affine texture mapping already shears (see the header comment in `Triangle.ts`); at higher resolution those artifacts are more visible, not less. That belongs to the texture de-mock work, not here.
- Three UI tickets state in prose that the canvas cannot be resized — `system.md`, `camera.md` and `viewport-hud.md`, the last with an explicit "No canvas resize is attempted" acceptance criterion — as do `world-tab.md` and, in the engine epic, E1, E2, E3, E5 and E7. Those notes and any code comments repeating them are now wrong and must be corrected in the same PR, or the next reader re-derives the constants.
- **Order.** Stage one goes **first in the whole epic**; stage two goes **last**. Stage one is a provable no-op that removes the per-point DOM query, moves the viewport centre into a shared module and decouples the rotation neutrals — three things E1 and E2 would otherwise each do half of. Stage two invalidates every fixed-size assumption the other tickets are written against: E3b allocates colour and depth buffers, E5 derives a horizon and a ground extent, E6 compares fill rate against a pixel count, E7 clamps a bracket to the stage. Each of those must already read `renderTarget` (they are written to), so stage two is a `setSize` call plus an observer rather than a reopening of four tickets — but it still lands after them, because a software rasteriser's cost is linear in pixels and the perf gates in E3b and E5 must be measured at a known size first.
- No `data-placeholder` node belongs to this ticket: the resolution chip and the BUFFER / COLOR BUFFER rows were real-but-frozen, not marked. The equivalent criterion is that none of them can report a stale number after a resize, and that no comment in `src/` still claims a fixed 1024 × 640.

## Files

- `src/rendering/renderTarget.ts` — new; the shared `{width, height, centerX, centerY, scale}` and `setSize`
- `src/primitives/Point3D.ts` — read the shared target, drop the cached `vpX` / `vpY` and the per-point canvas query
- `src/primitives/Triangle.ts` — `lineWidth?: number` on `TriangleRenderOptions`, used by the wireframe stroke
- `src/rendering/BackgroundRenderer.ts` — `resize(width, height)`, `readonly` dropped from the two fields
- `src/animations/shapeTransitionMachine.ts` — `resize(width, height)`, `margin` kept on the context
- `src/index.ts` — `PITCH_RATE_NEUTRAL` / `YAW_RATE_NEUTRAL`, `centerX` / `centerY` removed, `resize()`, the `ResizeObserver`, the DPR `matchMedia` hook, teardown, the `setField` writes, `lineWidth` passed to both render calls
- `src/index.html` — canvas keeps `width="1024" height="640"` as the pre-observer seed
- `src/styles/components/viewport.css` — desktop stage fills the card; mobile unchanged
- `src/ui/viewportHud.ts`, `src/ui/telemetry/SystemWidget.ts`, `src/ui/telemetry/CameraWidget.ts` — recompute on resize instead of at boot

## Done when

- [ ] At 1024 × 640 with DPR 1 the rendered frame is pixel-identical to the previous build, and the shape's spin rate and direction are unchanged at every slider position
- [ ] `grep -rn 'querySelector("canvas")' src/primitives/` returns nothing, and `Point3D` no longer caches a viewport half
- [ ] `Main` no longer holds `centerX` / `centerY`; `rotateMesh` reads the two named rate-neutral constants and a resize does not alter the spin rate
- [ ] Dragging the window from 900px to 1800px wide re-rasterises the scene at the new size with no letterbox, no stretch, and the mesh at the same fraction of the frame
- [ ] Vertical FOV measures 93.7° at every viewport size; ASPECT tracks `canvas.width / canvas.height`
- [ ] On a DPR 2 display the raster is sharp — text-free edges show no compositor upscaling — and textured faces are drawn at the correct scale and position, proving no base canvas transform was introduced
- [ ] Wireframe strokes keep their apparent thickness at DPR 1 and DPR 2
- [ ] Backing pixels never exceed `MAX_RENDER_PIXELS`; a maximised window on a large display reduces resolution rather than frame rate, and the resolution chip shows the clamped figure
- [ ] Resizing while paused leaves a correctly rendered frame on screen, not a blank canvas
- [ ] The resolution chip, SYSTEM BUFFER and COLOR BUFFER, and CAMERA ASPECT all update on resize in both branches through a single `setField` write each; COLOR BUFFER still reads `2.50 MB` at 1024 × 640
- [ ] `ResizeObserver` fires at most one resize per animation frame during a continuous drag, and is disconnected on teardown
- [ ] Moving the window to a display with a different `devicePixelRatio` re-rasterises without a window resize
- [ ] The FRAMERATE sparkline canvas is untouched and still resizes itself at its pinned DPR 2
- [ ] No comment or ticket implementation note in `src/` still asserts that the canvas is fixed at 1024 × 640
- [ ] `npm run build` passes
