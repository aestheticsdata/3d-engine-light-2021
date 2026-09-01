# Molecules — what lives here

The rules and the rulings behind the molecule family: **HAL-153**, which built
it, and **HAL-176**, the complex end. Ticket bodies live in Spira; this
directory holds only what a ticket cannot.

- **[reference/decisions.md](reference/decisions.md)** — the binding decisions
  (D1): what the envelope is for, the number the stage's own frame puts on it,
  and the molecule it refuses. Read it before arguing that a constant in
  `MoleculeGenerator.ts` should move.

The family's other rules live where they always have and are not restated
here: the shape story card's molecule mode is specified in
[../ui-refonte/ui/09-shape-story.md](../ui-refonte/ui/09-shape-story.md), and
the per-ticket conventions — two files per molecule, literal registry keys,
winding per component, the fixed Ångström scale, the geometry snapshot before
QA — are the **Shared conventions** section of HAL-153, which both epics bind
themselves to.
