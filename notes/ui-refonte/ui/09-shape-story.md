# Shape story panel

The shape story is the editorial card at the bottom of the left sidebar: a large title, a two-paragraph write-up, a density badge and a pinned footer of geometry facts. It is the one part of the UI that is prose rather than telemetry, and it is what makes the engine read as a catalogue of solids instead of a debug harness.

**Design source** — `3D Engine UI.dc.html` desktop L134–L161, mobile L837–L863.

## Desktop

Card: the shared `.panel` recipe from the primitives ticket with the `.panel--fill` modifier (`flex: 1; min-height: 0`). It is the last child of the `#shapeInfoPanelContent` fade wrapper the SHAPE INFO ticket introduces, which is itself the `flex: 1` last item of the 264px left column — so the story card absorbs the remaining height through the wrapper, and `min-height: 0` on both is what lets the inner scroll clip. Header: `.panel__header` with `.panel__title` `SHAPE STORY` and `.panel__note` `read`.

Content: `.panel__body--scroll` plus this ticket's own `padding: var(--space-6) var(--space-6) var(--space-7)` (12px 12px 14px), flex column, `gap: var(--space-5)` (10px). Scrollbar styling is the global one primitives ships (8px, sunken track, muted thumb) — do not restate it.

Children in order:
1. Title — `var(--font-weight-bold) var(--text-4xl)/var(--leading-tight) var(--font-sans)` (22px/1.05), `letter-spacing: var(--tracking-tight)` (-.01em), `color: var(--color-text-max)`.
2. Rule — `height: var(--size-story-rule-h)` (2px), `width: var(--size-story-rule-w)` (28px), `background: var(--color-accent)`. Identical on mobile, do not scale it.
3. Paragraph 1 — `margin: 0`, `var(--font-weight-regular) var(--text-lg)/var(--leading-relaxed) var(--font-sans)` (11.5px/1.55), `color: var(--color-text-secondary)`, `text-wrap: pretty`.
4. Paragraph 2 — same, `color: var(--color-text-tertiary)`.
5. Density badge — `.badge.badge--info` from primitives, label `DENSITY`, value from the data table. No local geometry or colour rules.
6. Footer — `margin-top: auto`, flex column, `gap: var(--space-2)` (5px), `padding-top: var(--space-5)` (10px), `border-top: var(--size-hairline) solid var(--color-border-panel)`. Rows are flex, `align-items: center`, `justify-content: space-between`; label `var(--font-weight-medium) var(--text-sm)/var(--leading-none) var(--font-sans)` at `var(--tracking-lg)`, `color: var(--color-text-muted)`; value `var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)`, `color: var(--color-text-tertiary)`.

Footer rows: GENERATOR, WINDING (design L150–L157). A third REFERENCES row is added by this ticket and is **not** in the mockup — see "REFERENCES must survive" below; mark it in CSS with a `/* not in mockup */` comment.

`margin-top: auto` on the footer is what pins it to the bottom when the prose is short; when the prose is long the content scrolls and the footer scrolls with it. That is the mockup's behaviour — do not make the footer sticky.

## Mobile

Last of the three left-column cards in the mobile **SCENE** tab (design L837–L863), under SHAPE INFO. Below it sits the GESTURES card owned by the shortcuts ticket, which is the final card in the tab (D11). The 10px stack gap comes from the `#shapeInfoPanelContent` wrapper's mobile flex column (SHAPE INFO ticket), which matches the shell's own tab gap. No inner scroll — the page scrolls.

Deltas:
- The `read` note is **dropped** (mockup L839 has the title only); hide the `.panel__note` inside this card below 900px rather than shipping a second header.
- Content `padding: var(--space-7)` (14px), `gap: var(--space-5-5)` (11px), no `overflow: auto`; `.panel--fill`'s `flex: 1` and `min-height: 0` are neutralised below 900px so the card sizes to its prose.
- Title `var(--text-5xl)/var(--leading-tight)` (26px/1.05).
- Paragraphs `var(--text-2xl)/var(--leading-relaxed)` (13px/1.55), colours unchanged.
- Badge deltas (7px 10px, 7px gap, 10px label at .1em, 11px value) come from primitives' `.badge--info` media block; do not restate them.
- Footer `gap: var(--space-2-5)` (6px), `padding-top: var(--space-5-5)` (11px), **no** `margin-top: auto`; labels `var(--text-base)` at `var(--tracking-md)`, values `var(--text-base)` (10px).

