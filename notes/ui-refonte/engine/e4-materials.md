# Materials: runtime texture, base colour and mesh scale

Today a triangle's surface is a single string baked into the shape data — either a `rgba(...)` fill or a texture key — read once in `Triangle.render` and never changeable at runtime (`src/primitives/Triangle.ts` L146–L159, `src/data/shapes/*`). This ticket introduces a runtime material: a texture mode, a base colour and a UV scale that the console can change on a live mesh, plus a uniform mesh scale. It keeps the authored per-triangle slot as the per-triangle override, so the cube can go on mixing four flat faces with two subdivided textured ones while the whole mesh still answers to one material object. Without it the entire MATERIAL section of the SHAPE tab is inert and three widgets read their material label from static registry data rather than from what the rasterizer is actually doing.

**Unblocks**

- The four MATERIAL texture chips — shape-tab (`tickets-final/shape-tab.md`, Data table row "Texture chips")
- The five BASE swatches — shape-tab ("BASE swatch")
- UV SCALE slider — shape-tab ("UV SCALE")
- SCALE slider in the TRANSFORM section — shape-tab ("SCALE")
- SHAPE INFO's MATERIAL row, and its TEXTURES row, which switch from registry-derived to runtime-derived — shape-info (`src/ui/texLabel.ts`)
- The viewport HUD texture chip — viewport-hud (imports `texLabel`)
- The status bar texture segment — status (imports the same `texLabel`)

## Approach

### The authored slot stays; no shape-file migration

Every shape file writes its colours per triangle — `sphere` alternates two `rgba(...)` strings by `(lat + lon) % 2` (`src/data/shapes/sphere.ts` L33–L37), `menger` picks six checkered face colours per cell (L79–L86), `cuboctahedron` colours by face arity through `colorForFace` (`src/data/builder.ts` L227). Rewriting those into per-mesh materials would destroy the thing that makes the registry worth looking at. **The authored slot `triangle[3]` is not migrated.** It is reclassified once, at mesh build time, into an `AuthoredMaterial`:

```
type AuthoredMaterial =
  | { kind: "color"; css: string; rgba: [number, number, number, number] }
  | { kind: "texture"; key: string; uv: [UV, UV, UV] };
```

