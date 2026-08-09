// GOURAUD's per-vertex normals, and the shade each one comes out at
// (E3c/COS-243).
//
// A vertex normal is the area-weighted sum of the faces meeting at it, and the
// weighting is free: the cross product (b - a) x (c - a) has magnitude twice the
// triangle's area, so accumulating the raw product and normalising once at the
// end weights every face by its own area without a single extra multiply. A
// large face therefore pulls its corners more than a sliver does, which is what
// stops a fan of thin triangles around a pole from dominating the vertex they
// share.
//
// The accumulated sum points AWAY from the eye, because each face's raw cross
// product does — the negation is folded into the reciprocal below, exactly as
// Lighting.computeTerms folds it, and it happens once per vertex here rather
// than once per face.
//
// Rebuilt every frame rather than derived once and rotated. The normals have to
// be in the same space Lighting.eye is, and the points hold whatever the frame's
// setTransform wrote — reading them straight is always right, where carrying an
// object-space set would need the rotation threaded down and would still be
// wrong the moment a non-uniform transform appeared.
//
// Two Float32Arrays rather than one array of triples: allocated once for the
// life of the mesh and refilled in place, which is the same reason RenderStats
// holds a Uint32Array of bins instead of rebuilding one per frame.

import type Triangle from "@primitives/Triangle";
import type Lighting from "@rendering/Lighting";

// The floor below which a vertex has no usable normal — every face around it
// was degenerate. Real rather than defensive: SphereGenerator emits thirteen
// coincident points at each pole, so a vertex whose whole fan is zero-area is a
// shape in the registry, not a hypothetical.
const DEGENERATE = 1e-9;

// What such a vertex shades at. Full ambient rather than black: an unlit spot
// on an otherwise smooth surface reads as a hole, and the pole of a sphere is
// where it would land.
const UNSHADEABLE = 1;

class VertexNormals {
  private readonly accumulated: Float32Array;
  private readonly shades: Float32Array;

  constructor(pointCount: number) {
    this.accumulated = new Float32Array(pointCount * 3);
    this.shades = new Float32Array(pointCount);
    this.shades.fill(UNSHADEABLE);
  }

  public shadeAt(index: number): number {
    return this.shades[index];
  }

  // Takes the mesh's own triangles rather than a normal-producing interface:
  // a Triangle needs no DOM, so the suite builds real ones (see
  // src/primitives/__tests__/projection.test.ts) and a duck type would be
  // indirection for a second caller that does not exist.
  //
  // Two passes, and they cannot be one: a vertex's normal is not known until
  // every face touching it has been added, so nothing can be shaded during the
  // accumulation.
  public rebuild(triangles: readonly Triangle[], lighting: Lighting) {
    this.accumulated.fill(0);

    for (const triangle of triangles) {
      triangle.accumulateFaceNormal(this.accumulated);
    }

    for (let index = 0; index < this.shades.length; index += 1) {
      const slot = index * 3;
      const nx = this.accumulated[slot];
      const ny = this.accumulated[slot + 1];
      const nz = this.accumulated[slot + 2];
      const length = Math.hypot(nx, ny, nz);

      if (length < DEGENERATE) {
        this.shades[index] = UNSHADEABLE;
        continue;
      }

      const inverse = -1 / length;

      this.shades[index] = lighting.shadeForNormal(nx * inverse, ny * inverse, nz * inverse);
    }
  }
}

export default VertexNormals;
