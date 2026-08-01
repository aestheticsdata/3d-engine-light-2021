# World layers: grid, ground shadow, fog and world units

`BackgroundRenderer` draws a sky gradient, a sky bitmap, an atmosphere haze, a perspective checker floor and a vignette unconditionally, every frame, in canvas space (`src/rendering/BackgroundRenderer.ts` L16–L26) — its floor has its own hand-rolled projector with its own focal, its own centre and its own horizon, none of which is the scene camera. Nothing in that stack responds to zoom or focal length, and there is no grid, no shadow, no fog and no world-unit concept at all. This ticket puts the ground under the scene camera's own projection, adds a world grid with a step in metres, a ground shadow and distance fog, and defines the one constant that makes the status bar's `units: metres` true instead of decorative.

**Unblocks**

- ENVIRONMENT's GRID OVERLAY and GROUND SHADOW toggles, and the FOG and GRID STEP sliders — world-tab (`tickets-final/world-tab.md`, Data table)
- The GRID quick toggle — quick-toggles (the only placeholder of the five)
- The `G grid` shortcut chip's placeholder affordance — shortcuts. Its `SHORTCUTS` status moves from `pendingFeature` to `pendingHandler`; `S` and `F` stay `pendingHandler` either way, because the missing piece there is the `keydown` listener, which is a different ticket
- The `units: metres` status segment — status
- Partially DRAW CALLS — geometry. This ticket makes the frame contain a real, variable number of layer passes and exposes the count; the field itself stays a placeholder until the "Real draw-call accounting" ticket decides its semantics

## Approach

### `setLayers` already exists — extend it, do not re-ship it

`setLayers({sky, floor})` is settled: D11 assigns it to the world-tab UI ticket, and that ticket ships it as a hard deliverable with its own acceptance criterion ("SKY DOME and CHECKER FLOOR toggle real layers through `BackgroundRenderer.setLayers` at runtime"). SKY DOME and CHECKER FLOOR are therefore **not** in this ticket's Unblocks list. This ticket extends the same object to `{sky, floor, grid, shadow}` and adds `setWorld({fog, gridStepMetres})`, keeping world-tab's rule that flags are settable after construction and never passed through the constructor, because the renderer is built once at boot with fixed `{width, height, skyImage}` (`src/index.ts` L677–L681). E7 also lists `setLayers` as a fallback deliverable; it is not one for either ticket — world-tab owns it, both consume it, and there is exactly one switch.

### One ground projection, shared by the floor and the grid

The scene camera is `Point3D.convert3D2D` (`src/primitives/Point3D.ts` L28–L34): for a point `(x, y, z)`,

```
s(z)    = fl / (fl + z + zOffset)
screenX = vpX + x·s(z)
screenY = vpY + y·s(z)
```

with `vp` at the render target's centre — `(512, 320)` at today's 1024×640, but read it from the shared target rather than from literals, because E9 makes it fluid. Put the ground at a constant `y = GROUND_Y` (screen +y is down, so the ground is a positive y) and the whole ground plane follows from that one formula:

- the horizon is `y = vpY = 320`, because `s → 0` as `z → ∞`;
- every line of constant `x` converges on the principal point `(vpX, vpY)`, and every line of constant `z` is horizontal — a perspective map takes straight lines to straight lines, so each grid line is one `moveTo`/`lineTo`;
- the plane responds to ZOOM (`zOffset`) and FOV (`fl`) for free, which is the entire point: the current floor responds to neither.

Near clip is not optional. `s` blows up and then inverts as `fl + z + zOffset` passes zero, so every segment is clipped parametrically to `z ≥ zNear` where `zNear = dMin − fl − zOffset` — trimmed along the segment, not dropped, or a line that begins behind the eye disappears instead of running off the bottom of the frame. `dMin` is the camera's near plane once E2 ships it, floored at 40 engine units: a mesh vertex at `d = 1` is a dot, but a ground line runs continuously to the eye and at `d = 1` a single segment covers the screen several times over.

