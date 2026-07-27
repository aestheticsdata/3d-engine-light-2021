# Scene model: real scene objects, per-object visibility, selection and projected bounds

The console presents a scene of four objects; the engine has one mesh and a background painter. The scene graph renders three hardcoded placeholder rows, SHAPE INFO's kind note is the literal `MESH`, the status bar's selected id follows the active primitive rather than the selection, and the viewport's selection bracket is a fixed percentage rectangle that ignores the geometry it claims to bracket. This ticket introduces object identity — a `Scene` of `SceneObject`s with a kind, an id, a visibility flag and a per-object info record — and drives every one of those surfaces off it. `Surface3D.render` already takes an array of renderables, so the rendering side is close to free; what is missing is everything above it.

**Unblocks**

- Scene-graph rows 2 to 4 (`PLN FLOOR_01`, `ENV SKY_DOME`, `LGT KEY_LIGHT`) and their `data-placeholder="true"` markers (scene-graph)
- The visibility toggles on rows 2 and 3, which today flip a glyph and change nothing on canvas (scene-graph)
- SHAPE INFO's header kind note, currently the constant literal `MESH` (shape-info)
- The info/story swap when a non-mesh object is selected — the mockup's `STATIC_INFO` behaviour, which the scene-graph ticket recorded as "selecting rows 2–4 changes nothing else" (scene-graph, shape-info, shape-story)
- The status bar's `<id> selected` segment, whose multi-object case is marked as owned here (status)
- The viewport selection bracket rect, hardcoded at `left: 39.2%; top: 31.9%` with a 190px square desktop / `22.4% × 35.8%` mobile (viewport-hud)

## Approach

### The model

New `src/scene/`:

- `SceneObject.ts` — `interface SceneObject { id: string; kind: "MSH" | "PLN" | "ENV" | "LGT"; visible: boolean; triangleCount: number | null; renderables(): MeshRenderRequest[]; bounds(): ScreenRect | null; info: SceneObjectInfo }`. `triangleCount: null` renders as the em dash the scene-graph row already handles for a zero count.
- `Scene.ts` — the ordered object list, `byId()`, and `renderables()` returning the flattened, visibility-filtered `MeshRenderRequest[]`. That array is what goes into `Surface3D.render` (`src/primitives/Surface3D.ts` L23–L48), which needs no change at all: it iterates whatever it is handed and draws the background first (L27), so a hidden mesh still leaves sky, floor and vignette.

Four objects, in the design's fixed order:

