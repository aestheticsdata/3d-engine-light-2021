// The shapes of the geometry registry, and nothing else.
//
// No imports, on purpose. This module used to take its triangle type from the
// algorithm module beside it, so importing a compile-time-only type dragged a
// module-scope 12x12x12 adjacency search in with it — a UI file that wanted
// nothing but `Object3D` ran the icosahedron scan to get it. The arrow points
// the other way now: builders and shapes import types, never the reverse.

export type UV = [number, number];

// A face, as indices into the mesh's point table plus a fill.
//
// A union of two tuples rather than one interface with optional fields, and the
// difference is load-bearing: `length === 7` narrows it, so the three UV slots
// are either all present or all absent and a five-slot half-textured face is
// unrepresentable rather than merely discouraged.
export type Triangle3D =
  | [number, number, number, string]
  | [number, number, number, string, UV, UV, UV];

export interface Object3D {
  points: number[][];
  triangles: Triangle3D[];
}

export interface Data3D {
  [k: string]: Object3D;
}
