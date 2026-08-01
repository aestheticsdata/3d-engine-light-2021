# Camera rig: absolute transform and orbit input

Today the engine has no orientation and no camera. `rotateMesh` (`src/index.ts` L423–L440) applies three small rotations to the mesh every frame and `Mesh.transformMesh` mutates the points in place, so the only state that exists is whatever the accumulated matrix product happens to have done to the vertices — there is no angle to read, no rest pose to return to, and nothing a preset or a drag can write to. This ticket gives the scene an absolute orientation rebuilt from pristine geometry each frame, derives a real camera position from it, and adds pointer, wheel and touch input so the viewport is draggable. It is the ticket the console's whole camera column is waiting on: D9 deliberately deferred absolute angles here so the UI epic could ship without touching renderer behaviour.

**Unblocks**
- The five view-preset chips FRNT / BACK / TOP / SIDE / ISO — `world-tab`
- `cam.pos`, `cam.rot`, `target`, `dist` in the top-right HUD readout and the mobile chip stack — `viewport-hud`
- The axis gizmo's orientation (the static `rotate(215deg)` Z bar) — `viewport-hud`
- The bottom-centre hint strip `drag orbit · scroll zoom` — `viewport-hud`
- The CAMERA card's POSITION row, and its ROTATION row, which `camera` had to relabel SPIN RATE — `camera`
- The mobile GESTURES card rows DRAG / PINCH / DOUBLE TAP and its "Gestures ship with pointer camera control." footer — `shortcuts`
- The TRANSFORM sliders' degree labels: PITCH / YAW / ROLL RATE become absolute angles with a `°` suffix, superseding `shape-tab`'s rule that no rotation label may carry one — `shape-tab`

## Approach

This is a large ticket and should land as two. **E1a — orientation core and derived readout**: pristine points, matrix composition, the rig, absolute sliders, view presets, and every numeric/gizmo readout above. **E1b — pointer input**: drag orbit, wheel zoom, pinch, double-tap reset, the cursor and `touch-action` rules, and the hint strip and GESTURES card. E1b adds no maths; it writes into the rig state E1a owns. Split at that seam and E1a is independently shippable and independently verifiable.

### Pristine geometry

`Point3D` stores x/y/z privately and `transformPt` overwrites them from themselves, so the source vertex is destroyed on the first frame. Add three readonly source fields set in the constructor (`sx`, `sy`, `sz`) and a method that writes the current position from the source rather than from itself:

```
setFromSource(m: number[][]):
  x = m[0][0]*sx + m[0][1]*sy + m[0][2]*sz + m[0][3]
  y = m[1][0]*sx + m[1][1]*sy + m[1][2]*sz + m[1][3]
  z = m[2][0]*sx + m[2][1]*sy + m[2][2]*sz + m[2][3]
```

Same arithmetic as `transformPt`, different operand. Because it reads column 3, the matrix may carry translation as well as rotation — which is what makes an orbit target and, later, E4's mesh scale expressible in the same call. `Mesh.transformMesh(rot)` becomes `Mesh.setTransform(m)` looping `setFromSource`. `Mesh.transformMesh` and `Point3D.transformPt` then have no callers (verified: `rotateMesh` is the only one) — delete both rather than leaving an incremental path that can silently reintroduce drift. Memory cost is three doubles per vertex; the largest mesh is the torus knot at 220 × 18 = 3960 vertices, so ~95 KB.

### One matrix per frame

`Matrix3D` is a trap: `setAngle(deg)` recomputes `roll`, `pitch` *and* `yaw` from a single cos/sin pair, so the three fields are only ever valid for the angle most recently set. Replace it with pure builders — `pitchMatrix(deg)`, `yawMatrix(deg)`, `rollMatrix(deg)`, `multiply(a, b)`, `identity()` — returning fresh 4×4 arrays, and delete `setAngle` and the mutable fields. Keep the degree convention: `setAngle` converts internally (`agl * Math.PI / 180`), so the rig's angles stay degrees end to end with no `180 / Math.PI` anywhere.

