# Binding decisions — molecules (HAL-153 / HAL-176)

Family rulings. A molecule ticket may not contradict one of these; if it needs
to, the decision changes here first. The card's molecule mode is ruled in
[../../ui-refonte/ui/09-shape-story.md](../../ui-refonte/ui/09-shape-story.md)
and the per-ticket conventions in HAL-153's own body — neither is restated
here.

---

## D1 — The envelope is what the stage can frame, and it is the family's number, not the registry's

`ENVELOPE_RADIUS` in
[`MoleculeGenerator.ts`](../../../src/data/shapes/MoleculeGenerator.ts) is a
**per-family ceiling on reach, set by what the stage frames at the default
view**. It is **230 engine units**. It is compared against and never multiplied
by, so moving it moves no mesh — the same property both earlier values had,
proven the same way, with a byte-identical geometry baseline.

**What the question was** (HAL-178). The constant's two previous values were
both facts about other things. 100 was the sphere's radius and the polyhedra's
circumradius, misread as a registry ceiling eight shapes were already past;
100·√3 ≈ 173.2 was the corner of the cube — the largest reach a solid arrives
at by construction, which is a real argument about the *solids* and says
nothing about how long a molecule may be. The drift is visible in one measured
row: retinol, twenty-one heavy atoms drawing at full resolution with exactly
aspirin's triangle count, refused at 199.1 units of reach — refused for being
*long*, by a wall built out of a cube.

**The derivation.** The default view is FOV 94 at zoom 50
([`CameraController.ts:55,47`](../../../src/app/CameraController.ts)), taken
at the stage's authored 1024×640
([`index.html`](../../../src/index.html)'s canvas, the size `Main.ts` asserts
at boot), which puts the focal at 320/tan 47° = 298.4 and the eye at
298.4/0.9375 = 318.3 units out. A shape spinning about the origin sweeps its
reach R into a sphere, and that sphere's projected half-extent is
fl·R/√(D² − R²) — read off
[`Camera.ts`](../../../src/primitives/Camera.ts)'s `scaleAt` and maximised
over the silhouette, not assumed. It fills the canvas's 320-pixel half-height
at **R = 232.8**; the 512-pixel half-width does not bind until 275, so
vertical decides. **230 is the largest round value under the limit**, chosen
the same way `ENGINE_UNITS_PER_ANGSTROM`'s 22 was. A molecule at the ceiling
fills 97% of the half-height at its widest spin phase and never leaves the
frame.

The stage is fluid and the camera tracks its height — the resize path reseeds
the focal from the live half-height, so the eye sits at 318.3·H/320 for a
stage H pixels tall, and the frameable reach scales the same way: about 192
units on a 528-pixel stage, 307 on an 846-pixel one, measured on the live
console. The authored size is the one the composition was designed at, so it
is the one the ceiling is derived at; on a shrunken stage a ceiling-reach
molecule crops mid-spin exactly as the solids already do at raised zoom, in
the same silent, artefact-free way.

**"Frames at the default view" is the criterion, and it is the one the
registry already lives by.** It cannot be "frames at every slider position":
at zoom 100 the eye sits 79.6 units out and every shape in the registry
reaches past it (`Camera.ts` says so beside its near plane); the sponge
overflows the frame from zoom ≈ 65, cube and pyramid from ≈ 67, the knots
from ≈ 83; and at FOV 120 the fill limit drops to about 171, under the cube's
own corner. Overflow at reachable slider positions has been the shipped norm
since the first commit, handled by a silent scanline crop in the rasteriser,
and no shape has ever been refused for it. The default view is where the
composition is judged; the ceiling guards that and nothing more.

**What it admits and what it refuses**, from the HAL-178 table, re-measured
against live PubChem records before this ruling was recorded — every row
reproduced to the decimal:

| | full-atom reach | heavy-skeleton reach | under 230 |
| -- | -- | -- | -- |
| retinol | 199.1 | 192.6 | admitted — renders today, lat 7, 7854 triangles |
| cholesterol | 191.1 | 176.0 | admitted by the envelope; still refused by the budget at 74 atoms |
| cholecalciferol | 195.3 | 184.3 | same — the budget is now the only wall |
| lanosterol | 211.8 | 210.1 | same, and the closest admitted case |
| β-carotene | 339.1 | 324.1 | **refused** |

