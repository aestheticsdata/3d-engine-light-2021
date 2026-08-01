# Projection: orthographic, FOV and clip planes

`Point3D.convert3D2D` is four lines of perspective divide with a hardcoded focal length and no view volume at all: no second projection, no field of view, and nothing stopping a vertex behind the eye from projecting to a mirrored point on screen. That last one is not hypothetical — at the far end of the zoom slider a sphere of radius 100 already straddles the eye plane, which is why `world-tab` had to clamp focal length to 260 and cap FOV at about 102°. This ticket adds an orthographic path, a real FOV control with dolly compensation, and near/far planes, turning the console's whole projection column from decoration into engine state.

**Unblocks**
- The PERSPECTIVE / ORTHOGRAPHIC button pair — `world-tab`
- The FOV slider's full 15..120 range and the removal of its focal ≥ 260 clamp — `world-tab`
- The projection HUD chip — `viewport-hud`
- The status bar's projection segment — `status`
- The CAMERA card's NEAR / FAR row, which `camera` had to relabel FOCAL / OFFSET, and its FOV / ASPECT row, which was a constant — `camera`

## Approach

### One parameter unifies both projections

The current divide is `scale = fl / (fl + z + zOffset)`. Re-parameterise the zoom offset as a **magnification** `k`, the scale the subject gets at its own centre plane `z = 0`:

```
k = fl / (fl + zOffset)      ⇔      zOffset = fl · (1 − k) / k
```

Substituting back and letting `d = z + fl/k` be the vertex's depth in front of the eye:

```
perspective:   scale(z) = k · fl / (fl + k · z) = fl / d
orthographic:  scale(z) = k                              (the fl → ∞ limit of the above at fixed k)
```

That is the whole ticket's mathematical content. `fl / d` is the README's similar-triangles form written honestly; orthographic is not a different pipeline but the same expression with the depth term removed, which is exactly what "parallel projection" means — as the eye recedes to infinity while the magnification is held, every ray becomes parallel and `scale` stops depending on `z`. Both branches are one line in `convert3D2D`; the projected point stays `vpX + x·scale`, `vpY + y·scale`.

**Zoom is unchanged at the default FOV, by construction.** Keep `sliderToZoomOffset` as the definition *at the reference focal* and derive `k` from it: `k(v) = FL_REF / (FL_REF + sliderToZoomOffset(v))` with `FL_REF = DEFAULT_FOCAL_LENGTH = 300`. At `fl = 300` the new formula collapses algebraically to the old one — `k·fl/(fl + k·z)` with `k = 300/(300+zo)` reduces to `300/(300 + zo + z)` — so the whole slider range, 260 down to −220, is bit-identical to today. The slider keeps its 0..100 range and its default of 50 (`k = 0.9375`).

### FOV, and dolly compensation

The engine has a focal length; the console asks for an angle. At today's 1024 × 640 the vertical half-height is 320, so:

```
fl  = (canvas.height / 2) / tan(fov / 2)
fov = 2 · atan((canvas.height / 2) / fl)
```

`DEFAULT_FOCAL_LENGTH = 300` is therefore a **93.7° vertical** field (horizontal would be 119.3°; always say which), at aspect 1024/640 = 1.60. Slider 15..120 maps to focal 2430.6 down to 184.8. Read the render target's dimensions rather than hardcoding 320 and 1.60, and **recompute them on a size change rather than once at boot** — E9 makes the backing store fluid, and E9 stage one's `renderTarget` module is where the half-height and the centre live. If E9 stage one has not landed, read the canvas at boot but keep the derivation in one function so E9 has a single call site to convert. Note that E9's `scale` multiplies *after* the perspective divide precisely so vertical FOV stays 93.7° at any size, which is what keeps this mapping resolution-independent.

Because `k` is now the thing the zoom slider owns, dolly compensation is free: hold `k` and recompute `zOffset = fl·(1 − k)/k` whenever `fl` changes. The subject's apparent size at its centre plane stays put while the perspective falloff around it opens or flattens — a dolly zoom, which is what a FOV control is supposed to feel like and what `world-tab` explicitly deferred here. Worked example at the default zoom (`k = 0.9375`): FOV 120° gives `fl = 184.8`, `zOffset = 12.3`, eye distance 197; FOV 15° gives `fl = 2430.6`, `zOffset = 162.0`, eye distance 2592.6. The sphere's silhouette is the same width in both; its near and far faces are not.

The FOV slider is an integer, so the default of 94 yields `fl = 298.4` rather than 300 — under 0.1px of difference at the sphere's extremes. Note it rather than chasing it.

### A shared camera record