`rotateMesh` applies pitch, then yaw, then roll to already-transformed points, so the product it is really computing is `R_roll · R_yaw · R_pitch`. Preserve that order so equal angles give the same attitude as today:

```
M = R_roll(roll) · R_yaw(yaw + spin) · R_pitch(pitch) · T(-target)
```

`T(-target)` is identity by default and exists so the `target` readout is structurally real rather than a printed constant; panning input is out of scope.

Cost: three matrix builds and three 4×4 multiplies per frame (~200 flops, noise), then one `setFromSource` per vertex — 3960 matrix-vector products at worst. Today's three passes cost 3× that, so the absolute path is *cheaper* per frame than the incremental one it replaces.

### The rig

New `src/camera/CameraRig.ts` holding `pitch`, `yaw`, `roll` (degrees), `spinRate` (degrees/second), `spinAccum`, and `target`. It exposes `matrix()` returning M, `advance(dtSeconds)` accumulating `spinAccum += spinRate * dt`, `applyPreset(name)`, and the derived readouts below.

Spin is a separate accumulator added to yaw, not a mutation of it, so dragging and autorotation compose the way a turntable does: the drag moves the viewpoint, the spin keeps running from wherever it was left. `applyPreset` zeroes `spinAccum` so a preset lands exactly on its stated angles.

Accumulate against real elapsed time, not per frame: keep `lastFrameTimestamp` in `Main.step`, clamp `dt` to 100 ms so a backgrounded tab does not snap the shape on return, and rebase it in `start()` next to the existing `transitionMachine.syncClock(performance.now())` call — without that, unpausing spins the shape by the entire paused duration. Frame-rate independence is a real improvement over today's per-frame delta and should be stated as one.

### Where it is applied

In `renderFrame`, replace `renderables.forEach(r => this.rotateMesh(r.mesh))` with one `const m = rig.matrix()` and `transitionMachine.getActiveMeshes().forEach(mesh => mesh.setTransform(m))`. Two consequences worth naming: `getActiveMeshes()` de-duplicates while `getRenderables()` does not, so today a mesh appearing twice in `renderables` would be double-rotated — absolute orientation makes the call idempotent and the latent bug disappears. And during a `switching` transition the outgoing mesh (which has accumulated a long rotation history) and the freshly built incoming mesh (which starts at identity) currently hold visibly different attitudes; with a shared absolute matrix they match from the first frame of the transition.

`renderPausedFrame` must apply the matrix too, otherwise a drag or a preset while paused does nothing. It already early-returns when `isPlaying`, so route pointer input through a small `requestRender()` that calls it.

### Derived readouts

The projection is `scale = fl / (fl + z + zOffset)`, so the eye sits where the denominator vanishes: at `z = -(fl + zOffset)`, i.e. distance `d = fl + zOffset` in front of the projection plane, looking down +z. Rotating the world by `R` is exactly equivalent to rotating the camera by `Rᵀ`, so the eye position expressed in object space is

```
d        = fl + zOffset                       // 560 at zoom 0, 80 at zoom 100
eye_obj  = target + Rᵀ · [0, 0, -d]
```

where `R` is M's upper-left 3×3 (orthonormal, so the transpose is the inverse — no matrix inversion code). Three dot products. That makes `cam.pos` exact rather than decorative, and it is the honest description of this renderer: an orbit camera implemented world-side.