The sterols' remaining wall is HAL-179's to take down: their heavy skeletons
fit both the budget and this ceiling, so hydrogen suppression is what puts
them on the stage, not a number in this file.

**β-carotene is refused, and not by a margin that a later nudge could close.**
Its reach exceeds the default eye distance itself — 324.1 against 318.3 — so
its spin would sweep *through the camera*: past that point there is no
orientation-independent silhouette at all, and the worst spin phase projects
without bound. No family ceiling admits it. The only thing that ever could is
answer C below — a stage that pulls back for what it is given — and that is a
camera ticket to file on the day the molecule is wanted, never a constant to
nudge.

**The rejected answers.** HAL-178 posed three. **A — the envelope is a
stage-composition rule owned by the camera** — rejected because it dissolves a
loud build-time refusal into runtime framing behaviour: the guard's whole
value is that a data file the stage cannot hold fails at registry evaluation
with its name in the message, rather than shipping and leaving the stage to
improvise. **C — no envelope, the camera clamps** — the most correct and the
most work; not taken, not damned. It is recorded here as the only path to
β-carotene. **B — the per-family ceiling — won** as the smallest change that
stops refusing retinol while the solids' 173.2 goes on meaning what it says.
Two candidate discounts were also rejected: sponge parity at 181.9 still
refuses retinol, which is the failure B exists to end; and the thumbnails'
0.82 fit margin (`ShapeThumbnails.ts:48`), giving 190.9, is a rule about
thumbnails — the stage's own largest solids sit at 60–65% fill, and applying
it here would refuse lanosterol at 210.1 for the comfort of a widget that
never draws it.

**Declared, not derived, and not imported.** The constant does not read
`CameraController`'s defaults: the data layer cannot depend on `src/app`, and
a moved UI default must not silently change which data files compile. If the
default view ever moves deliberately, this number is re-derived by hand and
this ruling is updated first — the same bargain the test suite's restated
constants make.

**What this ruling does not license.** `ENGINE_UNITS_PER_ANGSTROM` stays at
22 — a reach problem is never a scale problem, per HAL-153 and the
generator's own comment. The solids' 173.2 remains true of the solids and
governs nothing; it only ever lived in this constant's comment. The floor
line is not an objection either: a solid whose reach passes GROUND_Y = 175
dips below it mid-spin and draws in front of it — the sponge has done that
since its first commit — and for a molecule the question does not even arise,
because HAL-174 withdraws the scenery whenever one is on stage, which the
stage look for this ruling confirmed. And nothing here says
anything about *resolution* — what a molecule looks like when the triangle
budget squeezes it is D2, below.

## D2 — Below nine bands a molecule is drawn compact on purpose, and the card says so

`latSegmentsFor` in
[`MoleculeGenerator.ts`](../../../src/data/shapes/MoleculeGenerator.ts) walks
the one resolution knob down from twelve until the molecule fits the
8192-triangle budget, and throws at six. The walk is the right mechanism and
no policy at all: resolution falls out of the atom and bond counts, nobody
chooses it, no file can influence it, and no reader is told. Where the family
draws today and where the epic's measurements put what is planned:

| lat | who draws there | reads as |
| -- | -- | -- |
| 12 | water, methane, ammonia, CO₂, benzene, aspirin (8064 of 8192) | round |
| 11 | glucose (7920), caffeine (7964) | round |
| 10 | cholesterol's heavy skeleton, 7960 — planned, HAL-179 | round |
| 9 | lanosterol's heavy skeleton (7362), squalene's (6984) | read as balls on D1's stage look |
| 8 | coronene full-atom (7104) — measured at scoping, not in the registry | **visibly faceted** |
| 7 | retinol full-atom (7854) | faceted |
| 6 | C₆₀ (7920, the floor) | **a six-band lump** |

A reader looking at a six-band C₆₀ beside a twelve-band water cannot tell
*drawn at low resolution because it is large* from *badly modelled*, and
neither the engine nor the card can say which. That ambiguity, not the
triangle count, is the defect this ruling removes.