The footer rows are `justify-content: space-between` at 10px on both sides, so a long generator value (`level-2 recursive carve`) and its label together run about 190px against a 272px content width at 320px — it fits without wrapping. Do not add an ellipsis clamp here; the prose card is allowed to be tall.

Reference links are the only interactive elements: give each `display: inline-flex; align-items: center; min-height: 44px` on mobile so the touch target clears 44px without changing the painted text, and lay the row out with `gap: var(--space-7)` (14px). The 44px links make the REFERENCES row taller than the other two footer rows; that is intended, and it is why the row uses `align-items: center` rather than a fixed height.

## Data

Sourced from `shapeInfo[primitive]` in `src/data/shapeInfo.ts`, written by `syncShapeInfoPanel` (index.ts L310–L314).

| Field | Value shown | Source today |
| --- | --- | --- |
| Title | e.g. `Menger Sponge` | `info.title`, falling back to `this.formatPrimitiveName(primitive)` when `info` is absent |
| Paragraph 1 | e.g. "A level-2 cube fractal…" | `info.description` |
| Paragraph 2 | e.g. "Only exposed voxel faces…" | `info.geometricFeature` |
| DENSITY | e.g. `Very high density` | `info.densityLabel` |
| GENERATOR | e.g. `lat/long bands` | New required field `generator` on `ShapeInfo` — see below. Em dash `—` when `info` is absent |
| WINDING | `counter-clockwise` | Hardcoded constant in markup — see below |
| REFERENCES | `Wikipedia` `MathWorld` | `info.references` via the existing `syncShapeReferences` (index.ts L319–L332), rendering into `#shapeStoryReferences` |

**The `if (!info)` guard is currently unreachable — keep it anyway.** All 8 primitive keys in `src/data/data.ts` have a `shapeInfo` entry, so the fallback at index.ts L301–L308 never fires today. It stays as the guard for a future primitive that lands without a write-up. What `cross` actually lacks is the optional `references` array (`src/data/shapeInfo.ts` L62–L70); 7 of the 8 shapes have one.

**GENERATOR — add the field, do not placeholder it.** Add `generator: string` to the `ShapeInfo` interface as a required field and fill all 8 entries; it is one line per shape of information the repo already knows, and a placeholder would be strictly worse than the truth. Proposed values, each consistent with the existing `geometricFeature` prose:

| key | generator |
| --- | --- |
| sphere | `lat/long bands` |
| cube | `unit hull + subdivided faces` |
| pyramid | `square base + apex fan` |
| cross | `extruded 2D profile` |
| donut | `ring sweep` |
| torusKnot | `p/q knot sweep` |
| menger | `level-2 recursive carve` |
| cuboctahedron | `convex hull builder` |

Making it required means the compiler catches any future primitive that forgets it.

**WINDING — a constant, on purpose.** Every primitive in this engine emits counter-clockwise triangles; commit `2fab553` normalised the torus knot and Menger sponge specifically so backface culling works uniformly. So `counter-clockwise` is a literal in the markup, not a data field. If a primitive ever lands with the opposite winding, this must move into `ShapeInfo` alongside `generator` — say so in a code comment next to the literal.

**REFERENCES must survive.** The mockup has no reference links; COS-212 shipped them and this rebuild keeps them. They stay in `#shapeStoryReferences` (same id, same `syncShapeReferences` code path, still `target="_blank"` + `rel="noopener noreferrer"` so the running animation is never torn down), now rendered as the value slot of a third footer row labelled `REFERENCES`, below WINDING. Restyle `.storyLink` from its current Futura / `#ffef93` styling to `var(--font-weight-regular) var(--text-sm)/var(--leading-none) var(--font-mono)` (desktop) / `var(--text-base)` (mobile), uppercase, `color: var(--color-accent)`, `border-bottom: var(--size-hairline) solid var(--color-accent)`, `text-decoration: none`; hover and `:focus-visible` go to `var(--color-accent-hover)` on both properties, with hover wrapped in `@media (hover: hover)`. The links row keeps `gap: var(--space-5)` (10px) on desktop. When a shape has no references (`cross`), hide the whole REFERENCES row, not just the empty container — extend the existing `.storyLinks:empty` idiom (main.css L151–L155) to the row with `:has(.storyLinks:empty)`.