**`renderFloor` is re-derived on this projector.** Its current one (L76–L93) uses `focal = width·0.95`, `centerX = width·0.6`, `horizonY = height·0.57` and a 1.75 camera height, putting its vanishing line at `y ≈ 365` while the grid's is at `320`. Two horizons in one frame is worse than either alone. Re-derive the floor, and move the atmosphere haze and horizon glow (L57–L74) onto the same horizon so the composition holds together. The `destination-out` fade mask and the floor tint (L123–L138) keep working unchanged against the new horizon value.

This is also a large performance win. Today the floor fills `144 columns × 57 rows ≈ 8200` quads per frame under everything else. Derived from the world instead of from screen fractions, with the cell equal to the grid step, it is `(zFar − zNear)/step` rows by `2·xHalf/step` columns — about 320 quads at a 4 m step over a 60 m depth and ±40 m width. Measure before and after; this is likely the biggest single frame-time change in the epic.

### The grid

Strokes on top of the floor, in the same pass order (sky, atmosphere, floor, grid, shadow, vignette), so the mesh still draws over all of it.

- Step comes from GRID STEP in metres through `metresToUnits` (below). Lines at every multiple of the step in `x` and in `z`, plus a heavier line on the two axes.
- Draw far to near, and fade each line with the same fog curve the mesh uses, so distant lines vanish instead of aliasing into moiré at the horizon.
- Skip any row whose projected y gap from the previous row is under 1.5 px — the standard grid guard, and cheap since the rows are already ordered.
- Colours cannot come from CSS: canvas 2D cannot read custom properties. Add them to **`src/ui/chartTokens.ts`**, which the tokens ticket sanctions as the single hand-mirrored copy of `colors.css` and which world-tab already extended with `bgApp: "#05091A"` for exactly this reason. Do not create a second mirror module — world-tab explicitly rules that out, so this ticket ships no `worldColors.ts`.
- Build the grid from plain world coordinates through the shared projector function, not from `Point3D` instances — there is no camera transform to inherit yet, and allocating vertices per frame would be waste. Record the follow-up: when the camera rig ticket introduces a real view transform, the grid and `Point3D.convert3D2D` must route through it together, not diverge.

Note honestly what this grid does and does not do: the engine has no camera rotation — rotation is applied to the mesh points, never to a camera — so the grid is fixed in world space and the shape spins inside it. It answers to zoom and focal length only. That is still the thing that turns the viewport into a scene instead of a shape on a backdrop.

### Ground shadow

A projected blob, not a projected mesh. Filling 7920 shadow triangles for the torus knot would roughly double the rasterizer's work for something the eye reads as a smudge. Instead:

- `Mesh.getBounds()` (new) folds min/max over the mesh's points, which the mesh transform has already rotated in place, so the bounds are the current orientation's. `Point3D` exposes only `zValue` today (L8–L10) — add `xValue` and `yValue`, **the same two getters E3a adds**; whichever lands first owns them. Cost is one pass over at most 4224 points (the Menger sponge, the registry maximum) per frame, negligible against the fill cost. E7 adds `Mesh.projectedBounds()` and E6 adds `Mesh.boundingRadius` — three folds over the same array in three tickets. They are genuinely different quantities (world-space AABB, screen-space AABB, orientation-invariant radius), but the last one in should reuse E6's transform pass rather than adding a fourth loop.
- Centre the ellipse at `(cx, GROUND_Y, cz)` from the bounds. Horizontal half-axis `r·s(cz)` with `r = (maxX − minX)/2`. Vertical half-axis `GROUND_Y·(s(cz − r) − s(cz + r))/2` — the exact projected depth extent of the ground circle, which is what makes the ellipse foreshorten correctly as the zoom changes.
- Opacity falls with the gap between the mesh's lowest point and the ground: `h = GROUND_Y − maxY`, `alpha = lerp(0.42, 0.10, clamp(h / 400, 0, 1))`. Fill with a radial gradient from `rgba(0,0,0,alpha)` to transparent under a scale transform, so one gradient covers both axes.
- During a shape transition `getRenderables()` returns two meshes with screen-space `offsetX` / `offsetY` (`src/animations/shapeTransitionMachine.ts` L110–L126). Draw one blob per renderable with that renderable's offset applied, or the shadow detaches from the shape mid-flight.

