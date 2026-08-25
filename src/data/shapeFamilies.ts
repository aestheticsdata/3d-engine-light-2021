// The primitive picker's sections, in the order they are drawn.
//
// An array and not a Record, because the order is the point: a Record's key
// order is an implementation detail and reading a layout out of it is how a
// section silently moves.
//
// The union type is derived FROM this list rather than declared beside it, and
// that is what closes the loop both ways. A shape cannot name a family that has
// no section — the name would not typecheck — and a family cannot exist without
// a place to be drawn, because this list is where families come from.
//
// Each entry is both the value a shape declares and the heading the picker
// prints, because today they are the same word. The day a family needs a
// heading that is not its own name — "PLATONIC" drawn as "PLATONIC SOLIDS" —
// this becomes an array of pairs and nothing else moves.
//
// UNCATEGORIZED IS A REAL SECTION, not a fallback. The four shapes in it —
// sphere, cube, pyramid, cross — are the engine's demo primitives and have no
// mathematical family in common; naming them PRIMITIVES implied one. It leads
// the list rather than trailing it so the boot shape is still the first row,
// and so the section a newcomer wants is not below eight near-identically
// spelled polyhedra.
//
// KNOTS was folded out of SURFACES when COS-410 landed the (2,5), (2,7) and
// (3,4) knots beside the trefoil: four shapes of one construction is a section,
// and leaving them next to the donut made SURFACES the second-largest family
// while saying nothing about what its members share. SURFACES keeps the donut,
// and FRACTALS keeps menger — both look thin, and both are the correct home for
// the next shape of their kind rather than a bucket to be merged away now and
// unpicked later.
//
// MOLECULES arrived with HAL-153: ball-and-stick chemistry beside the
// mathematics. It trails the list because a new family is appended rather than
// sorted in — the sections above it are where returning eyes expect them.
//
// Inert data with no behaviour, so it stays a table rather than becoming a class
// (decisions.md D1a).

const shapeFamilies = ["UNCATEGORIZED", "POLYHEDRA", "KNOTS", "FRACTALS", "SURFACES", "MOLECULES"] as const;

export type ShapeFamily = (typeof shapeFamilies)[number];

export default shapeFamilies;