**`showStory` — drop it.** In the mockup the card is behind `showStory: this.props.showShapeStory ?? true` (design L1398, gating the `<sc-if>` at L134 desktop and L837 mobile), a design-tool preview prop with no production equivalent. Render the card unconditionally; there is no reason to make it optional.

## Molecule mode

Added by HAL-157, for the MOLECULES family. The card has **two** modes now, and this section is
binding on the second exactly as everything above is on the first. For the twenty solids nothing
here applies and nothing above changes.

`ShapeStoryPanel.show(primitive, info, molecule?)` takes a third argument, `moleculeInfo[primitive]`,
which is `undefined` for every non-molecule. **Its presence is the whole of the switch** — no flag,
no second method, no branch in `Main`.

| Slot | Solid | Molecule |
| --- | --- | --- |
| `.panel__title` | `shape story` | `molecule properties` |
| Badge label | `DENSITY` | `FORMULA` |
| Badge value | `info.densityLabel` | `moleculeFormula(structure.atoms)` |
| GENERATOR row | shown | hidden |
| WINDING row | shown | hidden |
| `#shapeStoryProperties` | empty | one row per property, then MOLAR MASS |
| REFERENCES | `info.references` | `molecule.references` |

The header strings stay **lowercase in code**: `.panel__title` uppercases in CSS, so a pre-shouted
string would be a second styling source. Singular *molecule* — one is on screen, and this card's rule
is that its header names what it is showing. The `read` note is untouched, and still drops below
900px.

**The badge swap loses nothing.** POINTS and TRIANGLES sit on the SHAPE INFO card directly above and
are the real numbers, where `densityLabel` was only prose. Molecules still declare a `densityLabel` —
the field stays required, and stays honest, even while this card does not print it.

**GENERATOR and WINDING hide rather than being repurposed.** WINDING is a hardcoded literal in the
markup (see above); left standing under a chemistry header it would be the card asserting something
about a molecule that it is not saying. Hiding is the `hidden` attribute plus one rule —
`.shape-story__row[hidden] { display: none }` — because the UA's own `[hidden]` rule loses to the
author-level `.shape-story__row { display: flex }`.

**The property rows are the footer's own rows.** `#shapeStoryProperties` is `display: contents`, so
the injected rows become real flex items of `.shape-story__footer` and take its `gap` — a block
wrapper would have to restate that gap and the two would drift. The rows reuse
`.shape-story__row` / `__key` / `__value` unchanged; the links reuse `.shape-story__link`, 44px touch
targets and all. **Those two rules are the only CSS this mode adds.**

**Four properties maximum**, plus the derived MOLAR MASS, which is always last: the reader meets what
the file states before what was computed from it. The mass is formatted to 2 dp with `g/mol` **by the
panel** — `molarMass` returns a number precisely so it can be printed more than one way. The footer is
pinned with `margin-top: auto` and the card still has to fit at 320px, where every row pushes the
prose up.

**Three reference links, hard.** The REFERENCES row lays links out inline at a 14px gap with a 44px
touch target each on mobile, so a fourth wraps the row and unpins the footer. PubChem and Wikipedia
are mandatory, ChEBI where the molecule has an entry. All are static strings in `moleculeInfo.ts`;
nothing is fetched, at build time or run time. The rejected sources and the licensing reasons are in
HAL-153 and are not to be re-litigated.

**Every write must be total, and this is the mode's one real trap.** The same nodes are repainted on
every shape change, so each thing molecule mode touches — header, badge label, the two hidden rows,
the injected properties, *and the GENERATOR value itself* — has to be written back on the solid path
too. A field only one branch touches is a field that survives the switch away. `syncMode` is the
single place both branches go through, so there is one list to keep total rather than two that must
agree. The GENERATOR text is cleared entering molecule mode: nothing reads a hidden row, so it buys
no pixel, but a row holding the previous shape's generator is exactly that untotal write. It was
found by driving ten switches and diffing the card, which is the only way it surfaces.

