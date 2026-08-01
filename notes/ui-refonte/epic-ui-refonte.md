Parent issue for the full UI rebuild of the engine console, from the redesign done in Claude Design. **One sub-issue per widget.**

Everything below is shared context; the per-widget layout specs live in the sub-issues.

## Design source

Claude Design project [3D Engine UI](https://claude.ai/design/p/7ef5a074-a5cb-445e-8d7f-c9077970e48b?file=3D+Engine+UI.dc.html) — file `3D Engine UI.dc.html`.

Structure of that file, referenced by line number throughout the sub-issues:

| Lines | Contents |
| -- | -- |
| 14–28 | global styles: font links, range input skin, scrollbars, `recblink` keyframes |
| 33–671 | **desktop** branch — 1440×900 frame, 8px page padding, 8px gaps |
| 673–1114 | **mobile** branch — full width, 10px padding, 10px gaps |
| 1120–1536 | state class: `SHAPES`, `STATIC_INFO`, `MODES`, `FILTERS`, `TEX`, `state`, `tick()`, `drawFps()`, `renderVals()` |

The redesign replaces the console wholesale: a 1991-workstation look in Space Grotesk + JetBrains Mono over a near-black navy, panels as bordered cards with a titled header strip, a yellow accent, and telemetry read as instrument readouts. It supersedes the current Futura / `#ffef93` / `#10afff` styling in `src/styles/main.css` and essentially all of `src/index.html`.

## The three rules for this epic

**1. Tokens first, and split by type.** Every colour, type ramp, spacing step, radius, component size, elevation, motion value and breakpoint is a CSS custom property in `src/styles/tokens/`, one file per token type, imported at the top of `src/styles/main.css` — the same shape as the `pfa` project's `styles/tokens/`. No sub-issue may introduce a raw hex or a raw px for a tokenised value.

**2. Every widget ships on mobile.** The mockup only drew part of the console at mobile width. That is not the scope: a widget ticket is only Done when both layouts are built. Where the mockup has no mobile version, the sub-issue specifies one following the mobile branch's own conventions (10px padding, 10px stack gap, 26px panel header, ≥44px touch targets, sliders as label/value row above a full-width 26px range).

**3. Build the UI now, wire it later.** Most of what the mockup shows has no renderer behind it. Widget tickets build the full chrome regardless, reading real engine state where it exists and a clearly-marked placeholder where it does not. Turning each placeholder into real data is a separate epic, tagged `de-mock`.

## What is real today vs mocked

Real in the engine now: the 8 primitives in `src/data/data.ts`; wireframe; backface culling; opacity (disabled while culling is on, with a tooltip explaining why); zoom / pitch / yaw / roll / rotation-speed; pause-play; reset; live FPS; live triangles-rendered; shape info, story and reference links; the sky + checker-floor + vignette background; the dog and galaxy textures.

Mocked in the mockup, and therefore placeholders here: the six shading modes, perspective/orthographic, lighting, fog, grid step, the sky/floor/grid/shadow toggles, z-buffer / dithering / edge-AA, UV scale, base colour, the scene graph, capture PNG, save/load preset, copy code, camera view presets, the frame-time breakdown, the z-buffer histogram, JS heap, DPR, uptime, poly budget, draw calls, culled count, fill rate, step-frame, and the keyboard shortcuts.

## Known mismatches between the mockup and the engine

These are not oversights in the design; they are decisions each sub-issue has to make explicitly.

- **The primitive grid.** The mockup hardcodes eight shapes that are not this engine's shapes (sphere, cube, torus, icosa, cylinder, cone, teapot, terrain). The real registry is `src/data/data.ts`, and COS-201 will add roughly ten more polyhedra — so the grid is generated, not hardcoded, and has to survive well past eight entries.
- **Transform semantics.** The mockup's PITCH / YAW / ROLL are absolute angles. The engine's are rotation *rates* offset from the canvas centre, on completely different ranges. Reconciling the two is the SHAPE tab's call and it cascades into the camera view presets.
- **Camera model.** The mockup derives a camera position from yaw/pitch/zoom trigonometry. The engine has a focal length and a z-offset, and no camera object.
- **Canvas size.** The canvas is a fixed 1024×640 in `src/index.html`, and `BackgroundRenderer` and `ShapeTransitionMachine` both take width and height at construction. A fluid viewport needs a resize path; the shell ticket ships the CSS box and the resize lands with the de-mock work. 1024×640 is 16:10, which matches the mockup's mobile `aspect-ratio: 16/10` exactly.
- **Shape story.** The mockup drops the Wikipedia / MathWorld links that COS-212 shipped. They stay.

## Sub-issues

| # | Sub-issue | Phase |
| -- | -- | -- |
| 01 | Design tokens: split the console palette into per-type files | foundation |
| 02 | Panel and control primitives (shared CSS component layer) | foundation |
| 03 | App shell, legacy teardown and shared state layer | foundation |
| 04 | Top toolbar: brand block, transport, live readouts, action cluster | chrome |
| 05 | Viewport frame and HUD overlays | chrome |
| 06 | Status bar | chrome |
| 07 | Scene graph panel | left column |
| 08 | Shape info panel | left column |
| 09 | Shape story panel | left column |
| 10 | Framerate widget | telemetry |
| 11 | Frame time widget | telemetry |
| 12 | Geometry widget | telemetry |
| 13 | Z-buffer histogram widget | telemetry |
| 14 | Camera stats widget | telemetry |
| 15 | System widget | telemetry |
| 16 | SHAPE tab: primitive picker, transform, material | inspector |
| 17 | RENDER tab: shading mode, pipeline, lighting | inspector |
| 18 | WORLD tab: camera and environment | inspector |
| 19 | Quick toggles: SKY / FLOOR / GRID / WIRE / CULL | inspector |
| 20 | Shortcuts panel and mobile gestures card | last |

`01 -> 02 -> 03` are strictly ordered: every component declaration is a `var()`, shell's cards are primitives' `.panel`, and shell replaces `src/index.html` wholesale while re-providing every element id `Main`'s constructor requires — the branch must still boot after ticket 03 alone. After that, 04-06 are parallel, 10-15 are fully parallel, and 07->08->09 plus 16->17->18->19 are chains. 20 lands last because it documents bindings the other tickets establish.

## Conventions for every sub-issue

- Markup in `src/index.html`, styling in `src/styles/`, behaviour in `src/ui/`. Vanilla TypeScript and plain CSS — no framework, no new runtime dependency.
- **One owner per recipe.** The panel card, header strip, info row, stat row, stat tile, chip, ON/OFF toggle, slider row, range skin, swatch, badge, HUD chip, divider, scrollbar and the placeholder affordance are declared once, in ticket 02. Every other ticket consumes them and never restates a colour table.
- **One derivation per shared value.** `sceneObjectId`, `modeLabel`, `texLabel`, the measured `frameMs` and the uptime clock each have exactly one owner that exports them.
- **One token name, two values.** A token keeps a single name and changes value inside `@media (max-width: 899px)`. There are no `*-mobile` token names. The breakpoint is exclusive: desktop `min-width: 900px`, mobile `max-width: 899px`.
- **Three different triangle counts**, and each ticket says which it means: the static registry count, the drawn count returned by `Surface3D.render`, and culled as the difference while culling is on.
- **RESET restores everything.** A control added by any sub-issue is only Done when RESET restores it too, on both desktop and mobile.
- Anything a widget cannot feed with real data renders a visibly-marked placeholder — `data-placeholder="true"` plus a `title` — and the sub-issue names the de-mock ticket that owns it.
- Existing behaviour that must survive the rebuild: the shape-change fade on the info panel, the opacity slider disabling itself while culling is on together with its follow-cursor tooltip, and the reference links in the story panel.
- `statsMode` and `hudOverlays` are Claude Design preview props with no production surface. Both are dropped: every telemetry card always renders, and the HUD is always on.

The full set of cross-cutting rulings, including the ones that resolve contradictions between sub-issues, is in `notes/ui-refonte/reference/decisions.md` (D1–D11).