Projection state currently lives *per vertex*: `fl` and `zOffset` are public fields on every `Point3D`, written by `Triangle.changeFocal` / `changeOffsetZ` looping through `Mesh`, which is 3960 field writes per zoom tick on the torus knot and would become five fields per vertex once mode, `k`, near and far join them. Replace it with one mutable record the points hold a reference to:

```
{ mode: "perspective" | "orthographic", fl, k, near, far, vpX, vpY }
```

`Mesh.changeFocal` / `Mesh.changeOffsetZ` and their `Triangle` counterparts collapse into `Mesh.setCamera(record)`, and `Main.applyCameraSettings` becomes a single assignment. Fold `vpX` / `vpY` in while you are there: `Point3D`'s constructor currently runs `document.querySelector("canvas")` once *per point*, so building the torus knot issues 3960 DOM queries (one per vertex). **E9 stage one removes the same query by pointing `Point3D` at a shared `renderTarget`** — that is one deletion, not two. Whichever lands first owns it; if E9 is in, this record holds `mode`, `fl`, `k`, `near` and `far` and reads the centre from `renderTarget` instead of carrying `vpX` / `vpY` itself.

### Near and far

`d = z + fl/k` is the depth in front of the eye. The projection is singular at `d = 0` and changes sign for `d < 0`, which is why a vertex behind the eye lands mirrored across the vanishing point instead of disappearing. Add `near` and `far` to the record and reject in `Triangle.render`, before projection: if any of the three vertices has `d < near` or `d > far`, return `false`.