**HAL-169's answer C won — the trade is made deliberate — and D1's
measurements scope it.** The rejected answers, so they stay rejected: **A —
ship it faceted and say nothing** — free, and it leaves the ambiguity in
place permanently, in a console whose entire card philosophy is that it
explains what it shows. **B — raise the budget** — not a live option but a
*tried* one: HAL-173 raised it to 16384 with seventeen bands, caffeine went
to 15424 triangles and became the registry's densest shape, the console's
derived bar halved for twenty-four shapes that had not changed, caffeine's
frame time doubled from 3.7 ms to 7.4 ms, and the whole thing was reverted.
The record sits above `TRIANGLE_BUDGET` in `MoleculeGenerator.ts`; anyone
reopening B owes a frame-time plan, not a bar plan.

**The scope, measured rather than assumed.** After hydrogen suppression
(HAL-179), every named molecule in the epic's bands draws at nine bands or
better — the sterols at nine and ten, coronene's skeleton at eleven. What
still hits the floor is the all-carbon cages, which have no hydrogens to
suppress: C₆₀ draws at six, and C₇₀ (70 atoms, 105 bonds, 9240 triangles at
the floor) does not draw at all. So the deliberate trade is not the general
regime HAL-169 imagined. It is the exception lane for the cages, and it is
allowed to be simple.

**The mechanism: compact is a drawing style, not a mesh saving.** Same walk,
same lat, same triangle count — **ball radius at a quarter of the covalent
radius instead of ball-and-stick's half**. The number is derived, not tasted:
facet legibility is screen-space, and at half the radius a six-band ball's
latitude band is exactly the height of a twelve-band ball's at full radius
(π·r/2 over 6 equals π·r over 12), so 0.25 is the scale at which the floor's
bands shrink back to full resolution's; the longitude facet binds looser, at
0.286. Rods stay at `ROD_RADIUS`, which is what makes the picture rod-heavy —
a compact hydrogen ball approaches the rod's own girth, which is the licorice
look every chemistry viewer reaches for at scale, here on purpose. **The
threshold is the walked lat: eight and below draws compact, nine and above
draws ball-and-stick unchanged.** Nine is where the recorded evidence splits
— lanosterol's skeleton drew at nine on D1's stage look and read as balls;
coronene at eight was recorded visibly faceted when the band was scoped. The
first compact molecule to land (C₆₀, HAL-169) confirms 0.25 against the
stage, and both numbers move only through this file.

**A molecule file says nothing about its own resolution.** The formula's rule,
applied again: derived, one derivation, one place. A file that could declare
a radius or a band count could contradict the arithmetic the way a declared
formula could contradict the mesh, and per-file knobs are rejected for
exactly that reason — HAL-169's phrase "a property of the molecule" is
honoured as *derived from* the molecule, never *declared by* it.

**The reader is told on the card, by derivation, exactly when it is true.**
The MOLECULE PROPERTIES card gains a **DETAIL** row if and only if the walk
landed at eight or below — produced by the panel from the same arithmetic
that drew the mesh, never authored: `moleculeInfo` may not carry the label,
so the card cannot claim a squeeze that did not happen or stay silent about
one that did. The row counts toward the card's four-row ceiling, so a compact
molecule authors at most two properties beside the derived MOLAR MASS.
Eleven-versus-twelve stays untold on purpose: glucose and caffeine are not
faceted, and a row saying "reduced" over an invisible difference is noise
that spends the card's scarcest resource. `notes/ui-refonte/ui/09-shape-story.md`
gains the row's spec when the first compact molecule ships — a mode the spec
does not mention is a rule broken in silence.

**One invariant amended, deliberately.** "A given element is drawn at one
size in every molecule" becomes per-style: one size in every ball-and-stick
molecule, one smaller size in every compact molecule. The comparison the
invariant protects survives inside each style, the DETAIL row is where a
reader learns the styles differ, and the suite's cross-family size assertion
splits by style when the first compact molecule lands — that split is
licensed here, not a drift to be reverted.

**What this does not rule.** Bonds-only (HAL-170) is not the compact style
and does not become one: it was conceived as a reader-chosen render mode and
that reasoning stands, but its budget arithmetic no longer buys what it
claimed — the molecules past 68 heavy atoms it was written for are mostly
refused by D1's envelope before the budget is ever consulted, so its
re-scoping is the epic's business, not this file's. Nothing here licenses a
per-molecule budget — the epic already refuses one — and nothing here
reopens B.
