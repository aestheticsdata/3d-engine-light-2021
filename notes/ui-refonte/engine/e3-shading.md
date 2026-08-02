# Shading pipeline: normals, lighting, depth buffer and pipeline flags

The console advertises a six-mode shading pipeline, a directional key light with four parameters, and three rasteriser flags. The engine behind it computes no normal, has no light, and fills every triangle with the `rgba(...)` string baked into its data tuple. This capability adds face and vertex normals, one directional key light with Lambert and Blinn-Phong terms, a per-pixel depth buffer to replace painter ordering, the four visualisation modes that depend on per-pixel work, and the dithering and edge-antialias passes. It is the largest item in the epic by a wide margin and must be split — see Approach.

**Unblocks**

- SHADING MODE chips POINTS, FLAT, GOURAUD, DEPTH, NORMALS — render-tab (`tickets-final/render-tab.md`, Data table rows 2 and the "do not ship a fake" section). The `PREVIEW` note on the SHADING MODE header goes away with them.
- The viewport HUD mode chip and the six `[data-shading-mode="…"] … canvas { filter: … }` cosmetic rules, which are deleted rather than de-mocked — viewport-hud (`tickets-final/viewport-hud.md` L23, L80–L81).
- SHAPE INFO's SHADING row — shape-info (`tickets-final/shape-info.md`, Data table): stops being a two-valued `WIRE`/`FLAT` derivation and reads all six labels from `modeLabel()`.
- The status bar's mode segment — status (`tickets-final/status.md` L51).
- LIGHTING sliders AZIMUTH, ELEVATION, AMBIENT, SPECULAR — render-tab (`tickets-final/render-tab.md`, LIGHTING section and Data table rows 8–11).
- The `LGT` / `KEY_LIGHT` scene-graph row, including its visibility toggle — scene-graph (`tickets-final/scene-graph.md`, Data table row 4).
- PIPELINE toggles Z-BUFFER, DITHERING, EDGE ANTIALIAS — render-tab (`tickets-final/render-tab.md`, Data table rows 5–7).

## Approach

### Correct the epic's premise first

`demock-epic.md` states that `Surface3D.render` "walks meshes and calls `Triangle.renderTriangle` in list order". Both halves are wrong against the source. The method is `Triangle.render` (`src/primitives/Triangle.ts` L106), and `Mesh.renderMesh` **does** sort: `this.triangles.sort((t1, t2) => t2.depth - t1.depth)` (`src/primitives/Mesh.ts` L19), back-to-front on `Triangle.depth`, the mean z of the three vertices (`Triangle.ts` L102–L104). It is a painter's algorithm, not an unsorted walk.

The real defects, which are what the depth buffer fixes:

1. The sort is **per mesh**. `Surface3D.render` iterates `renderables` and calls `renderMesh` on each (`Surface3D.ts` L38–L45), so during the 1250ms shape transition the two meshes returned by `getRenderables()` are composited in array order regardless of depth.
2. Centroid ordering is the classic painter's failure case: long thin triangles, mutual overlap and cyclic overlap. Concretely wrong today on `menger` (2112 triangles, level 2, deep concavities), `cross` and `torusKnot` (7920 triangles, the tube passes over itself twice).
3. The sort runs every frame and mutates the array in place. On `torusKnot` that is roughly 7920·log2(7920) ≈ 103k comparisons, each invoking the `depth` getter twice — six property reads, two adds and a divide per call. Deleting the sort pays back part of the depth buffer's cost.

### Proposed split

Do not attempt this as one ticket. Four sub-tickets, in dependency order:

**E3a — Face normals and the directional key light.** No rasteriser change: keeps `context.fill()`. Delivers the FLAT chip, the four LIGHTING sliders and the KEY_LIGHT row. Shippable on its own and visibly changes the frame.

**E3b — Software scanline rasteriser with a depth buffer.** The load-bearing item; everything per-pixel waits on it. Delivers the Z-BUFFER toggle and correct concave self-occlusion.

**E3c — GOURAUD, DEPTH, NORMALS and POINTS modes.** Needs E3a for normals and E3b for per-pixel interpolation. POINTS alone does not need E3b and can land first inside E3c.

**E3d — Dithering and edge antialiasing.** Two per-pixel passes in E3b's rasteriser.

