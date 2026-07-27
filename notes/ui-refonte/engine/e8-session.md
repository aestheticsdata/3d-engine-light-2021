# Session actions and keyboard

Five toolbar buttons and eight shortcut chips currently document behaviour that does not exist: `grep -rn keydown src/` returns nothing, and STEP, CAPTURE PNG, SAVE PRESET, LOAD and COPY CODE are inert nodes carrying the placeholder affordance. This ticket adds the session layer — step a single frame while paused, export the framebuffer, save and load a scene preset, copy a snippet — and one `keydown` handler that dispatches through the same `SHORTCUTS` table the chips render from. Click and key paths share one action registry, so a chip can never name a key the handler does not bind, and a button can never do something no chip documents.

**Unblocks**

- STEP, CAPTURE PNG, SAVE PRESET, LOAD, COPY CODE — desktop action cluster and mobile action row, ten `data-placeholder="true"` nodes in total (toolbar ticket)
- The seven `pendingHandler` shortcut chips: `SPACE pause`, `W wireframe`, `C culling`, `R reset`, `S sky`, `F floor`, `1-N shape` (shortcuts ticket)
- Nothing else. The `G grid` chip stays `pendingFeature` until the ground-grid ticket, and the mobile GESTURES card is pointer work owned by the orbit-camera ticket.

## Approach

**One action registry.** New `src/ui/actions.ts` exporting `ActionId` (`stepFrame`, `capturePng`, `savePreset`, `loadPreset`, `copyCode`, `togglePause`, `toggleWireframe`, `toggleBackfaceCulling`, `resetControls`, `toggleSky`, `toggleFloor`, `selectPrimitive`), a `registerAction(id, fn)` / `runAction(id, arg?)` pair, and nothing else. `Main.init` registers the implementations. Buttons are bound by a single delegated `click` listener on `#app` reading `data-action` off `event.target.closest('[data-action]')` — that binds both branch mounts at once, the same way `setField` writes to every `[data-field]` node, and it means no ticket has to know that the toolbar exists twice in the DOM.

**The keyboard handler reads `SHORTCUTS`, not keys.** `src/ui/shortcuts.ts` (shortcuts ticket) already exports `{ keyLabel, keys, action, status, handler? }`; this ticket types `handler` as `ActionId`, adds `'live'` to the status union, and flips the seven pending-handler entries to `live`. One `window` `keydown` listener added in `Main.init` and removed in a new `destroy()`:

- Bail on `event.repeat`, on `event.ctrlKey || event.metaKey || event.altKey`, and when `event.target.closest('input, select, textarea, button, [contenteditable=""], [contenteditable="true"]')` matches. Without the last guard, SPACE with focus on the PAUSE button toggles twice — once from the button's native activation, once from the global handler.
- Match `event.key.toLowerCase()` against each binding's `keys`, skipping any entry whose status is `pendingFeature`. That is what keeps `G` inert without a special case: the chip and the dispatcher read one field.
- SPACE is `' '` and needs `preventDefault()` (it scrolls the page).
- Digits dispatch `selectPrimitive` with `Number(key) - 1`, resolved against `Object.keys(data)` and ignored when out of range, then `requestPrimitiveChange(name)`.
- Correction to carry into `src/ui/shortcuts.ts` while here: the range is derived as `1-${Object.keys(data).length}`, but there is no two-digit key. COS-201 adds roughly ten more polyhedra, so clamp the derivation to `Math.min(count, 9)` for both the label and the `keys` array, or the chip will promise `1-18`.

**STEP.** `renderFrame` early-returns while `!isPlaying` (`src/index.ts` L490–L492) and `renderPausedFrame` (L507) repaints without advancing anything. Extract the body of `renderFrame` into `advanceAndRender(now)` — transition update, `syncTransitionQueue`, the per-frame mesh transform, `surface3D.render` — and have `renderFrame` call it when playing and `stepFrame()` call it when paused. The transform step is `rotateMesh(renderable.mesh)` per renderable today; **E1 deletes `rotateMesh`** and replaces it with `rig.advance(dt)` plus one `mesh.setTransform(rig.matrix())` over `getActiveMeshes()`. Write `advanceAndRender` against whichever is in, and note that after E1 the synthetic clock below also drives the spin accumulator, so a step advances the turntable by exactly one frame's worth of degrees rather than a fixed per-frame delta. `stepFrame()` advances a synthetic clock rather than passing `performance.now()`:

- Seed `this.pausedClock = performance.now()` in `togglePause` on the stop branch.
- Each step: `this.pausedClock += FRAME_STEP_MS` (1000/60), then `advanceAndRender(this.pausedClock)`.