- `cam.pos` → `eye_obj`, one decimal
- `cam.rot` → `(pitch, yaw + spinAccum, roll)` normalised to (−180, 180], one decimal, `°` suffix
- `target` → the rig target, `0.0 0.0 0.0` today
- `dist` → `d`, unit `u` (not the design's `m`; `viewport-hud` and `camera` already settled that)

`camera`'s CAMERA card gets the same three: POSITION is `eye_obj` (superseding its `0.0 0.0 -(300 + zOffset)` derivation, which was the zero-rotation special case of this formula), ROTATION reverts from SPIN RATE to real Euler degrees, DISTANCE is unchanged. Keep the numeric readouts on the existing 90 ms display gate in `fpsCounter` so the text does not flicker.

**Gizmo.** For a unit object axis `e_j`, `R · e_j` is column *j* of `R`. The gizmo is an orthographic view of the basis, so its screen direction is that column's first two rows and its foreshortening is their length:

```
θ_j = atan2(R[1][j], R[0][j])        // screen y points down, so this is CSS rotation directly
f_j = hypot(R[0][j], R[1][j])        // 1 when the axis lies in the screen plane, 0 when it points at the eye
```

Set each axis bar's `transform: rotate(θ_j)` about the gizmo origin and its length to `baseLength * f_j`, floored at 2px so an axis pointing at the viewer shrinks to a dot instead of vanishing. Three `atan2` and three style writes per frame; update this every frame rather than on the 90 ms gate so it tracks a drag.

### Sliders and presets

The rate sliders and their two-segment UI-space mapping go away. Delete `PITCH_YAW_ROTATION_DIVISOR`, `ROLL_ROTATION_DIVISOR`, `rotateMesh`, and `centerX` / `centerY` (assigned at L181–L182, used only as rotation neutrals at L427/L432). The TRANSFORM rows become:

| Row | Range | Default | Format |
|---|---|---|---|
| PITCH | −89..89 | 0 | `v + "°"` |
| YAW | −180..180 | 0 | `v + "°"` |
| ROLL | −180..180 | 0 | `v + "°"` |
| SPIN | 0..120 | 24 | `v + "°/s"` |

Pitch clamps at ±89 because the rig is a turntable — roll is its own axis, so there is no reason to allow the pole flip. Yaw is kept unbounded internally and written back to the slider normalised, so a drag past 180° makes the thumb jump end to end; a range input cannot wrap and that is the least surprising behaviour.

SPIN at 24 °/s is a fifteen-second turntable. Today's defaults (pitch 400, yaw 400, roll 200, speed 200) work out at 1.45 / 2.04 / 0.80 degrees *per frame*, roughly 87 / 122 / 48 °/s at 60 fps on three axes at once. The resting shot therefore changes visibly and deliberately — flag it for QA rather than letting it read as a regression.

Presets write the three angles and zero `spinAccum`. The mockup's pairs (yaw `[0,180,137,90,45]`, pitch `[0,0,78,0,30]`) are not usable as-is: 137/78 is not a top view in any convention. Ship FRNT `(0,0,0)`, BACK `(0,180,0)`, TOP `(±89,0,0)`, SIDE `(0,90,0)`, ISO `(−30,45,0)`, choosing the TOP sign by inspection so the shape's top faces the eye, and ease over ~350 ms with the `easeInOutCubic` already in `shapeTransitionMachine.ts` rather than snapping. Chips stay momentary and stateless as `world-tab` specifies — a preset is a one-shot write, not a mode.

### Input (E1b)

Attach to `canvas#canvasID`. `viewport-hud` already made `.viewportHud` `pointer-events: none` for exactly this, so nothing is in the way. Use Pointer Events so mouse, pen and touch share one path, with `setPointerCapture` on down so a drag that leaves the canvas keeps tracking.

- **Drag orbit.** `yaw += dx * 0.4`, `pitch -= dy * 0.4`, clamped, written back to the sliders and `uiState` in the same frame. 0.4 °/px is a full turn across a 900px sweep; the stage is 848 CSS px at the design frame, so one drag across the viewport is one revolution. The canvas backing store is 1024 wide against an 848 CSS box, but a rotation *delta* is degrees per CSS pixel — no backing-store conversion, and say so in a comment so nobody adds one.
- **Wheel zoom.** Normalise `deltaMode` (Firefox reports lines: multiply by 16), then `zoomSlider += -deltaY * 0.05` clamped 0..100 and pushed through the existing `changeZoom`. Register with `{ passive: false }` and `preventDefault()`, or the page scrolls under the cursor. macOS trackpad pinch arrives as a wheel event with `ctrlKey: true` — treat it as zoom and `preventDefault` it too, otherwise the browser page-zooms.
- **Pinch.** Track active pointers in a `Map`; with two down, `slider = startSlider + 30 * Math.log2(dist / startDist)` clamped — spreading the fingers to twice the separation moves the slider 30 points, and the log makes the gesture symmetric in and out.
- **Double-tap reset.** Two `pointerup` events of `pointerType === "touch"` within 300 ms and 24 CSS px reset the rig (angles, `spinAccum`, zoom) and nothing else. It deliberately does *not* run the toolbar RESET — nuking shading, materials and toggles on a stray double tap is worse than useless. RESET (D7) continues to restore these values as part of restoring everything.
- **CSS**: `cursor: grab` / `:active { cursor: grabbing }` on the canvas, and `touch-action: none` so a one-finger drag orbits instead of scrolling the page.

## Constraints and risks

- `touch-action: none` on the canvas means the viewport card is no longer a place a mobile user can start a page scroll. The GESTURES card promises DRAG orbit, so this is the intended trade; the card sits high in the mobile layout with scrollable content above and below it.
- The resting animation changes: one turntable axis at 24 °/s instead of three axes at ~87/122/48 °/s. Every screenshot and the first frame of the shape transition look different.
- `ShapeTransitionMachine` holds up to two meshes and hands them out through `getRenderables()`; the rig must drive `getActiveMeshes()` instead so a duplicate entry is not transformed twice. Meshes built mid-transition by `buildMesh` start at their source pose and must receive the matrix before their first render — `startTransitionToPrimitive` runs outside `renderFrame`, so either apply the matrix in `buildMesh` or accept one frame at rest pose; apply it in `buildMesh`.
- Per-frame cost falls (one vertex pass instead of three) but the pass is now unconditional even when nothing moved. At 3960 vertices that is ~48k flops — leave it unconditional rather than adding a dirty flag; a dirty flag would have to be invalidated by spin, drag, presets, sliders, transitions and pause/resume, which is more failure surface than the saving is worth.
- Floating-point drift disappears. Today the mesh is the product of thousands of accumulated matrix multiplications and slowly shears; rebuilding from source removes that class of bug entirely, so a long-running tab no longer degrades.
- `Point3D`'s constructor runs `document.querySelector("canvas")` per point — 3960 DOM queries when the torus knot is built. Not this ticket's job to fix (E2 folds the projection state into a shared camera record), but do not make it worse: the source fields are plain assignments.
- Angles must stay in degrees throughout. The matrix builders convert internally, exactly as `setAngle` did. A stray `180 / Math.PI` anywhere in the rig or the widgets is a bug.
- This ticket does not resize the canvas; `BackgroundRenderer` and `ShapeTransitionMachine` keep the dimensions they were constructed with. That is a statement about E1's own scope, not a property of the engine — E9 makes the render target resizable, so do not write a comment asserting a fixed 1024 × 640.
- **Order.** E1 lands after E9 stage one and after E2. E9 stage one deletes `Main.centerX` / `centerY` and replaces them with `PITCH_RATE_NEUTRAL` / `YAW_RATE_NEUTRAL`; this ticket deletes the rate mapping and both constants outright, so E9 stage one explicitly tells you to build nothing new on them — take that ticket's decoupling and then remove what is left. E2 redefines `dist = fl + zOffset` as `fl / k` once FOV and dolly compensation exist, and owns the shared camera record; the rig must read eye distance from that record rather than recomputing it, and both tickets rewrite `Mesh` and `Point3D`, so whichever lands second rebases. Downstream: E8's `advanceAndRender(now)` is extracted from the `renderFrame` this ticket rewrites and calls `rotateMesh`, which this ticket deletes — E8 must be written against the rig, so land E1 first or hand E8 the seam.

## Files

- `src/primitives/Point3D.ts` — source coordinates, `setFromSource`; delete `transformPt`
- `src/primitives/Matrix3D.ts` — pure `pitchMatrix` / `yawMatrix` / `rollMatrix` / `multiply` / `identity`; delete `setAngle` and the mutable `roll` / `pitch` / `yaw` fields
- `src/primitives/Mesh.ts` — `setTransform(m)` replaces `transformMesh`
- `src/camera/CameraRig.ts` — new; rig state, `matrix()`, `advance(dt)`, `applyPreset`, `eyePosition()`, `eulerDegrees()`, `distance()`, `axisScreenDirections()`
- `src/input/pointerOrbit.ts` — new (E1b); pointer, wheel and touch handling, writing into the rig
- `src/index.ts` — delete `rotateMesh`, the two rotation divisors, `centerX` / `centerY` and the UI-space rate mapping; own the rig, the frame clock and `requestRender`; apply the matrix in `renderFrame`, `renderPausedFrame` and `buildMesh`; rebase the clock in `start()`
- `src/ui/inspector/shapeTab.ts` — TRANSFORM rows become degrees, ranges and formats per the table
- `src/ui/inspector/worldTab.ts` — the five preset chips call `applyPreset`
- `src/ui/uiState.ts` — rotation slices become absolute degrees; spin becomes °/s
- `src/ui/viewportHud.ts` — `cam.pos` / `cam.rot` / `target` / `dist` and the gizmo transforms; drop their placeholder markers and the hint strip's
- `src/ui/telemetry/CameraWidget.ts` — POSITION from `eyePosition()`, ROTATION reverted from SPIN RATE to Euler degrees
- `src/ui/shortcutsPanel.ts` — drop the GESTURES card's pending note (E1b)
- `src/styles/components/viewport.css` — `cursor: grab` / `grabbing`, `touch-action: none` on the canvas

## Done when

- [ ] `Mesh.setTransform` rebuilds every vertex from its source coordinates; `transformMesh` and `transformPt` no longer exist and nothing references them
- [ ] `Matrix3D.setAngle` and its mutable matrix fields are gone; the builders are pure and take degrees
- [ ] Setting PITCH / YAW / ROLL to 0 and SPIN to 0 leaves the shape motionless in its authored rest pose, and returning to the same three angles from any direction reproduces the same pixels
- [ ] Spin is frame-rate independent: the shape completes a revolution in the same wall-clock time at 60 fps and at a throttled 20 fps, and unpausing after 30 s does not jump
- [ ] The five presets land on their stated angles, ease rather than snap, zero the spin accumulator, and the chips never take an active state
- [ ] TOP puts the shape's top toward the eye and collapses the gizmo's Y axis to its 2px minimum
- [ ] `cam.pos` equals `target + Rᵀ·[0,0,-d]` — verify at rest (`0.0 0.0 -320.0` at the default zoom) and after a 90° yaw, where it must move onto the X axis
- [ ] `dist` stays positive across the whole zoom slider (560 → 80) and `cam.rot` stays inside (−180, 180]
- [ ] The gizmo tracks the drag every frame; the numeric readouts stay on the 90 ms gate
- [ ] Dragging the viewport orbits, and does so while paused; the TRANSFORM sliders and `uiState` follow the drag in the same frame
- [ ] Wheel zoom moves the zoom slider, never scrolls the page, works with `deltaMode: 1`, and treats `ctrlKey` wheel as zoom
- [ ] On touch: one-finger drag orbits, two-finger pinch zooms symmetrically in and out, double-tap resets angles, spin and zoom only — not shading, materials or toggles
- [ ] The toolbar RESET still restores every rig value (D7)
- [ ] During a shape transition both meshes hold the same orientation from the first frame
- [ ] The placeholder markers are gone from: the five view-preset chips, `cam.pos` / `cam.rot` / `target`, the gizmo, the desktop hint strip, the CAMERA card's POSITION and ROTATION rows, and the GESTURES card's three rows and pending note
- [ ] No `180 / Math.PI` appears in the rig, the input module or any widget this ticket touches
- [ ] This ticket does not resize the canvas and adds no new comment claiming the backing store is fixed (E9 owns resizing)
