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
// FRACTALS holds one shape and looks thin because of it. It stays: a Sierpinski
// or a Julia set belongs there and nowhere else, and folding it into SURFACES
// now would only have to be undone. POLYHEDRA is the section COS-201 grows, by
// roughly ten — no other section moves when it lands.
//
// Inert data with no behaviour, so it stays a table rather than becoming a class
// (decisions.md D1a).

const shapeFamilies = ["PRIMITIVES", "SURFACES", "FRACTALS", "POLYHEDRA"] as const;

export type ShapeFamily = (typeof shapeFamilies)[number];

export default shapeFamilies;
