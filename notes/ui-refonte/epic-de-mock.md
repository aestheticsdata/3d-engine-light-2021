Parent issue for the second wave of the UI refonte: replacing every placeholder the new console renders with real engine data. **One sub-issue per engine capability**, not per widget — a single capability usually lights up several widgets at once.

Blocked by the UI epic: the chrome has to exist before there is anywhere to put real numbers.

## Why this epic exists

The redesign shows a full software-rasteriser workstation. The engine behind it is smaller than that: it draws one mesh with painter-order triangles, a wireframe flag, a backface-culling flag and an opacity value, over a fixed sky-and-checker-floor backdrop. Everything else in the console — shading modes, lighting, projection, depth statistics, scene objects, the frame-time breakdown — is drawn from placeholders.

That was a deliberate split. The UI epic builds the whole console at once so the layout is designed once and reviewed once; this epic then makes it true, one capability at a time, without touching layout again.

## Rules

- A sub-issue is Done when every placeholder it owns is gone from the console and the widget reads live data on both desktop and mobile.
- No layout changes. If a real value does not fit the box the UI epic built, that is a bug in this epic's sub-issue, not a licence to redesign the widget.
- Placeholders are visibly marked in the UI epic's work, so "what is left" is always readable off the running app.

## Sub-issues

| Key | Sub-issue | Unblocks, in one line |
| -- | -- | -- |
| E1 | Camera rig: absolute transform and orbit input | view presets, the camera readouts, the gizmo, drag-orbit, degree-labelled transform sliders |
| E2 | Projection: orthographic, FOV and clip planes | the PERSPECTIVE/ORTHOGRAPHIC pair, the FOV slider, NEAR / FAR, the projection chip |
| E3 | Shading pipeline: normals, lighting, depth buffer and pipeline flags | 5 of 6 shading chips, all 4 lighting sliders, the key-light row, Z-BUFFER / DITHERING / EDGE AA |
| E4 | Materials: runtime texture, base colour and mesh scale | the texture chips, the base swatches, UV SCALE, SCALE, the MATERIAL row |
| E5 | World layers: grid, ground shadow, fog and world units | the ENVIRONMENT toggles, FOG, GRID STEP, 3 quick toggles, the units segment |
| E6 | Renderer instrumentation: staged timings, draw calls, fill rate and depth bins | the FRAME TIME breakdown, FILL RATE, DRAW CALLS, the Z-BUFFER histogram |
| E7 | Scene model: real scene objects, per-object visibility, selection and projected bounds | scene-graph rows 2-4, per-object info, the viewport selection bracket |
| E8 | Session actions and keyboard | 5 toolbar buttons and all 8 shortcut chips |
| E9 | Resizable render target | a fluid viewport, the resolution chip, honest BUFFER rows, DPR-correct rendering |

Four of the nine propose an internal split rather than pretending they are single-sitting work; E3 in particular forces owning the rasteriser, because Canvas 2D cannot depth-test a `context.fill()`. The working order from the cross-ticket audit:

```
E9a  decouple projection from the canvas (render target, rate neutrals)
E2   projection: camera record, orthographic, FOV, near/far
E1a  absolute orientation, view presets, camera readouts
E1b  pointer orbit, wheel, pinch
E6   instrumentation: Triangle split, RenderStats, depth bins
E4a  material model, base colour, mesh scale
E3a  face normals and the directional key light
E3b  depth-buffered rasteriser
E3c  GOURAUD / DEPTH / NORMALS / POINTS
E3d  dithering, edge antialias
E4b  procedural textures, spherical UVs, tiling
E5a  ground under the camera, grid, world units
E5b  ground shadow, fog, layer-pass count
E7   scene model, per-object info, projected bounds
E8   session actions and keyboard
E9b  resize, DPR, pixel budget
```

E9 spans the whole epic on purpose: stage one has to land first because everything downstream assumes the projection is no longer welded to a 1024x640 canvas, and stage two cannot land until the passes it resizes exist. Worth filing the two stages as separate issues.

## Notes that cut across several sub-issues

- **Painter's algorithm, not a depth buffer.** `Mesh.renderMesh` sorts its triangles back-to-front by centroid depth (`src/primitives/Mesh.ts:19`) and then calls `Triangle.render` on each. That is a real depth ordering, but a per-mesh, per-centroid one: it composites the two meshes held mid-transition in array order rather than interleaved, it orders wrongly on interlocking geometry (menger, cross, torusKnot), and it costs roughly 103k getter-heavy comparisons per frame on the torus knot. Anything depth-*exact* — the Z-BUFFER histogram, the NEAR/FAR readout, the DEPTH shading mode, correct concave self-occlusion — needs a real depth buffer, which is the single largest item in this epic and forces owning the rasteriser (Canvas 2D cannot depth-test a `context.fill()`).
- **A live projection bug the depth buffer would amplify.** `w = focal + z + zOffset` goes non-positive at reachable settings: `DEFAULT_FOCAL_LENGTH` 300 with `sliderToZoomOffset` bottoming at −220 leaves 80, while the Menger sponge reaches z ≈ −182. Those vertices sit behind the eye and project mirrored today. A near-plane guard is a prerequisite, not a nicety.
- **`Surface3D.render` already returns the triangles it drew.** With culling on, `total - drawn` is the culled count for free — the cheapest real number in the whole console.
- **The canvas is fixed at 1024×640** and both `BackgroundRenderer` and `ShapeTransitionMachine` receive width and height at construction, so nothing resizes. A responsive viewport needs a resize path through all three.
- **`BackgroundRenderer` already draws the sky and the checker floor**, unconditionally and in canvas space rather than as scene geometry. Making SKY DOME and CHECKER FLOOR real toggles is small; making them real scene objects that respond to the camera is not.
- **Rotation is a rate, not an angle.** `rotateMesh` applies a per-frame delta derived from the slider offset from canvas centre. Camera view presets, the ROTATION readout and absolute PITCH/YAW/ROLL all depend on changing that first.