The shadow needs mesh data inside the background pass, which today knows nothing about meshes. `Surface3D.render` already iterates the renderables (`src/primitives/Surface3D.ts` L38–L45); fold the bounds first, then pass a view object `{ focal, zOffset, blobs }` into `backgroundRenderer.render(context, view)`. `Main` supplies `focal` and `zOffset` through the existing render options.

### Distance fog

One curve, three consumers.

```
dist = fl + zOffset + z              // the projection denominator: distance from the eye
f    = fogAmount · (1 − exp(−(dist − dNear) / FOG_FALLOFF))
```

`dNear = fl + zOffset − sceneRadius` so the near side of the shape reads as unfogged, `FOG_FALLOFF = 900` units (9 m) by default. Exponential rather than linear because that is what atmosphere does and this repo's README is a maths explainer.

- **Mesh**: `TriangleRenderOptions` gains `fog?: { amount, color, near, falloff }`. After the triangle's own fill, if `f > 0.02`, fill the same path again with `rgba(fogColor, f)`. `Triangle.depth` (L102–L104) is already the mean z and is already computed for the sort, so the factor is free; the second fill is the cost.
- **Floor and grid**: the same `f` at each row's `z`, applied as alpha. The floor's existing hand-tuned fade gradients (L123–L138) are then redundant — replace them rather than stacking two fades.
- **Fog colour follows the sky**: the sky gradient's ground-side stop `#f1e8ee` when SKY DOME is on, the app background `#05091A` when it is off. Fog that does not match what it fades into looks like a grey wash.

Default FOG is **0**, not world-tab's 18: the second fill is a real per-triangle cost and the default frame must stay the frame the renderer draws today. Amend world-tab's default.

### World units

`src/rendering/worldScale.ts`: `UNITS_PER_METRE = 100`, `metresToUnits`, `unitsToMetres`. The constant is not arbitrary — every primitive is authored to roughly a 100-unit radius (sphere radius 100, cube ±100, cuboctahedron circumradius 100, Menger 210 across), so 100 units to the metre makes the on-screen object a 2 m thing, and `GROUND_Y = metresToUnits(1.75) = 175` keeps the 1.75 eye height the current floor code already assumes (L80). The shapes then hover about 0.7 m above the ground, which is what the shadow's height falloff expresses.

GRID STEP is authored in metres and converted here; `units: metres` in the status bar stops being a placeholder because there is now exactly one conversion in the tree and a control denominated in it.

### Pass counter for DRAW CALLS

Today the frame has a fixed number of layer passes, which is exactly why the geometry ticket refuses to print a draw-call count that would always read 1 or 2. After this ticket the number varies with the environment toggles, which is what makes it worth showing. Count one pass per layer that touches the canvas — sky, sky bitmap, atmosphere, floor, grid, shadow, vignette — plus one per renderable mesh.

**The field and its accounting belong to E6**, which introduces `src/rendering/RenderStats.ts` and changes `Surface3D.render` to return it. E5 does not touch that signature and does not remove the DRAW CALLS placeholder. If E6 has landed, increment `stats.drawCalls` from the background pass; if it has not, keep a plain counter on `BackgroundRenderer` with the same one-pass-per-layer semantics for E6 to fold in. Cross-link the two tickets so the definition is written once.

### This is two tickets