## Constraints

- Shell has already replaced `src/index.html` wholesale and re-provided every id `Main`'s constructor resolves (D2). `shapeStoryTitle`, `shapeStoryDescription`, `shapeStoryFeature`, `shapeStoryDensity`, `shapeStoryReferences` all hard-fail if absent — keep every one of them and add `shapeStoryGenerator`.
- The card sits inside the `#shapeInfoPanelContent` fade wrapper introduced by the SHAPE INFO ticket, so the 180ms `panelFadeOut` / `panelFadeIn` covers info and story together, exactly as today.
- `.statsBadge` is not this ticket's to touch. The shell ticket has already deleted `.statsBadge` / `.statsBadgeRight` / `.statsLabel` / `.statsValue` (`src/styles/main.css` L205–L225) together with `<aside id="controls">` (D2), so by the time this ticket lands the DENSITY badge is the only former user left and it moves to primitives' `.badge--info`. Do not re-add any of those rules and do not claim ownership of their teardown.

## Files

- `src/index.html` — the SHAPE STORY card, with the GENERATOR / WINDING footer rows plus the added REFERENCES row.
- `src/data/shapeInfo.ts` — add required `generator: string` to the `ShapeInfo` interface; fill it for all 8 shapes.
- `src/index.ts` — add the `shapeStoryGenerator` node lookup and write `info.generator` (em dash fallback) in `syncShapeInfoPanel`.
- `src/styles/components/shapeStory.css` (new) — content padding, title, rule, prose, footer rows and link rules. No panel, header, badge or scrollbar rules; those are primitives'.
- `src/styles/main.css` — import the new component stylesheet; delete the superseded `.storyTitle` / `.storyText` / `.storyBadgeRow` / `.storyLinks` / `.storyLink` story rules (L129–L170), and `.panelTitle` / `.panelSubTitle` (L45–L56), whose last user this ticket removes.

## Done when

- [ ] Desktop card fills the remaining sidebar height, its content scrolls independently with the styled 8px scrollbar, and the sidebar itself never scrolls.
- [ ] Title renders 22px/1.05 at -.01em in `var(--color-text-max)`, followed by the 28×2 yellow rule.
- [ ] Both paragraphs render at 11.5px/1.55 with `text-wrap: pretty`, paragraph 1 in `var(--color-text-secondary)` and paragraph 2 in `var(--color-text-tertiary)`.
- [ ] Density badge is the shared `.badge--info`, hugs its content and does not stretch to the column width.
- [ ] Footer pins to the bottom of the card on short stories (`cuboctahedron`) and scrolls with the content on long ones (`menger`).
- [ ] GENERATOR shows a real per-shape value for all 8 primitives; `ShapeInfo.generator` is required and `tsc` fails if a shape omits it.
- [ ] WINDING reads `counter-clockwise` for every shape, with the code comment explaining why it is a constant.
- [ ] The REFERENCES row carries the `/* not in mockup */` marker in `shapeStory.css`.
- [ ] Wikipedia and MathWorld links still render for the 7 shapes that have them, still open in a new tab with `rel="noopener noreferrer"`, and are keyboard-focusable with a visible focus style.
- [ ] The REFERENCES row is fully hidden for `cross`, leaving no empty row or stray gap.
- [ ] Changing shape plays the 180ms fade with the info card, and every field updates.
- [ ] The DENSITY badge uses primitives' `.badge--info`; `grep -n 'statsBadge\|statsLabel\|statsValue' src/` returns nothing, and this ticket re-adds none of them.
- [ ] Mobile: card is the last of the three SCENE-tab left-column cards, above the GESTURES card, with a 26px header and no `read` note, 14px padding, 11px gap, 26px title, 13px paragraphs; links have a ≥44px touch target verified in device emulation.
- [ ] `shapeStory.css` contains no `.panel*`, `.badge*` or scrollbar selector, and no raw hex or px literals.