Defaults: `near = 1`, `far = 2000`. Shapes are authored at radius ~100–120 (`SPHERE_RADIUS = 100`, the torus knot's largest extent ~116), and eye distance runs 560 down to 80 across the zoom slider at the default FOV, so the farthest vertex is ~680 — the far plane is inert at defaults, which is what it must be. The near plane is not inert: at zoom 100 the sphere's near cap sits at `d = -20` today and renders as mirrored garbage, and after this ticket it is clipped away instead. Both values are readouts, not sliders — `camera`'s NEAR / FAR row prints them and its FOCAL / OFFSET relabel is reverted.

Reject-per-triangle, not clip-per-triangle: a triangle straddling the near plane is dropped whole, so the artefact becomes a hole rather than a smear. **Real near-plane clipping is a follow-up ticket (E2b).** Sutherland–Hodgman against one plane in camera space turns a straddling triangle into one or two new triangles, which means `Triangle.render` has to emit geometry it does not own *and* interpolate UVs for the textured case (`src/primitives/Triangle.ts` L162–L225) and pick a material for the fragments. That is a real piece of work and does not belong bolted onto this one. Say so in the ticket rather than promising it here.

### The widgets

`projection` joins `uiState`; the PERSPECTIVE / ORTHOGRAPHIC pair, the HUD chip and the status-bar segment all read it and drop their placeholder markers. The CAMERA card's FOV / ASPECT row becomes live on the FOV slider (aspect stays constant at 1.60). DISTANCE stays `fl / k` in both modes — the rig's eye distance is still defined in orthographic, it just stops governing apparent size; note that in the widget so nobody "fixes" it to read `∞`.

## Constraints and risks

- **The background does not follow.** `BackgroundRenderer.renderFloor` is a hardcoded canvas-space perspective checker with its own focal (`this.width * 0.95`) and horizon (`0.57 · height`). It ignores `fl`, `k` and the projection mode entirely, so in orthographic the geometry goes parallel while the floor keeps its vanishing point, and at FOV 15° or 120° the floor's perspective no longer matches the shape's. This is the most visible cost of the ticket. Do not attempt to re-derive the background here — it is scene-space work that belongs with the ground-grid/world-units de-mock ticket. State the mismatch and, if it reads badly in review, the fallback is to hide the checker floor in orthographic.
- Backface culling is unaffected. `Triangle.render`'s test is the sign of the projected 2D cross product, and both projections are orientation-preserving for `scale > 0`, which the near plane now guarantees.
- The painter's-algorithm sort in `Mesh.renderMesh` is on `Triangle.depth` (mean vertex `z`) and is independent of projection — unchanged.
- Affine texture mapping becomes *exact* in orthographic: there is no perspective foreshortening left to approximate, so the warping that `builder.ts` subdivides quads to hide simply is not there. The subdivision stays and is harmless, but the difference in texture quality between the two modes will be visible on the cube and is worth expecting.
- Clipped triangles are not drawn and so are not counted by `Surface3D.render`. D6 derives *culled* as `registry − drawn`; that difference now folds in clipped triangles as well as the degenerate-UV skips it already over-counts. Widen the caveat in the geometry ticket rather than leaving it claiming culling alone.
- `world-tab`'s focal ≥ 260 clamp and its "FOV above roughly 102° is clamped" note are deleted by this ticket, and its acceptance criterion naming the clamp is superseded. The whole 15..120 range becomes usable precisely because the near plane exists.
- Per-frame cost is one extra add and one compare per vertex for the depth test (~12k operations on the torus knot, noise) and one fewer divide per vertex in orthographic. The camera record removes the per-zoom-tick write storm entirely.
- **Order.** E2 lands after E9 stage one and before E1, E3, E4 and E5. E9 stage one moves the viewport centre and the per-point canvas query into a shared `renderTarget`; this record then holds only projection state. E1's rig reads eye distance — once this ticket lands that value is `fl / k` and must come from the record, not from `fl + zOffset` recomputed locally. E3b's `1/w` depth key becomes `1/d` with `d = z + fl/k`, and its near epsilon is superseded by this ticket's near plane. E4a caps mesh scale only until this near plane exists, then deletes the cap. E5a's ground projector needs the orthographic branch defined here — under orthographic the ground has no vanishing point and the grid degenerates to parallel lines, which is this ticket's branch to specify. Five tickets rewrite `convert3D2D` (E2, E4, E5 reads it, E7, E9); this one owns the expression, the others fold into it.
- This ticket does not resize the canvas and does not change what `BackgroundRenderer` and `ShapeTransitionMachine` were constructed with. Do not write a comment asserting the backing store is fixed — E9 makes it fluid.

## Files

- `src/primitives/Camera.ts` — new; the shared mutable camera record, the `fov ↔ fl` conversions, `k(sliderValue)`, and the `zOffset = fl(1−k)/k` compensation
- `src/primitives/Point3D.ts` — hold the camera record instead of per-point `fl` / `zOffset` / `vpX` / `vpY`; the two-branch `convert3D2D`; expose `cameraDepth`
- `src/primitives/Triangle.ts` — near/far rejection before projection; `changeFocal` / `changeOffsetZ` replaced by the record
- `src/primitives/Mesh.ts` — `setCamera(record)` replaces `changeFocal` / `changeOffsetZ`
- `src/index.ts` — own the camera record; `changeZoom` writes `k`; new `changeFov` and `changeProjection` mirroring it, both calling `renderPausedFrame`; `applyCameraSettings` collapses to one assignment
- `src/ui/inspector/worldTab.ts` — the projection pair becomes stateful and real; the FOV slider drops its clamp and its placeholder marker
- `src/ui/uiState.ts` — `projection` and `fov` become engine-backed
- `src/ui/viewportHud.ts` — projection chip reads `uiState.projection`
- `src/ui/statusBar.ts` — projection segment reads the same value
- `src/ui/telemetry/CameraWidget.ts` — NEAR / FAR restored, FOV / ASPECT live on the slider

## Done when

- [ ] At FOV 94 the first frame and the entire zoom range are visually identical to today, and the `k` identity (`k·fl/(fl + k·z) ≡ fl/(fl + zOffset + z)` at `fl = FL_REF`) is written out in a comment next to the mapping
- [ ] ORTHOGRAPHIC drops the depth divide: faces of equal size at different `z` project at equal size, and switching modes at any zoom does not change the subject's size at its centre plane
- [ ] The FOV slider covers 15..120 with no focal clamp anywhere, and `fl = (canvas.height/2)/tan(fov/2)` reads the canvas rather than a literal
- [ ] Dolly compensation holds: sweeping FOV from 15 to 120 keeps the shape's silhouette width constant while visibly changing its perspective falloff
- [ ] FOV / ASPECT reads 93.7° / 1.60 at the default and tracks the slider; both are derived from the canvas, not hardcoded
- [ ] NEAR / FAR shows 1 / 2000 and the row is no longer labelled FOCAL / OFFSET
- [ ] At zoom 100 the sphere's near cap is clipped away instead of projecting mirrored, and no drawn triangle has a vertex with `d ≤ 0`
- [ ] The far plane changes nothing at any default setting
- [ ] Backface culling, the painter's sort and textured triangles all still work in both projections
- [ ] Projection state lives in one record shared by every point; `Point3D` no longer queries the DOM in its constructor and `Triangle.changeFocal` / `changeOffsetZ` are gone
- [ ] `Surface3D.render`'s return value counts drawn triangles only, and the geometry ticket's culled derivation is updated to say it now includes clipped triangles
- [ ] The placeholder markers are gone from: the ORTHOGRAPHIC button, the FOV slider, the HUD projection chip, the status-bar projection segment, and the CAMERA card's NEAR / FAR row
- [ ] The orthographic/background mismatch is documented in `BackgroundRenderer` with the ticket that owns fixing it
- [ ] E2b (near-plane polygon clipping with UV interpolation) is filed and linked