- **E5a — ground under the camera.** The shared projector with its near clip, `renderFloor` re-derived, the grid, the layer flags, `worldScale.ts`, the canvas colour mirror. Unblocks GRID OVERLAY, GRID STEP, the GRID pill, the `G` chip and the units segment.
- **E5b — shadow and fog.** `Mesh.getBounds()`, the `Point3D` accessors, the view object through `Surface3D`, the blob, the fog curve and its three consumers, the pass counter. Unblocks GROUND SHADOW, FOG and the draw-call groundwork.

E5b depends on E5a for the projector and the fog curve's home.

**Order.** E5 lands after world-tab (`setLayers`), after E2 and after E6, and before E7. E2 replaces the ad-hoc near epsilon with a real near plane and adds the orthographic branch — under orthographic the ground has no vanishing point and the grid must degenerate to parallel lines, so E2 owns that branch of the projector and this ticket consumes it. E6 restructures `Surface3D.render`'s return into `RenderStats`; E5b's view object and E6's stats accumulator pass through the same two call sites in `src/index.ts` (L500, L512) and must not be merged blind — this ticket leaves the signature alone and E6 folds the layer-pass counter in. E7 builds a `FloorObject` info record out of the *current* `renderFloor` constants (`cellWidth 3.4`, `cellDepth 4.2`, 144 columns, horizon `0.57 h`, `focal 0.95 w`, camera height 1.75) — this ticket deletes or re-derives every one of them, so E7's record must be written against the new projector, not the old one. E3b snapshots the background as its colour-buffer clear source; E5b's shadow blob is per-frame and breaks that assumption, so tell E3b which passes remain static. E9 makes the target resizable: derive the horizon and the ground extent from `renderTarget`, never from a 640 literal.

## Constraints and risks