Classification must not sniff the string. `src/ui/texLabel.ts` currently tests `material.startsWith("rgba")` and shape-info's acceptance criteria pin that to exactly one occurrence in the tree; a second copy inside `Triangle` would break it, and the test is wrong anyway the moment a shape author writes `#rrggbb`. Instead `src/textures/textures.ts` gains the declared key set that already drives `loadTextures` at boot (`dog`, `galaxy`, plus the procedural keys below) and an `isTextureKey(slot)` predicate. Classification is membership in that set. The `startsWith("rgba")` test is then deleted, and shape-info's criterion "`grep -rn "startsWith(\"rgba\")" src` returns exactly one hit" becomes "returns zero hits" — amend that ticket in the same PR.

### The runtime material

```
type TextureMode = "authored" | "checker" | "uvGrid" | "solid";
interface MeshMaterial { mode: TextureMode; baseColor: string; uvScale: number; }
```

One `MeshMaterial` instance lives on `Main` and is passed **by reference** into `buildMesh`, so a change reaches the meshes that are already on screen — including both meshes alive during a shape transition (`ShapeTransitionMachine.getActiveMeshes()`). `Mesh.setMaterial(material)` loops its triangles exactly the way `changeFocal` / `changeOffsetZ` already do (`src/primitives/Mesh.ts` L31–L41); `Triangle.setMaterial` re-resolves and caches. Nothing is resolved per frame.

Resolution, one table, one function `resolveMaterial(authored, material)`:

| mode | triangle authored as colour | triangle authored as texture |
| --- | --- | --- |
| `authored` | authored colour × base colour | authored texture, authored UVs, `uvScale` applied |
| `checker` | procedural checker, generated UVs | procedural checker, authored UVs |
| `uvGrid` | procedural UV grid, generated UVs | procedural UV grid, authored UVs |
| `solid` | base colour flat | base colour flat, texture suppressed |

The per-triangle override is the left-hand column existing at all: the authored slot always wins on *which UVs* to use and, in `authored` mode, on what is drawn.

### Base colour is a multiplier, not a replacement

`out_c = round(authored_c × base_c / 255)` per channel, alpha taken from the authored colour. Multiply preserves each shape's internal contrast — the sphere stays a checker, the Menger sponge stays six-coloured — while the swatch visibly tints the whole mesh. White is the identity, so **the default swatch is the white one**, not shape-tab's `--color-swatch-red`: the first frame after this ticket must be pixel-identical to the first frame before it. Amend shape-tab's default; the palette and its order are unchanged.

Parsing the authored string needs no colour parser. Set `ctx.fillStyle = css` on a scratch 1×1 context and read `ctx.fillStyle` back: the browser normalises any CSS colour to `#rrggbb` or `rgba(r, g, b, a)`. Parse those two forms, once, at build time.

In `checker` and `uvGrid` the base colour is the ink the texture is generated with, and in `solid` the mode's product is white so the rule collapses to "the fill is the base colour". One rule everywhere.

### Procedural textures and the UVs they need

`checker` and `uvGrid` are generated into a 64×64 `HTMLCanvasElement` and registered under reserved keys. `TextureMap` is `Record<string, HTMLImageElement>` today (`src/textures/textures.ts` L1); widen it to `HTMLImageElement | HTMLCanvasElement`. `Triangle` only reads `img.width` / `img.height` and passes the source to a canvas draw, so both satisfy it. Regenerate on a base-colour change — two fills and a dozen strokes, not a per-frame cost.

The harder half: **only the cube has UVs.** Every other primitive pushes 4-tuples, so a texture mode would have nothing to sample against. Generate UVs at mesh build time from the registry coordinates in `src/data/data.ts` (never from the live `Point3D`s — `transformMesh` mutates those in place every frame), by spherical projection:

```
r = |p|
u = 0.5 + atan2(p.z, p.x) / (2π)
v = 0.5 − asin(clamp(p.y / r, −1, 1)) / π
```

with two guards. Seam: a triangle straddling `u = 0/1` gets `max(u) − min(u) > 0.5`, and the affine map would smear the whole texture across it — add 1 to every `u < 0.5` in that triangle. Pole: `r < 1e-6` falls back to `[0, 0]`. Authored UVs always win, so the cube's two subdivided faces keep the mapping `addTexturedQuadSubdiv` gave them (`src/data/builder.ts` L121–L143).

### UV SCALE forces the texture path off `clip` + `drawImage`

`Triangle.render` solves the UV→screen affine and then clips to the triangle and draws the image once through it (L209–L224). UVs outside `[0..1]` map the triangle outside the image, so it draws blank — the current path cannot tile, and UV SCALE 1..16 is exactly tiling. Replace the clip/draw pair with a repeating pattern:

- keep the existing affine solve unchanged (L184–L207), but convert UVs to pixels as `u × uvScale × w`;
- cache one `CanvasPattern` per texture per context (`ctx.createPattern(img, "repeat")`), call `pattern.setTransform(new DOMMatrix([m11, m12, m21, m22, dx, dy]))` per triangle, set it as `fillStyle` and fill the triangle path.

This is fewer canvas state changes than today (one `save`/`restore` pair disappears), it honours `globalAlpha` so the opacity slider still works, and it makes tiling free. Note the affine is still not perspective-correct — the subdivision rationale in `builder.ts` L11–L21 is unchanged.

### Mesh scale

Do not scale through the mesh transform. `Mesh.transformMesh` mutates the shared `Point3D`s in place (`src/primitives/Point3D.ts` L36–L64), so a scale matrix applied per frame compounds and there is no identity to return to. **This argument is specific to the pre-E1 engine.** E1 replaces `transformMesh` with `setTransform(m)` rebuilding every vertex from pristine source coordinates, at which point a scale factor folded into `m` would no longer compound and would be a legitimate alternative. Scale at projection time anyway, for two reasons that survive E1: it keeps scale a model property independent of whatever the camera rig is doing, and it costs one multiply at projection instead of widening the per-frame matrix. Mirror the `fl` / `zOffset` fields that are already there:

- `Point3D` gains `public modelScale = 1`; `convert3D2D` becomes `s = fl / (fl + z·modelScale + zOffset)` and returns `(vpX + x·modelScale·s, vpY + y·modelScale·s)` — a true uniform scale about the model origin, which is also the centre of rotation.
- `Triangle.changeScale(v)` and `Mesh.changeScale(v)` copy `changeFocal` line for line; `Main.applyCameraSettings` applies it alongside focal and z offset, so a newly built mesh picks up the current scale.
- Depth ordering is unaffected: a positive uniform scale preserves the sign of every z difference, and `Mesh.renderMesh` sorts each mesh independently.

UI 10..300 maps to 0.1..3.0. At the near end of the zoom slider (`zOffset = −220`) a scaled-up mesh drives `fl + z·s + zOffset` through zero and the projection inverts — a latent bug today, not one this ticket creates (world-tab records focal 300, `zOffset` −220, `z` −173 giving −93). **Do not add a guard to the projection here**: E2 owns the near plane and rejects those triangles, and E7 consolidates the projection expression into `Point3D.project`. Until E2 lands, cap the *applied* scale so the mesh's own bounding radius stays in front of the eye — `s ≤ (fl + zOffset − 40) / R` with `R` the shape's authored radius — and show the cap in the value readout rather than silently ignoring the slider. When E2 lands, delete the cap and let the near plane do it.

### `texLabel` becomes runtime-derived

`src/ui/texLabel.ts` keys off the primitive today. After this ticket the material is scene state, not shape state, so both exports lose their `key` argument and read the resolved material:

- `texLabel(): "TEXTURED" | "CHECKER" | "UV GRID" | "SOLID"` — the mode's label, except `authored` mode which yields `TEXTURED` when the shape has any texture-authored triangle and `SOLID` when it does not.
- `textureNames(): string[]` — the texture keys actually sampled this frame; `authored` mode returns the authored keys, the procedural modes return the generated key, `solid` returns empty.

Shape-info's criterion "`TEXTURED` / `SOLID` are the only two strings" widens to the four above; amend it. All three consumers (SHAPE INFO MATERIAL, the HUD chip, the status segment) keep importing the one function, so they cannot disagree (D5).

### Chip labels: `NO TEXTURE` is renamed

The mockup's fourth chip is `NO TEXTURE`, which in an engine whose shapes ship their own materials would either be a synonym for SOLID or the only state in which the dog and galaxy textures are visible. Rename it **AUTHORED** and make it the default. Four chips, two columns, no layout change; shape-tab's chip list and its `CHECKER` default are amended in the same PR. Same reason as the white swatch: the default state is the frame the renderer already draws.

### This is two tickets

Honestly scoped, this is large: a material model, a colour pipeline, procedural texture generation, UV generation, a rasterizer change and a transform change. Proposed split, in order:

- **E4a — material model, base colour, mesh scale.** `AuthoredMaterial` + `MeshMaterial` + `resolveMaterial`, the `isTextureKey` classification, the multiply tint, `authored` and `solid` modes, `modelScale` and the denominator guard, the `texLabel` rewrite. Unblocks the BASE swatches, SCALE, two of the four chips, and all three label consumers.
- **E4b — procedural textures and tiling.** Checker and UV-grid generators, spherical UV generation with the seam fix, the pattern-based texture fill, UV SCALE. Unblocks the remaining two chips and UV SCALE.

E4b depends on E4a and on nothing else.

## Constraints and risks

- **The first frame must not change.** Defaults are mode `authored`, base colour white, UV scale 8 (inert until a procedural mode is picked), scale 100. Verify by screenshot diff against `master`, not by eye.
- **Procedural modes are the expensive path.** The cube textures 784 triangles today; `checker` on the torus knot textures 7920 (`src/data/shapes/torusKnot.ts`: 220 × 18 × 2). Pattern fills are cheaper per triangle than the current clip/draw pair, but ten times as many of them is still a frame-time hit. Measure it on the torus knot and the Menger sponge and let the frame-time widget show it rather than hiding the mode.
- **Spherical UVs are a projection, not an unwrap.** On the cross and the Menger sponge the checker will look arbitrary on faces facing away from the projection axis. That is honest and it is what a UV GRID mode is for — do not chase a better unwrap in this ticket.
- **`pattern.setTransform` takes a `DOMMatrix`.** Widely available, but if the build targets a browser without it, keep the existing clip/`drawImage` path as the `uvScale === 1` fallback rather than dropping tiling for everyone.
- **Opacity must keep working.** `TriangleRenderOptions.opacity` is applied via `globalAlpha` before the fill (L129–L131) and the coupling with backface culling is owned by shape-tab. The pattern fill sits inside the same `save`/`restore`, so this is a test, not a change.
- **`convert3D2D` is contended.** E2 gives it two projection branches and a near plane, E7 factors it into `project(out)`, E9 scales after the divide. This ticket's edit is one multiplication on three coordinates; land it early or rebase it onto whichever of those is in first, and do not let two of them ship separate copies of the projection formula.
- **Order.** E4 lands after E2 and after E6, and E4a before E4b. E2 supplies the near plane that lets the scale cap be deleted (the cap is dead weight the moment E2 is in, so if E2 is already merged skip building it). E6 splits `Triangle.render` into `project()` / `isFrontFacing()` / `fill()`; the pattern-based texture fill and the resolved-fill cache belong inside E6's `fill()`, so building them against the un-split `render()` means writing them twice. E3a also parses the authored `rgba(...)` string once at construction for its shade multiply — that is this ticket's `AuthoredMaterial.rgba` and must be one parse, so E4a should land before E3a or hand E3a the field. E5b adds a fog overlay fill in the same method; both are post-fill passes and need one agreed order (material fill, then fog, then E3d's edge blend).
- **Registry counts must not move.** SHAPE INFO TRIANGLES, the primitive chip meta line and GEOMETRY TRIANGLES are registry counts (D6). Nothing here adds or removes a triangle.
- **RESET owns the new slices** (D7): texture mode, base colour, UV scale and mesh scale all return to the defaults above through the toolbar's single reset path.

## Files

- `src/rendering/material.ts` — new; `AuthoredMaterial`, `MeshMaterial`, `TextureMode`, `resolveMaterial`, the multiply blend and the canvas-normalised colour parse
- `src/rendering/uvProjection.ts` — new; spherical UV generation with the seam and pole guards (E4b)
- `src/textures/procedural.ts` — new; the checker and UV-grid canvas generators (E4b)
- `src/textures/textures.ts` — widen `TextureMap` to `HTMLImageElement | HTMLCanvasElement`; add the declared key set, `isTextureKey` and `registerTexture`
- `src/primitives/Triangle.ts` — authored material + shared `MeshMaterial` reference, resolved-fill cache, `setMaterial`, `changeScale`, the pattern-based texture fill with `uvScale`
- `src/primitives/Mesh.ts` — `setMaterial`, `changeScale`
- `src/primitives/Point3D.ts` — `modelScale` and the scaled projection line in `convert3D2D`. This is the same line E2 (two projection branches), E7 (`project(out)`) and E9 (post-divide viewport scale) all rewrite; whichever lands last folds the others in, and the scale factor stays a model property wherever the camera state ends up living
- `src/index.ts` — hold the `MeshMaterial` and the mesh scale on `Main`; `changeTexture` / `changeBaseColor` / `changeUvScale` / `changeScale` mirroring `changeZoom` (apply to active meshes, then `renderPausedFrame()`); pass the material and the generated UVs into `buildMesh`
- `src/ui/texLabel.ts` — runtime derivation; the `startsWith("rgba")` test is deleted
- `src/ui/uiState.ts` — `texture`, `baseColor`, `uvScale`, `scale` stop being inert
- `src/ui/inspector/shapeTab.ts`, `src/index.html` — remove the placeholder affordance from the four chips, the five swatches, UV SCALE and SCALE; relabel `NO TEXTURE` to `AUTHORED`
- Amended tickets: `shape-tab.md` (chip label, chip default, swatch default), `shape-info.md` (`texLabel` value set, the `rgba` grep criterion)

## Done when

- [ ] `data-placeholder="true"`, its `title` and its `aria-describedby` are gone from the four texture chips, the five BASE swatches, UV SCALE and SCALE, and no other placeholder marker is removed
- [ ] With defaults (AUTHORED / white / uv 8 / scale 100) every primitive renders pixel-identically to `master`, verified by screenshot diff on all 8 shapes
- [ ] Changing the BASE swatch tints the live mesh without a rebuild, the sphere keeps its two-tone checker and the Menger sponge keeps its six face colours, and white restores the authored palette exactly
- [ ] CHECKER and UV GRID apply to every primitive, including the seven with no authored UVs, with no smeared triangles at the projection seam
- [ ] The cube keeps its dog and galaxy faces in AUTHORED mode, and its four flat faces still tint with the base colour — one mesh, two material behaviours
- [ ] UV SCALE tiles: 1 shows one copy across the mapped surface and 16 shows sixteen, on both the authored cube faces and a procedural mode
- [ ] SCALE 10..300 uniformly scales the mesh about its rotation centre and does not compound across frames
- [ ] At SCALE 300 with the zoom slider at 100 no shape inverts: before E2, because the applied scale is capped and the readout says so; after E2, because the near plane rejects the triangles. No guard is added inside `convert3D2D` by this ticket
- [ ] Scale is applied at projection time only: no scale matrix is added to `Matrix3D`, and the mesh transform (`transformMesh` before E1, `setTransform` after) is untouched by this ticket
- [ ] `texLabel()` takes no primitive key, and SHAPE INFO MATERIAL, the HUD texture chip and the status bar texture segment show the same string in every mode
- [ ] `grep -rn 'startsWith("rgba")' src` returns zero hits and texture classification goes through `isTextureKey`
- [ ] No file under `src/data/shapes/` is modified
- [ ] Material and scale changes re-render while paused, through `renderPausedFrame()`
- [ ] RESET restores mode AUTHORED, the white swatch, UV scale 8 and scale 100
- [ ] Frame time on the torus knot in CHECKER mode is measured and recorded in the PR against the AUTHORED baseline