The synthetic clock is load-bearing. `StateMachine.createUpdate` computes progress as `(now - currentStateStartedAt) / duration` (`src/animations/StateMachine.ts` L116–L123), so stepping with wall-clock time after a thirty-second pause would complete a queued 1250 ms shape transition in a single step. On resume, `start()` already calls `transitionMachine.syncClock(performance.now())`, and `rebaseTime` shifts `currentStateStartedAt` by `now - lastUpdatedAt` (L97–L101) — `lastUpdatedAt` is the synthetic value the last step wrote, so the transition picks up exactly where stepping left it.

Step publishes `trisDrawn` and `frameMs` through `setField` (`stop()` zeroed both at L581–L583) but must **not** call `fpsCounter()`: that pushes into the one-second ring buffer and the FRAMERATE sparkline, and the fps readout is deliberately 0 while paused. Say so in a comment next to the call site.

**CAPTURE PNG.** `canvas.toBlob(blob => …, 'image/png')`, then an object URL on a synthetic `<a download>`, revoked on the next task. Use `toBlob`, not `toDataURL` — the data URL for a 1024 × 640 frame is a multi-megabyte string built synchronously on the main thread, and after the resizable-render-target ticket the backing store can be several times larger. Tainting is not a risk: `sky.avif`, `border-collie.jpeg` and `galaxy.jpeg` are imported through Vite (`src/index.ts` L13–L15) and resolve to same-origin URLs under `base: "/3dengine"`, and neither `loadImageAsset` (L57–L63) nor `loadTextures` (`src/textures/textures.ts`) sets `crossOrigin`, so the canvas is never tainted and `toBlob` will not throw `SecurityError`. Filename `3dengine-<primitive>-<yyyymmdd-hhmmss>.png`. Capture the current bitmap without re-rendering, so a paused frame exports exactly what is on screen.

**Preset save and load: a downloaded JSON file, not localStorage.** The toolbar draws SAVE PRESET and LOAD as two separate buttons, which only reads as export/import; a localStorage pair needs a slot picker the design does not contain, and this epic must not add a widget. File presets are also shareable and survive a cleared origin. Format `{ app: "3dengine", version: 1, savedAt, state }`, written through the same blob-download helper as CAPTURE. LOAD is a hidden `<input type="file" accept="application/json">` clicked programmatically, with `input.value = ''` before `click()` so re-selecting the same file fires `change` again.

New `src/ui/scenePreset.ts` owns one serialiser used by SAVE PRESET **and** COPY CODE, so the two can never disagree. `serialiseScene()` collects the current primitive key, the six slider values via `Controls.getNumericValue`, `wireframeEnabled`, `backfaceCullingEnabled`, and a snapshot of every registered `uiState` slice — add `snapshot()` / `hydrate(partial)` to the same slice registry that already backs `resetAll()` (shell ticket, D7), so a slice added by a later ticket is serialised without editing this module. `applyScene(preset)` validates before it touches anything: wrong `app` or `version` rejects outright, unknown keys are ignored, numbers are clamped to each input's own `min`/`max`, an unknown primitive falls back to the current one. Application order is `resetControls`'s order with file values instead of defaults — `Controls.setNumericValue` for the six sliders, `syncSettingsFromControls()` so `changeZoom` recomputes `zOffset` and `changeOpacity` recomputes the progress, `syncToggleButtons()`, `syncOpacitySliderAvailability()`, `requestPrimitiveChange(...)`, `renderPausedFrame()`.

**COPY CODE.** `navigator.clipboard.writeText(snippet)`, built from the same `serialiseScene()`:

```ts
// 3dengine BUILD 0.9.4 — 2026-07-27
applyScene({ primitive: "cuboctahedron", zoom: 50, pitch: 400, yaw: 400, roll: 200,
             rotationSpeed: 200, opacity: 100, wireframe: false, backfaceCulling: true });
```

**Feedback without a toast.** The console has no notification surface. Flash the pressed button's own label — `COPIED` for 1200 ms on success, `FAILED` for 1200 ms on a rejected clipboard write or a malformed preset, then restore the original `textContent` (including COPY CODE's escaped `</> COPY CODE`) — and `console.warn` the reason. One helper, used by all three fallible actions. This is a rebuild addition; the design has no button state, so record it in a code comment.

**Placeholder removal.** Drop `data-placeholder`, `title` and `aria-describedby` from the five buttons in both mounts and give each a `data-action`. Flip the seven `SHORTCUTS` entries to `live` so `shortcutsPanel.ts` stops applying the pending affordance to them.

## Constraints and risks