- **The picture changes.** Moving the horizon from `y ≈ 365` to `y = 320` and the floor centre from `0.6·width` to the canvas centre is a deliberate change to a composition someone tuned by hand. It is the price of a floor that answers to the camera; get it looked at before merge rather than after.
- **This ticket does not resize the canvas** and does not re-construct `BackgroundRenderer` or `ShapeTransitionMachine`. It must not add a comment asserting the size is fixed: E9 makes it fluid, so every horizon, extent and centre this ticket derives comes from the shared render target.
- **Fog costs a second fill per triangle.** At FOG 100 on the torus knot that is 7920 extra fills. Default 0, threshold at `f > 0.02`, and measure the worst case.
- **The shadow reads mesh bounds every frame** — one pass over the points, ordered before the background pass. If the fold ever shows up in a profile, cache it per frame rather than per renderable call.
- **`renderVignette` stays unconditional** (world-tab's ruling) and stays inside the background pass, so it still does not tint the mesh. Do not quietly change that here.
- **The scene-graph FLOOR_01 and ENV_01 rows are not this ticket's.** Their visibility toggles gain a real target once the layer flags exist, but the row semantics belong to the multi-object ticket; scene-graph says rows 2–4 are E5/E7 and only the flags are E5's half.
- **RESET owns the new slices** (D7): grid off, shadow off, fog 0, grid step 4 m, sky and floor on.
- Every new canvas colour is a mirrored constant with a comment pointing at its token. No `getComputedStyle` in the render loop.

## Files

- `src/rendering/worldScale.ts` — new; `UNITS_PER_METRE`, `metresToUnits`, `unitsToMetres`, `GROUND_Y`
- `src/rendering/groundProjection.ts` — new; the shared `s(z)` projector, the ground point projection and the parametric near clip
- `src/rendering/groundGrid.ts` — new; the grid lines, the step-in-metres conversion and the sub-pixel guard
- `src/rendering/groundShadow.ts` — new; the projected ellipse and its gradient (E5b)
- `src/rendering/fog.ts` — new; the fog curve, the sky-dependent fog colour, shared by the mesh, the floor and the grid (E5b)
- `src/ui/chartTokens.ts` — extended with the grid and fog colours alongside the existing chart colours and world-tab's `bgApp`; no new mirror module
- `src/rendering/BackgroundRenderer.ts` — widen world-tab's `setLayers` to `{sky, floor, grid, shadow}` and add `setWorld({fog, gridStepMetres})`; `render(context, view)`; `renderFloor` re-derived on the shared projector; atmosphere anchored to the new horizon; the grid and shadow calls
- `src/primitives/Surface3D.ts` — fold mesh bounds over the renderables and pass the view object into the background pass; the return value is left exactly as it is (E6 owns changing it)
- `src/primitives/Mesh.ts` — `getBounds()`; pass the fog options through to `Triangle.render`
- `src/primitives/Point3D.ts` — `xValue` and `yValue` accessors
- `src/primitives/Triangle.ts` — `TriangleRenderOptions.fog` and the fog overlay fill
- `src/index.ts` — world state on `Main`; `changeFog` / `changeGridStep` / layer setters mirroring `changeZoom` (apply, then `renderPausedFrame()`); pass `focal` and `zOffset` into the render call
- `src/ui/uiState.ts` — `grid`, `shadow`, `fog`, `gridStep` stop being inert
- `src/ui/shortcuts.ts` — the `G` binding moves to `pendingHandler`
- `src/ui/inspector/worldTab.ts`, `src/ui/quickToggles.ts`, `src/index.html` — remove the placeholder affordance from GRID OVERLAY, GROUND SHADOW, FOG, GRID STEP, the GRID pill and the `units: metres` segment
- Amended tickets: `world-tab.md` (FOG default 0), `quick-toggles.md` and `shortcuts.md` (GRID is no longer a placeholder)

## Done when

- [ ] `data-placeholder="true"` with its `title` and `aria-describedby` is gone from GRID OVERLAY, GROUND SHADOW, FOG, GRID STEP, the GRID quick-toggle pill, the `G` shortcut chip and the `units: metres` status segment — and DRAW CALLS still carries its own, unchanged
- [ ] The floor and the grid share one horizon and one vanishing point, and both move when the ZOOM slider or the FOV slider moves
- [ ] No ground segment inverts, mirrors or streaks at the near end of the zoom range; the near clip is parametric, verified at zoom 100 with the widest FOV
- [ ] GRID STEP 1..20 m changes the spacing through `metresToUnits`, and `grep -rn "UNITS_PER_METRE" src` shows the constant defined once and imported everywhere else — no second metre conversion in the tree
- [ ] Distant grid lines fade out through the fog curve and never render closer than 1.5 px apart
- [ ] GROUND SHADOW draws one ellipse per active mesh, follows the shape through a transition including its screen offset, foreshortens as the zoom changes, and fades as the shape sits higher above the ground
- [ ] FOG 0 renders identically to `master` on all 8 primitives; FOG 100 fogs the far side of the mesh, the floor and the grid with the same curve, and the fog colour follows the SKY DOME toggle
- [ ] World-tab's SKY DOME and CHECKER FLOOR still toggle real layers through the widened `setLayers`, the vignette is still unconditional, and with the sky off the frame still flat-fills from `chartTokens.bgApp` — a regression check on an existing feature, not a deliverable of this ticket
- [ ] All four ENVIRONMENT toggles, both sliders and the GRID pill re-render while paused
- [ ] `Surface3D.render`'s return value is unchanged by this ticket, and the layer-pass count is exposed for E6 without altering its signature
- [ ] Floor quad count per frame drops from roughly 8200 to a step-derived count, and the before/after frame time is recorded in the PR
- [ ] This ticket does not resize the canvas, and every horizon, ground extent and centre it computes reads the shared render target rather than a 1024 or 640 literal
- [ ] No second CSS-colour mirror module exists: `grep -rn "#0" src/rendering/` finds no hardcoded token hex, and the grid and fog colours live in `src/ui/chartTokens.ts`
- [ ] RESET restores sky on, floor on, grid off, shadow off, fog 0, grid step 4 m