- `MeshObject` — wraps `ShapeTransitionMachine`; `renderables()` delegates to `getRenderables()` (`src/animations/shapeTransitionMachine.ts` L192–L194); id from `sceneObjectId(primitiveKey)` (shell's module, D5); `triangleCount` is the **drawn** count (D6).
- `FloorObject` (`PLN`, `FLOOR_01`) and `SkyObject` (`ENV`, `SKY_DOME`) — not geometry. `BackgroundRenderer.render()` (`src/rendering/BackgroundRenderer.ts` L16–L26) unconditionally draws sky, atmosphere, floor and vignette in canvas space. Their `renderables()` returns `[]` and their `triangleCount` is `null`, which is the honest answer: the checker floor is 144 columns × 57 rows of canvas quads (L86, L95, L101–L121), not two triangles as the mockup claims. Visibility binds to `BackgroundRenderer.setLayers({sky, floor})` — **owned and shipped by the world-tab ticket** (D11), which carries it as a hard deliverable with its own acceptance criterion. Consume it; this ticket does not ship a fallback copy, and neither does E5, which widens the same object to `{sky, floor, grid, shadow}`. There is exactly one switch and world-tab owns it.
- `LightObject` (`LGT`, `KEY_LIGHT`) — the engine has no lighting model. It becomes a real object with a real id, a real info record and a real place in the list, but its visibility flag drives nothing until E3 ships shading. Narrow the placeholder marker to the visibility button alone and name E3 in its `title`; do not claim the row is fully live.

### Per-object info records

The mockup's `STATIC_INFO` has no repo equivalent, so build one: `SceneObjectInfo { kindLabel: string; rows: { label: string; value: string }[]; story: { title: string; paragraphs: string[]; footer: { label: string; value: string }[] } }` in `src/scene/sceneObjectInfo.ts`.

Every value must be derived from an engine constant, with the constant named in a code comment. Nothing invented:

- Mesh — exactly what `syncShapeInfoPanel` computes today (`src/index.ts` L283–L315): NAME, POINTS, TRIANGLES (registry count), TEXTURES via `textureNames()`, OPACITY, plus SHADING and MATERIAL; story from `shapeInfo[key]`.
- Floor — cell size `3.4 × 4.2` (BackgroundRenderer L81–L82), `COLUMNS 144` (L86 `halfColumns = 72`, doubled), `HORIZON 0.57 h` (L77), `FOCAL 0.95 w` (L79), `CAMERA 1.75` (L80). Export those constants from `BackgroundRenderer` rather than retyping them. **Every one of them is deleted or re-derived by E5a**, which puts the floor under the scene camera: the horizon moves to `vpY`, the focal becomes the camera's, the centre moves from `0.6 w` to the canvas centre, and the cell size becomes the grid step in metres. If E5a is in, write the record against the new constants; if it is not, write it against these and expect E5a to update it. Do not let the record become the only surviving reference to a hand-tuned constant nobody uses any more.
- Sky — gradient stop count and the four stops (L30–L33), bitmap coverage `0.62 h` (L41), `ALPHA 0.90` (L52).
- Light — `MODEL none`, `CONTRIBUTION none`, and a story paragraph saying the renderer is unlit until E3. A truthful empty record beats a plausible fake one.

### Selection drives the panels

`uiState.sceneSelection` already exists (shell, D2; the scene-graph ticket writes it). SHAPE INFO and SHAPE STORY currently ignore it and stay bound to the active primitive. Subscribe both to the selection and render the selected object's record. Three things this must not break:

1. **The fade.** `animateShapeInfoPanel` (`src/index.ts` L334–L358) runs a 180ms fade-out, swaps the text, then fades in, on `#shapeInfoPanelContent` which the shape-info ticket kept wrapping both cards. Selection change must reuse that same path, not a second animation.
2. **The element-id contract.** `Main`'s constructor resolves **22** ids via `getElementById` and throws `"UI controls are missing."` if any is absent (`src/index.ts` L130–L177; D2 and the shell ticket both say 21 and are off by one — the 22nd is `opacitySlider`, which is additionally narrowed to `HTMLInputElement`). They include `shapeInfoName`, `shapeInfoPoints`, `shapeInfoTriangles`, `shapeInfoTextures`, `shapeInfoOpacity` and the shape-info ticket's `shapeInfoKind` / `shapeInfoShading` / `shapeInfoMaterial`. Making the row list data-driven means the labels stop being literal markup — the shape-info ticket writes them literally on purpose. Preferred path: render `.info-row` pairs from the record into `.info-list`, keep the legacy ids on the mesh template's value spans, and migrate those five constructor lookups out of the constructor in the same change. It touches D2's contract, so coordinate it explicitly in the PR; the fallback is keeping the ids and accepting a mesh-shaped template.
3. **Opacity writes.** `changeOpacity` calls `syncShapeInfoOpacity()` (`src/index.ts` L261–L270, L279–L281), which writes straight into `shapeInfoOpacityNode` on every slider input. With a non-mesh object selected that row means something else. Route the write through the selected object's record so it is dropped when the mesh is not selected.

Two rules survive from the UI epic: picking a primitive returns selection to the mesh row (D11), and the mesh row keeps one id and one row through the 1250ms transition even though `getRenderables()` returns two meshes (`shapeTransitionMachine.ts` L96–L126) — the id flips when `currentPrimitiveName` does (`src/index.ts` L468–L488) and the count is the sum.

The status bar reads the same selection through `setField` rather than the active primitive.

### Screen-space bounding box

The bracket needs the projected AABB of the selected object. For the mesh, take it from the points, not the triangles: `Mesh` holds `points` and `triangles` separately (`src/primitives/Mesh.ts` L5–L6) and the current code projects each `Point3D` once per incident triangle — roughly five times over. One pass over `this.points` is 143 projections on the sphere against its 720 (240 triangles × 3), and 3960 on the torus knot against its 23760.

Add `Point3D.project(out: {x: number; y: number}): boolean` writing into a reused object and returning `false` when the denominator is not positive, and have `convert3D2D()` (`src/primitives/Point3D.ts` L28–L34) call it so the projection formula exists once. The guard is not theoretical: `scale = fl / (fl + z + zOffset)` with `DEFAULT_FOCAL_LENGTH = 300` (`src/index.ts` L20) and `zOffset = -220` at maximum zoom (L25) gives a denominator of `80 + z`, and the sphere spans ±100 (`src/data/shapes/sphere.ts` L4) while the torus knot spans ±116 (`src/data/shapes/torusKnot.ts` L8–L10). At full zoom both shapes put vertices behind the eye, where the projection inverts and an unguarded min/max produces an infinite or flipped box. Skip those vertices; if fewer than three survive, hide the bracket for that frame.

Then `Mesh.projectedBounds(offsetX, offsetY): ScreenRect | null` accumulates min/max, clamped to the render target's extent (`[0, 1024] × [0, 640]` today, `src/index.html` L57, but read it from the shared target — E9 makes it fluid) so a partly off-screen mesh cannot push the bracket outside the card. If E6 has landed, take the bounds from its transform pass instead of adding a second projection loop; E5b's `Mesh.getBounds()` is a third fold over the same array. The three tickets should not each walk the geometry.

The HUD consumes it as percentages of the stage — `left = minX / 1024 * 100`, `top = minY / 640 * 100`, and likewise for width and height — written as four custom properties (`--sel-left`, `--sel-top`, `--sel-w`, `--sel-h`) on the bracket element, with `viewport.css` consuming them. Same markup, same absolute positioning, no layout change, and the mobile percentage box works identically.

Update the bracket **every frame**, not on the 90ms display gate: it is four custom-property writes on one element, far cheaper than a single triangle fill, and at 90ms the bracket visibly trails a rotating mesh. Say so in the code next to the write, because every other telemetry value in this console is deliberately throttled.

Non-mesh objects: `FLOOR_01` brackets the region below the horizon (`top = 0.57 × h`, BackgroundRenderer L77, full width); `SKY_DOME` brackets the whole stage; `KEY_LIGHT` has no position, so the bracket and its label badge are hidden until E3 gives it one.

### This is large — split it

1. Scene model, scene-graph rows, per-object visibility. No panel changes; the info panels stay bound to the mesh.
2. Per-object info and story records plus the selection swap. Touches the constructor id contract, so it carries the boot risk.
3. Projected selection bounds. Independent of 1 and 2 for the mesh case and can land first or last.

## Constraints and risks

- **`Surface3D.render` draws the background unconditionally** before iterating renderables, so floor and sky visibility can only be honoured inside `BackgroundRenderer`, never by filtering the renderables array. Mesh visibility is the opposite: filter before the call.
- **One `setLayers`, one owner.** D11 assigns it to world-tab. Two switches for the same layer is the failure mode here; toggling from either surface must move the other.
- **The boot path can break loudly.** The constructor throws if any of the 22 ids is missing; a data-driven info list that drops one takes the whole app down at startup rather than degrading. Verify boot before and after in both branches, and correct D2's "21" in the shell ticket in the same PR.
- **Selection must not interfere with the render loop.** Selecting a light while a shape transition is running, or switching shape while a light is selected, both have to be exercised — the fade timeout (`src/index.ts` L334–L358) and the transition queue (L468–L488) are independent state machines and this ticket now couples a third input to both.
- **Cost**: one extra pass over `Mesh.points` per frame for the AABB — 5 points on the pyramid, 143 on the sphere, 4224 on the Menger sponge, which is the registry maximum — against a triangle loop several times larger. Negligible, but do not let it become per-triangle, and prefer E6's transform pass if it has landed.
- **No layout changes.** Non-mesh records must fill the same seven-row shape SHAPE INFO ships; a record with four rows changes the card height and that is a bug in this ticket, not a licence to redesign.
- **Do not invent copy.** If a value for the floor, sky or light cannot be traced to a constant in the source, the row does not ship.
- **Order.** E7 lands last of the rendering tickets — after world-tab, E5, E6, E3 and E2. World-tab ships the `setLayers` this ticket binds visibility to; E5 widens it and re-derives every floor constant this ticket's `FloorObject` record quotes; E6 supplies the transform pass the projected AABB should reuse and the `RenderStats` return that shares this ticket's two call sites (`src/index.ts` L500, L512); E3 gives `KEY_LIGHT` something to switch off, which is why its visibility button keeps a narrowed marker until then; E2's near plane is the honest version of the `denominator > 0` guard `Point3D.project(out)` needs. Nothing downstream depends on E7.

## Files

- `src/scene/Scene.ts` — new: ordered object list, `renderables()`, `byId()`
- `src/scene/SceneObject.ts` — new: the interface and `ScreenRect`
- `src/scene/objects/MeshObject.ts`, `FloorObject.ts`, `SkyObject.ts`, `LightObject.ts` — new
- `src/scene/sceneObjectInfo.ts` — new: the per-object info and story records
- `src/primitives/Mesh.ts` — `projectedBounds()`
- `src/primitives/Point3D.ts` — `project(out)` with the denominator guard; `convert3D2D()` delegates to it
- `src/rendering/BackgroundRenderer.ts` — export the floor and sky constants; `setLayers({sky, floor})` if world-tab has not shipped it
- `src/index.ts` — construct the `Scene`, render `scene.renderables()` at L500 and L512, publish selection and bounds, route the opacity write through the selected record, reset selection on primitive change
- `src/ui/sceneGraph.ts` — rows built from `Scene` instead of the hardcoded four; remove the row 2–3 placeholder markers
- `src/ui/uiState.ts` — selection and per-object visibility slices
- `src/ui/viewportHud.ts` — bracket rect and label from the selection; delete the placeholder constants
- `src/ui/statusBar.ts` — selected id from the selection
- `src/styles/components/viewport.css` — bracket consumes `--sel-*`; delete the hardcoded percentages and the 190px square in both branches
- `src/index.html` — SHAPE INFO row template becomes the record's render target

## Done when

- [ ] `Scene` holds the four objects in the design's order, `Surface3D.render` receives `scene.renderables()`, and hidden objects never reach it
- [ ] Scene-graph rows 2 to 4 render id, kind and count from scene objects; `data-placeholder="true"` is gone from rows 2 and 3 and from both their visibility buttons
- [ ] Row 4 is a real object with a real id and info record; only its visibility button keeps a narrowed marker naming E3
- [ ] Hiding `FLOOR_01` removes the checker floor and hiding `SKY_DOME` removes the sky gradient and bitmap, both through the single `BackgroundRenderer.setLayers`; toggling the same layer from the world tab moves the scene-graph row and vice versa
- [ ] Floor and sky rows show the em dash rather than a fabricated triangle count
- [ ] SHAPE INFO's header note shows the selected object's kind and the literal `MESH` placeholder is gone
- [ ] Selecting a non-mesh row swaps SHAPE INFO's rows and SHAPE STORY's prose to that object's record through the existing 180ms fade, with unchanged card height and no row wrapping at 320px
- [ ] Every non-mesh row value is traceable to a named engine constant in a code comment
- [ ] Dragging the opacity slider with a non-mesh object selected does not write into the panel
- [ ] The status bar's `<id> selected` follows the scene selection, not the active primitive
- [ ] Picking a primitive returns selection to the mesh row, and the mesh row keeps one id and a summed count through the 1250ms transition
- [ ] The viewport bracket tracks the projected AABB of the selected mesh every frame, and the hardcoded `39.2% / 31.9%` origin, the 190px desktop square and the `22.4% × 35.8%` mobile box are gone from `viewport.css`
- [ ] The bracket stays finite and inside the stage at maximum zoom on the torus knot, where vertices cross the projection singularity, and hides when fewer than three vertices survive the guard
- [ ] `FLOOR_01` brackets below the horizon, `SKY_DOME` brackets the stage, `KEY_LIGHT` hides the bracket and its label badge
- [ ] The app still boots — the constructor's element-id contract resolves — after the info panel becomes data-driven, verified on a cold load in both branches
- [ ] Selecting a light mid-transition and switching shape with a light selected both leave the panels, the fade and the transition queue in a consistent state