### E3a — normals and the light

Accessors first. `Point3D` exposes only `zValue` (`Point3D.ts` L8–L10); `x` and `y` are private (L4–L5). Add `xValue` / `yValue` getters in the same style — **E5b's `Mesh.getBounds()` needs exactly the same two getters**, so whichever of E3a and E5b lands first adds them and the other consumes them. Do not ship two definitions. `Triangle.a/b/c` are private (`Triangle.ts` L68–L70) and `Mesh.points/triangles` are private readonly (`Mesh.ts` L5–L6): rather than widening both, put the per-frame normal pass inside `Mesh` as `computeNormals()` and have `Triangle` expose a `setShade(factor)` / `shadedMaterial` pair.

`transformMesh` mutates the shared `Point3D` objects in place every frame (`Mesh.ts` L43–L47), and there is no separate model matrix — the points *are* the world-space positions. So normals must be recomputed each frame from the mutated positions; there is no object-space shortcut.

Frame convention, stated because the sign is the easy thing to get wrong. After transform, x is right, y is **down** (canvas convention, inherited from `convert3D2D`'s `vpY + this.y * scale`), and z increases away from the eye — `scale = fl / (fl + z + zOffset)` (`Point3D.ts` L29) shrinks with growing z. The eye therefore sits at z = −(fl + zOffset). This is a left-handed basis, so the right-hand cross product points backwards:

- `Nraw = (b − a) × (c − a)`.
- The existing 2D backface test computes `2A = v1x·v2y − v1y·v2x` on the projected vertices and culls when `2A ≤ 0` (`Triangle.ts` L121–L127). If the three vertices shared one perspective scale s, then `2A = s²·Nraw.z`. So the existing test is exactly `sign(Nraw.z)`, and **front-facing means `Nraw.z > 0`**. Use this as the sign check when implementing, it is a one-line assertion on the cube.
- The outward normal used for lighting is therefore `N̂ = −Nraw / |Nraw|`, which points toward the eye (negative z) on visible faces.

Light direction, unit, pointing from the surface toward the light, from azimuth `a` and elevation `e`:

```
Lx =  cos(a)·cos(e)
Ly = −sin(a)·cos(e)      // screen-up is −y
Lz = −sin(e)
```

Azimuth 0° is from the right, increasing counter-clockwise on screen; elevation lifts the light out of the screen plane toward the eye, 90° being a headlight. The render-tab defaults (135°, 42°) then give an upper-left key tilted toward the viewer, which is the intended reading. Note in the code that "elevation" here is out of the screen plane, not above a ground plane — the checker floor is painted in canvas space by `BackgroundRenderer` and is not scene geometry, so there is no ground plane to elevate from until E7.

Shading, per face:

- `kd = max(0, N̂ · L̂)`; `ambient = AMBIENT/100`; `shade = ambient + (1 − ambient)·kd`.
- Blinn-Phong specular: `V̂ = normalise(eye − p̄)` with `eye = (0, 0, −(fl + zOffset))` and `p̄` the face centroid; `Ĥ = normalise(L̂ + V̂)`; `spec = (SPECULAR/100)·max(0, N̂·Ĥ)^32`. The shininess exponent is fixed at 32; the mockup has no slider for it, do not invent one.
- `out.rgb = clamp(material.rgb · shade + 255·spec, 0, 255)`.

Materials are `rgba(r,g,b,a)` strings in the triangle tuples. Parse once at `Triangle` construction into numeric channels, not per frame. Rebuilding the fill string per triangle per frame is 7920 string allocations on the torus knot; quantise `shade` to 1/64 steps and memoise on `material + step` so the cache holds at most 64 entries per distinct material.

Degenerate faces are real in this data, not hypothetical: `sphere` emits its pole rows from coincident vertices (`src/data/shapes/sphere.ts` L11–L27 pushes `LON_SEGMENTS + 1` = 13 identical points at theta = 0 and theta = π, and L29–L39 builds triangles from them), so `|Nraw|` is 0 there. Guard on `|Nraw| < 1e-9` and skip lighting for that face rather than writing `NaN` into a colour string, which paints nothing and is invisible in a stack trace.

Textured triangles cannot be modulated by `context.fill()`. On the E3a path, shade a textured face with a second pass inside the same clip: after `drawImage`, fill `rgba(0,0,0,1−shade)` over the clipped triangle. It is an approximation of a multiply and it darkens only; it disappears in E3b, where the texel is multiplied per pixel.

### E3b — the depth buffer

Canvas 2D has no z-buffer and no way to bolt one onto `fill()`. A real depth buffer means owning the rasteriser: `putImageData`-backed scanline fills, not `context.fill()`.

Buffers at 1024 × 640 (`src/index.html` L57), which is fixed **only until E9 stage two ships a resizable render target**. Allocate them from `renderTarget.width/height` rather than from literals, and reallocate on `setSize`, so E9 does not have to reopen the rasteriser. The figures below are for the current size:

- colour: `ImageData(1024, 640)`, 655 360 px, 2 621 440 bytes.
- depth: `Float32Array(655360)`, 2 621 440 bytes.

Store `1/w` where `w = fl + z + zOffset`, the same denominator `convert3D2D` already divides by. `1/w` interpolates linearly in screen space and `z` does not, so the depth test is `if (invW > depth[i])` — nearer is larger — and one linear interpolation per pixel is exact. Rasterise with edge functions over the triangle's screen bounding box, incrementing the three edge values and `invW` per pixel; roughly 12–20 ops per candidate pixel.

Per-frame cost to expect, and the number this sub-ticket must actually measure rather than assume:

- clears: `depth.fill(Infinity)` plus the colour clear, 5.2 MB of typed-array writes, ~0.3–0.8 ms.
- `putImageData` of a full frame: one 2.6 MB upload, ~0.5–2 ms depending on browser.
- inner loop: at ~15 ops/px, a 16.7 ms budget leaves room for roughly 1–2 M pixel iterations per frame once everything else is paid for. Full canvas coverage is 655k, so that is 2–3× overdraw over the whole frame, or full overdraw over the ~30% of the frame a shape covers at the default zoom. It fits, but not with margin.
- per-triangle setup on `torusKnot` (7920 triangles): project three vertices, bbox, edge coefficients — order 1–3 ms on its own. Small triangles mean setup, not fill, dominates on that shape.

Two mitigations, both required rather than optional:

1. **Dirty rect.** Track the union screen bbox of the submitted triangles and clear/upload only that region — `putImageData(img, 0, 0, dx, dy, dw, dh)` takes a dirty rectangle.
2. **Background as the clear source.** `BackgroundRenderer.render` redraws an identical sky gradient, sky bitmap, atmosphere, checker floor and vignette every frame with no per-frame inputs (`src/rendering/BackgroundRenderer.ts` L16–L25). Snapshot it once with `getImageData` and clear the colour buffer with `data.set(snapshot)` — a 2.6 MB copy, cheaper than redrawing gradients, and it removes the background cost from the frame entirely. Invalidate the snapshot on a layer-flag change (world-tab's `setLayers`, E5's `setWorld`) and on E9's `resize`. **The snapshot stops being valid outright once E5b lands**: its ground-shadow blob depends on the mesh bounds and therefore changes every frame. If E5b is already in, the snapshot covers sky + atmosphere + floor + grid only, and the shadow and vignette are drawn per frame after the mesh — say which passes the snapshot covers rather than assuming the whole background is static.

`putImageData` ignores `globalAlpha` and all compositing, so it cannot blend the mesh over an untouched background; seeding the colour buffer from the snapshot is what makes src-over blending work, and it is also what makes the existing OPACITY slider (`TriangleRenderOptions.opacity`) survive, as a per-pixel blend against the buffer.

**Near-plane guard, a bug that exists today.** `w = fl + z + zOffset` goes non-positive at reachable settings: `DEFAULT_FOCAL_LENGTH` is 300 and `sliderToZoomOffset` maps the slider down to −220 (`src/index.ts` L20, L24–L25, L47–L55), so `fl + zOffset` bottoms out at 80. `menger` at `TOTAL_SIZE = 210` reaches z ≈ −182 at a corner, `sphere` reaches −100. Those vertices sit at or behind the eye; `scale` flips sign and the triangle projects mirrored. Painter ordering hides how wrong that is; `1/w` does not, it flips sign and inverts the depth test. E3b must skip any triangle with `min(w) ≤ ε`. **If E2 has landed this is already done**: E2 adds `near` / `far` to the shared camera record and rejects the same triangles in `Triangle.render` before projection, and `w` becomes `d = z + fl/k`. Consume E2's rejection rather than adding a second epsilon; if E2 has not landed, ship the epsilon and delete it when E2 arrives. Proper near-plane clipping (splitting the triangle at the plane) is E2b — link it, do not half-implement it here.

**The Z-BUFFER toggle selects the backend.** ON = the depth-buffered rasteriser; OFF = the existing `Triangle.render` painter path unchanged. That gives the flag a real meaning, and gives a fallback if the perf gate fails. Structure it as `src/rendering/Rasterizer.ts` alongside the existing path, with `Surface3D.render` choosing; keep `Triangle.render` intact so OFF is a genuine A/B.

Keep `Mesh.renderMesh`'s depth sort even with the buffer on: E3d's edge antialiasing blends at silhouettes, and blended pixels still need back-to-front order.

### E3c — the four remaining modes

- **POINTS**: project every `Point3D`, depth-test it, write a 2 × 2 block. Costs `points.length` per frame — 3960 on the torus knot (`PATH_SEGMENTS 220 × TUBE_SEGMENTS 18`), 4224 on the Menger sponge, which is the registry maximum. Works on both backends; on the painter path it just draws every point.
- **GOURAUD**: vertex normals are the area-weighted sum of adjacent face normals, accumulated over the shared points array each frame. `Triangle` holds `Point3D` references, not indices, so pass the indices already available at `src/index.ts` L404–L415 into the constructor and accumulate into a `Float32Array(points.length * 3)`. Interpolate the three vertex shades per pixel in the rasteriser. Two honest caveats to record: the cube's four flat-coloured faces share the eight corner points (`src/data/shapes/cube.ts` L20–L29 — the other two faces are subdivided texture grids with their own vertices), so averaging rounds those corners; and the generated shapes duplicate their seam column (`lon = 0` and `lon = LON_SEGMENTS` are distinct points in `sphere.ts`, `donut.ts`, `torusKnot.ts`), so a seam line will show. This data has no smoothing groups and adding them is not this ticket.
- **DEPTH**: greyscale from the depth buffer. There are no clip planes, so normalise against the per-frame min/max of the submitted `1/w` rather than inventing a range. The z-buffer histogram widget's `0.1` / `1000.0` axis labels (`tickets-final/zbuffer.md`) have no engine referent and must be re-derived from the same two numbers when that widget is de-mocked.
- **NORMALS**: `rgb = N̂ · 0.5 + 0.5`. Flat per face is enough. Because y is down, the green channel reads inverted against the usual convention — negate y for display and say so in a comment.

### E3d — dithering and edge antialias

- **DITHERING** must do something visible or it is another lie. Implement as quantisation to 5 bits per channel plus a 4 × 4 ordered Bayer offset, which is what makes it worth having: it kills the Mach banding on large Gouraud gradients. One table lookup and one add per pixel.
- **EDGE ANTIALIAS** repairs a regression E3b introduces. `context.fill()` is antialiased by the browser; a hand-written rasteriser writes hard edges, so the frame gets visibly worse when Z-BUFFER goes on. Estimate per-pixel coverage from the edge functions — a boundary pixel's coverage is the signed edge distance divided by the edge gradient magnitude, clamped to [0,1] — and blend against the buffer at those pixels only. Edge blending is not depth-correct at silhouettes; that is standard and acceptable, note it.

## Constraints and risks

- **60fps is the risk, not correctness.** The rasteriser must be measured against `frameMs`, which the frame-time ticket already exports (`tickets-final/frame-time.md`, Data table — `performance.now()` around the `surface3D.render` call). Gate: `sphere` (240 triangles) and `cube` (792) hold ≥ 55 fps, `torusKnot` (7920) and `menger` (2112) hold ≥ 30 fps with Z-BUFFER on. If the gate fails, Z-BUFFER ships defaulting OFF and the render-tab default flips with it; do not ship a default that halves the frame rate to satisfy a mockup.
- **The frame gets uglier before it gets better.** Between E3b and E3d the mesh has hard aliased edges. Land E3d in the same release or keep Z-BUFFER off by default until it does.
- **Two rasterisers to keep working.** Wireframe, backface culling and opacity all reach the rasteriser through `TriangleRenderOptions` (`Triangle.ts` L61–L65) and must behave identically on both backends. Same for the affine texture path, which is reimplemented per pixel in E3b — the subdivision-based warping workaround documented in `src/data/builders/MeshBuilder.ts` stays valid, and perspective-correct UVs become possible for free once `1/w` is interpolated, but that is a change in appearance and should be a deliberate, separately noted step.
- **The drawn count contract holds (D6).** `Surface3D.render` still returns the number of triangles drawn, feeding the viewport, the toolbar and the scene-graph mesh row. Under the rasteriser, "drawn" means passed culling and the near-plane guard; triangles fully rejected by the depth test still count, otherwise the number would flicker with occlusion. The geometry ticket's caveat about `registry − drawn` slightly overcounting now gains a second term, the near-plane guard.
- **`stop()` zeroes `renderedTriangles` on pause** (`src/index.ts` L577–L584) and `renderPausedFrame` re-renders on control changes. Both call sites must go through the same backend selection; a paused frame rendered by the other backend would visibly jump.
- **Transitions.** `getRenderables()` returns two meshes with `offsetX` / `offsetY` during the 1250ms transition. One shared depth buffer across both is correct and is what fixes defect 1 above, but the offsets must be applied before the depth test, not after.
- **KEY_LIGHT visibility.** The scene-graph row's toggle must actually kill the light (ambient only), not just dim a label. Rows 2 and 3 stay placeholders, they belong to E7.
- **Do not touch layout.** Per the epic's rules: if a real six-mode label does not fit its chip or the HUD chip, that is a bug here, not licence to redesign. `GOURAUD` is the longest label and the render-tab ticket already sized for it at 320px.
- **`FILTERS` must not survive.** The viewport-hud ticket ships six cosmetic CSS filter rules keyed off `data-shading-mode`. E3c deletes the rules and the attribute's styling hook; the attribute itself may stay if something else reads it.
- **Not in scope, name them so they do not creep in:** near-plane clipping (E2b), shadows (E5b), multiple lights, per-material shininess, smoothing groups, a resize path (E9).
- **Order.** E3 lands after E6 and after E2. E6 splits `Triangle.render` into `project()` / `isFrontFacing()` / `fill()` and replaces the `Point2D` projection fields with scalars — that is exactly the seam this ticket's rasteriser needs, so E3 consumes it instead of restructuring the same method a second time; if E3 goes first, E6 rebases onto whatever shape E3 left. E2 supplies the near plane and the shared camera record (`w` becomes `d = z + fl/k`). E3a additionally races E5b for the `Point3D` accessors and races E4a for `Triangle`'s material fields — E4a parses the authored `rgba(...)` string once at construction, which is the same parse this ticket needs for the shade multiply, so land E4a's `AuthoredMaterial` first or hand E3's parse to it. Downstream: E7's KEY_LIGHT row and E5b's fog overlay both wait on E3a.

## Files

- `src/primitives/Point3D.ts` — add `xValue` / `yValue` getters alongside `zValue`; document that `w = fl + zValue + zOffset` is the projection denominator the depth buffer stores the reciprocal of.
- `src/primitives/Triangle.ts` — parse the `rgba(...)` material once at construction; add the vertex indices; expose the projected vertices and `w` for the rasteriser; add the shade/shaded-material pair and the textured-face shade overlay; keep `render()` as the painter-path backend.
- `src/primitives/Mesh.ts` — `computeNormals()` (face, and vertex accumulation for Gouraud); submit triangles to the selected backend; keep the existing depth sort.
- `src/primitives/Surface3D.ts` — choose the backend from `store.zbuffer`, own the colour and depth buffers, the background snapshot, the dirty rect and the `putImageData` present; keep the drawn-count return value.
- `src/rendering/Rasterizer.ts` — new. Edge-function triangle fill, `1/w` depth test, flat and Gouraud shade interpolation, affine and perspective-correct texel sampling, point rendering, the Bayer dither pass and the coverage-based edge blend.
- `src/rendering/Lighting.ts` — new. The azimuth/elevation direction vector, Lambert and Blinn-Phong, the ambient term, the quantised shade cache.
- `src/rendering/BackgroundRenderer.ts` — expose the frame snapshot used as the colour-buffer clear source.
- `src/ui/UIStateStore.ts` — the `lighting` slice and the `zbuffer` / `dither` / `edgeAA` booleans stop being inert; `shadingMode` reaches the renderer.
- `src/ui/shadingMode.ts` — no change to `modeLabel()`; the five placeholder affordances are removed from its consumers.
- `src/index.ts` — pass `shadingMode` and the lighting values into `Surface3D.render`'s options; honour the KEY_LIGHT visibility slice; keep `renderFrame` and `renderPausedFrame` on one code path.
- `src/index.html` — remove `data-placeholder`, `title` and `aria-describedby` from the five shading chips, the three pipeline toggles, the four lighting slider rows and the KEY_LIGHT row.
- `src/styles/components/viewport.css` — delete the six `[data-shading-mode]` filter rules.

## Done when

E3a

- [ ] Face normals are recomputed per frame from the transformed points, and a unit test or boot-time assertion confirms `Nraw.z > 0` agrees with the existing 2D backface test on every `cube` face.
- [ ] Moving AZIMUTH, ELEVATION, AMBIENT or SPECULAR visibly changes the frame; AMBIENT at 100 flattens shading completely and SPECULAR at 0 removes every highlight.
- [ ] `sphere` renders with no `NaN` colour strings and no missing faces at either pole.
- [ ] Textured `cube` faces darken with the key light on the painter path.
- [ ] Hiding the KEY_LIGHT scene-graph row leaves ambient-only shading; showing it restores the light.
- [ ] Colour strings are cached — a profile shows no per-triangle string allocation growth on `torusKnot`.

E3b

- [ ] Z-BUFFER ON routes through `Rasterizer` and OFF through the unchanged `Triangle.render` path, and the two produce the same silhouette on `cube`.
- [ ] `menger`, `cross` and `torusKnot` self-occlude correctly with Z-BUFFER on, verified against a named frame where the painter path is visibly wrong.
- [ ] During a shape transition both meshes share one depth buffer and interpenetrate correctly.
- [ ] Triangles with `w ≤ ε` are skipped; dragging the zoom slider to maximum on `menger` no longer produces mirrored faces.
- [ ] Wireframe, backface culling and opacity behave identically on both backends; the OPACITY slider still blends against the background under the rasteriser.
- [ ] `Surface3D.render` still returns the drawn count, and the toolbar, viewport and scene-graph mesh row still agree.
- [ ] Measured `frameMs` recorded in the PR for all 8 primitives on both backends, and the perf gate above is met or the default is flipped and documented.

E3c

- [ ] All six shading chips change the rendered frame; selecting each and screenshotting produces six distinguishable images.
- [ ] DEPTH normalises against the per-frame depth range, with no hardcoded near/far.
- [ ] NORMALS is signed correctly for the y-down frame — a face pointing screen-up is not the same colour as one pointing screen-down.
- [ ] POINTS draws every vertex, depth-tested when Z-BUFFER is on.
- [ ] The cube-corner and seam artefacts of Gouraud are documented in the PR rather than silently shipped.
- [ ] The six `[data-shading-mode]` CSS filter rules are deleted and `grep -rn "hue-rotate\|grayscale(1)" src` returns nothing.

E3d

- [ ] DITHERING visibly removes banding on a large GOURAUD gradient and is a no-op on flat colour.
- [ ] EDGE ANTIALIAS on makes rasteriser edges match the smoothness of the painter path; off shows the hard edges, so the toggle is provably doing work.

Across all four

- [ ] `grep -rn 'data-placeholder' src/index.html` no longer matches the five shading chips, the Z-BUFFER / DITHERING / EDGE ANTIALIAS rows, the four lighting slider rows or the KEY_LIGHT row, and their `title` and `aria-describedby` attributes are gone with it.
- [ ] The SHADING MODE header's `PREVIEW` note is removed.
- [ ] SHAPE INFO's SHADING row, the viewport HUD mode chip and the status-bar mode segment all show the same label for all six modes, still from the single `modeLabel()`.
- [ ] RESET restores shading mode, the three pipeline flags and the four lighting values (D7).
- [ ] Everything above holds at `max-width: 899px` as well as on desktop, with no layout change.
