# UI refonte — ticket set

Two epics and 29 tickets covering the rebuild of the engine console from the [Claude Design](https://claude.ai/design/p/7ef5a074-a5cb-445e-8d7f-c9077970e48b?file=3D+Engine+UI.dc.html) redesign, plus the renderer work behind it.

These live here rather than in Linear because the workspace has hit its free issue limit (COS-1 → COS-212). Each file is a ready-to-paste Linear description; the first line is the issue title, everything below is the body.

## Read this before trusting a `file:line` below

These tickets were written against the tree as it stood **before COS-356**, the OOP refonte. That epic renamed or dissolved most of the modules they cite. Every `src/…` *path* in these files has been rewritten to its current one (COS-389), but the **line numbers were not**, and neither were the many citations into the old `src/index.ts` — which was a 856-line catch-all and is now twelve lines of ignition. Treat every `L###` as "roughly here, before the refonte" and re-locate the symbol by name.

Where the behaviour went:

| Cited as | Where it lives now |
| -- | -- |
| `src/index.ts` L### — the catch-all `Main` | [`src/app/Main.ts`](../../src/app/Main.ts), the composition root, plus the collaborators it now delegates to: [`Bootstrapper`](../../src/app/Bootstrapper.ts), [`CameraController`](../../src/app/CameraController.ts), [`RenderLoop`](../../src/app/RenderLoop.ts), [`FPSMeter`](../../src/app/FPSMeter.ts), [`ShapeSwitcher`](../../src/app/ShapeSwitcher.ts), [`MeshFactory`](../../src/primitives/MeshFactory.ts) |
| `uiState.ts` — module-scope store | [`src/ui/UIStateStore.ts`](../../src/ui/UIStateStore.ts) — a class. `Main` constructs one and injects it; there is no ambient store to import |
| `fields.ts` — ambient `setField` | [`src/ui/FieldWriter.ts`](../../src/ui/FieldWriter.ts) — injected; the call is `fields.write(name, value)` |
| `texLabel.ts` — two free functions | [`src/ui/MaterialSummary.ts`](../../src/ui/MaterialSummary.ts) — a class over one `Object3D` |
| `tabs.ts` | [`src/ui/TabGroup.ts`](../../src/ui/TabGroup.ts) |
| `statusBar.ts` | [`src/ui/StatusBar.ts`](../../src/ui/StatusBar.ts) |
| `viewportHud.ts` | [`src/ui/ViewportHUD.ts`](../../src/ui/ViewportHUD.ts) |
| `sceneGraph.ts` | [`src/ui/scene/SceneGraphPanel.ts`](../../src/ui/scene/SceneGraphPanel.ts) |
| root-level `controls.ts` | [`src/ui/SliderBank.ts`](../../src/ui/SliderBank.ts) + [`src/ui/PrimitivePicker.ts`](../../src/ui/PrimitivePicker.ts) |
| `data/builder.ts` | [`src/data/builders/`](../../src/data/builders/) — `MeshBuilder`, `PolyhedronBuilder`, `Icosahedron`, `Vec3Math` |
| `textures/textures.ts` | [`src/textures/TextureRegistry.ts`](../../src/textures/TextureRegistry.ts) |

The house style these tickets must now be built to is [notes/oop-refonte/reference/house-style.md](../oop-refonte/reference/house-style.md): behaviour goes in a class, and a new widget is a class from its first commit, not a `createX` factory.

## Epics

| File | Issue |
| -- | -- |
| [epic-ui-refonte.md](epic-ui-refonte.md) | Epic: UI refonte — the engine console (Claude Design) |
| [epic-de-mock.md](epic-de-mock.md) | Epic: de-mock — the engine behind the console |

## Epic 1 — UI refonte (20 sub-issues)

Numbered in dependency order. Each ticket covers **both desktop and mobile**; it is not Done until both are built.

| # | Ticket | Phase |
| -- | -- | -- |
| 01 | [Design tokens: split the console palette into per-type files](ui/01-tokens.md) | foundation |
| 02 | [Panel and control primitives (shared CSS component layer)](ui/02-primitives.md) | foundation |
| 03 | [App shell, legacy teardown and shared state layer](ui/03-shell.md) | foundation |
| 04 | [Top toolbar: brand block, transport, live readouts, action cluster](ui/04-toolbar.md) | chrome |
| 05 | [Viewport frame and HUD overlays](ui/05-viewport-hud.md) | chrome |
| 06 | [Status bar](ui/06-status.md) | chrome |
| 07 | [Scene graph panel](ui/07-scene-graph.md) | left column |
| 08 | [Shape info panel](ui/08-shape-info.md) | left column |
| 09 | [Shape story panel](ui/09-shape-story.md) | left column |
| 10 | [Framerate widget](ui/10-framerate.md) | telemetry |
| 11 | [Frame time widget](ui/11-frame-time.md) | telemetry |
| 12 | [Geometry widget](ui/12-geometry.md) | telemetry |
| 13 | [Z-buffer histogram widget](ui/13-zbuffer.md) | telemetry |
| 14 | [Camera stats widget](ui/14-camera.md) | telemetry |
| 15 | [System widget](ui/15-system.md) | telemetry |
| 16 | [SHAPE tab: primitive picker, transform, material](ui/16-shape-tab.md) | inspector |
| 17 | [RENDER tab: shading mode, pipeline, lighting](ui/17-render-tab.md) | inspector |
| 18 | [WORLD tab: camera and environment](ui/18-world-tab.md) | inspector |
| 19 | [Quick toggles: SKY / FLOOR / GRID / WIRE / CULL](ui/19-quick-toggles.md) | inspector |
| 20 | [Shortcuts panel and mobile gestures card](ui/20-shortcuts.md) | last |

**Hard sequence.** `01 → 02 → 03` are strictly ordered: every component declaration is a `var()`, shell's cards are primitives' `.panel`, and shell replaces `src/index.html` wholesale while re-providing every element id `Main`'s constructor requires. After 03, tickets 04–06 are parallel, 10–15 are fully parallel, 07→08→09 and 16→17→18→19 are chains. 20 is last because it documents bindings the other tickets establish.

## Epic 2 — de-mock, the engine behind the console (9 sub-issues)

| Key | Ticket |
| -- | -- |
| E1 | [Camera rig: absolute transform and orbit input](engine/e1-camera-rig.md) |
| E2 | [Projection: orthographic, FOV and clip planes](engine/e2-projection.md) |
| E3 | [Shading pipeline: normals, lighting, depth buffer and pipeline flags](engine/e3-shading.md) |
| E4 | [Materials: runtime texture, base colour and mesh scale](engine/e4-materials.md) |
| E5 | [World layers: grid, ground shadow, fog and world units](engine/e5-world.md) |
| E6 | [Renderer instrumentation: staged timings, draw calls, fill rate and depth bins](engine/e6-instrumentation.md) |
| E7 | [Scene model: real scene objects, per-object visibility, selection and projected bounds](engine/e7-scene.md) |
| E8 | [Session actions and keyboard](engine/e8-session.md) |
| E9 | [Resizable render target](engine/e9-resize.md) |

**Working order**, from the cross-ticket audit. Four of the nine propose an internal split; the split parts are shown where the order depends on them.

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

E9 is deliberately split across the whole epic: stage one has to land first because everything downstream assumes the projection is no longer welded to a 1024×640 canvas, and stage two cannot land until the passes it resizes exist. Consider filing the two stages as separate issues.

## Reference

| File | What it is |
| -- | -- |
| [reference/design-primitives.md](reference/design-primitives.md) | Exhaustive extraction from the design file: 37 hex literals, 12 rgba, 31 font shorthands, every spacing / radius / size / elevation / motion value, and a desktop-vs-mobile size-pair table. Feeds ticket 01. |
| [reference/decisions.md](reference/decisions.md) | The 11 binding decisions (D1–D11) that resolve every ownership overlap and contradiction across the set. Each ticket is written against these. |

## How these were produced

Drafted from the design file and the repo, then adversarially fact-checked against both — the check found 61 problems (4 blockers, 15 major), all applied. A completeness pass then caught three shipping gaps the per-widget drafts each assumed someone else owned: nothing deleted the legacy `body` rules, nothing removed `<aside id="controls">`, and nothing extended RESET to the new controls. Those are now decisions D2 and D7, and the shell and toolbar tickets own them.

Known corrections the tickets already carry, listed here because they contradict what the mockup implies:

- `Mesh.renderMesh` already sorts triangles back-to-front by centroid (`src/primitives/Mesh.ts:19`). The engine is not unsorted — it is per-mesh painter's algorithm, which fails on interlocking geometry and composites the two transition meshes in array order.
- `w = focal + z + zOffset` goes non-positive at reachable zoom settings (300 − 220 = 80 against the Menger sponge's z ≈ −182), so some vertices already project mirrored.
- The mockup's 4096 poly budget does not fit: the torus knot builds 7920 triangles.
- Registry counts, verified by executing the data module: sphere 143/240, cube 458/792, pyramid 5/6, cross 24/44, donut 861/1600, torusKnot 3960/7920, menger 4224/2112, cuboctahedron 12/20.
- `Main`'s constructor makes 22 `getElementById` calls guarded by 21 presence checks plus an `instanceof` test on `#opacitySlider`.
