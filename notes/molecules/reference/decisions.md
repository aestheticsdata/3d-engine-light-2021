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
budget squeezes it is HAL-177's ruling, which appends to this file when it
lands.