- Global key bindings are hostile to future text entry: once this lands, pressing `s` anywhere outside a form control toggles the sky. The focus guard is the only thing that makes that survivable, so every input a later ticket adds must be a real `<input>` / `<textarea>` or it will eat shortcuts.
- The listener is added once in `Main.init` and removed in `destroy()`. Vite HMR re-executing the module without a teardown double-binds and every key fires twice — wire `import.meta.hot?.dispose()` to `destroy()`.
- Stepping does not feed the fps ring buffer, so the FRAMERATE sparkline flatlines while the user steps. That is correct (there is no frame rate) but it looks like a bug; comment it.
- A step during a queued shape transition advances the transition by one frame, not to completion. Verify by pressing STEP ten times mid-switch and seeing ten frames of travel.
- Preset files are user-supplied JSON. Never `eval`, never assign a parsed value straight to `input.value` without clamping, never route one into `innerHTML`. Only the primitive key is a string, and it is checked against `Object.keys(data)`.
- Presets are not forward-compatible by construction: one saved before a later de-mock ticket adds a slice loads with that slice at its default. That is the intent — bump `version` only when a slice's *meaning* changes, not when one is added.
- `navigator.clipboard` needs a secure context and a user gesture; both hold for localhost, the https deploy and a button click. Do not add an `execCommand('copy')` fallback — flash `FAILED` instead.
- No layout change. The label flashes are all shorter than the labels they replace (`COPIED` vs `</> COPY CODE`, `FAILED` vs `SAVE PRESET`), so the action cluster only ever narrows; do not add a `min-width` to compensate.
- If this has to be split, the seam is [registry + keyboard + STEP] against [capture + preset + copy], which are all serialisation and file plumbing. Do not split the registry from the keyboard handler — the shared table is the entire point of the ticket.
- **Order.** E8 lands after E1 and after E5. E1 rewrites `renderFrame` and deletes `rotateMesh`, which is the body `advanceAndRender` extracts, and it also owns the frame clock and `requestRender()` that `stepFrame` must not duplicate; E1b additionally adds a `destroy()`-shaped teardown for its pointer listeners, and this ticket's `destroy()` should be the same one. E5 makes the `G grid` binding real, at which point its `SHORTCUTS` entry moves from `pendingFeature` to `pendingHandler` and this ticket's dispatcher picks it up with no edit — which is the point of gating on `status`. `serialiseScene()` snapshots every registered `uiState` slice, so every de-mock ticket that adds a slice is serialised automatically; that is why this ticket can land before or after E2, E3, E4, E6, E7 and E9 without touching them.

## Files

- `src/ui/actions.ts` — new; `ActionId`, the registry, the delegated `data-action` click listener
- `src/ui/scenePreset.ts` — new; `serialiseScene()`, `applyScene()`, the validator, the code snippet
- `src/ui/download.ts` — new; the blob → object URL → `<a download>` → revoke helper, shared by CAPTURE PNG and SAVE PRESET
- `src/ui/shortcuts.ts` — `handler` typed as `ActionId`, `'live'` added to the status union, seven entries flipped, the shape-key range clamped at 9
- `src/ui/shortcutsPanel.ts` — stop applying the pending affordance to `live` entries
- `src/ui/uiState.ts` — `snapshot()` / `hydrate(partial)` over the existing slice registry
- `src/index.ts` — `advanceAndRender(now)` extracted from `renderFrame`, `stepFrame()`, `pausedClock`, action registration, the `keydown` listener, `destroy()`
- `src/index.html` — `data-action` on all ten action-button nodes, placeholder attributes removed, the hidden file input added

## Done when

- [ ] Exactly one `keydown` listener exists in the repo, added in `Main.init` and removed in `destroy()`; `grep -rn "keydown" src/` returns the one `addEventListener` and its `removeEventListener`
- [ ] All seven live chips act on their key; `G` does nothing and keeps its placeholder affordance
- [ ] No key string appears outside `SHORTCUTS` — not in the markup, not in `src/index.ts`, not in the CSS
- [ ] Keys are ignored while focus is inside an input, select, textarea or button, while ctrl/meta/alt is held, and on auto-repeat; SPACE with the PAUSE button focused toggles the loop exactly once
- [ ] STEP advances exactly one frame while paused: the drawn-triangle count and frame time update, the fps readout stays 0, uptime keeps its own clock, and ten presses mid-transition advance the shape switch by ten frames instead of completing it
- [ ] STEP is a no-op while the loop is running
- [ ] CAPTURE PNG downloads a PNG matching the canvas backing store, throws no `SecurityError`, and does not freeze the tab
- [ ] SAVE PRESET downloads JSON; LOAD restores every slider, both flags, the primitive and every registered `uiState` slice in one repaint; loading the same file twice in a row works
- [ ] A malformed, foreign-`app` or wrong-`version` file leaves the scene untouched and flashes `FAILED`
- [ ] COPY CODE writes a snippet built from the same `serialiseScene()` as SAVE PRESET, flashes `COPIED`, and restores the escaped `</> COPY CODE` label exactly
- [ ] `data-placeholder`, `title` and `aria-describedby` are gone from all ten action-button nodes in `src/index.html`, and the remaining `data-placeholder` hits belong only to other de-mock tickets
- [ ] Adding a ninth and a tenth primitive to `src/data/data.ts` leaves the chip reading `1-9` and binds no two-digit key
- [ ] `npm run build` passes
