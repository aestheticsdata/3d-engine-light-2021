// Texture coordinates for the nineteen primitives that were never authored any.
//
// Only the cube has UVs: two of its faces are subdivided into a 14x14 grid and
// carry a bitmap each, and everything else in the registry pushes a 4-tuple with
// no texture coordinates at all. A procedural mode has to sample something on
// those nineteen shapes, so this projects one.
//
// From the registry's own point table, never from the live Point3D instances.
// setTransform rewrites every vertex from its pristine source each frame, so a
// UV derived there would swim across the surface as the shape turned — the
// texture would be painted onto the screen rather than onto the object. Here it
// is derived once per mesh build, from coordinates nothing ever moves.
//
// It is a projection and not an unwrap, and the difference is visible: it reads a
// direction from the origin and discards the distance, so on the cross and the
// Menger sponge the pattern lands at whatever angle a face happens to present.
// That is honest for a checker and it is the whole point of a UV grid, which
// exists to show exactly this kind of distortion. Do not read a wrong-looking
// checker on a concave solid as a bug in this file.
//
// The consequence worth knowing about is that the projection is NOT injective:
// two vertices on one ray get identical coordinates, which no amount of guarding
// here can prevent. Triangle.fill is what handles the face that comes out with a
// degenerate UV triangle, by falling back to a flat lit fill.

import type { Object3D, UV } from "@data/types";

// The three corners of one face, in the winding order the registry declared.
export type FaceUV = readonly [UV, UV, UV];

const TAU = Math.PI * 2;
// Only the origin itself has no direction to project, and no shape in the
// registry puts a vertex there — but the Menger sponge and the cross both carry
// coordinates near it, and a NaN reaching a fill is invisible in a stack trace.
const AT_ORIGIN = 1e-6;
// A face whose u spans more than half the texture is not a wide face. It is a
// face straddling u = 0/1, and the affine solve would run the whole texture
// backwards across it rather than the sliver it actually covers.
const SEAM_SPAN = 0.5;

// v is 0.5 PLUS the arcsine, where every reference for this projection writes
// minus, and the sign is the difference between an upright texture and an
// upside-down one. y runs DOWN in this engine — convert3D2D is
// `centerY + y * scale` — so +y is the underside of a shape and belongs at the
// bottom of the image. The registry settles it rather than the reasoning: the
// cube's galaxy face maps its p00 corner, at model y = -100, to v = 0, so the
// top of the texture is the top of the screen.
const pointUV = (x: number, y: number, z: number): UV => {
  const radius = Math.hypot(x, y, z);

  if (radius < AT_ORIGIN) {
    return [0, 0];
  }

  return [0.5 + Math.atan2(z, x) / TAU, 0.5 + Math.asin(Math.min(1, Math.max(-1, y / radius))) / Math.PI];
};

// Returns the same tuple rather than a copy when nothing needs shifting, which
// is what lets a face share its corners' UVs with its neighbours: these are read
// by the affine solve and written by nobody, so one object per point is enough
// for the whole mesh and only a seam face allocates.
const wrapSeam = (a: UV, b: UV, c: UV): FaceUV => {
  const lowest = Math.min(a[0], b[0], c[0]);

  if (Math.max(a[0], b[0], c[0]) - lowest <= SEAM_SPAN) {
    return [a, b, c];
  }

  return [shiftedPastSeam(a), shiftedPastSeam(b), shiftedPastSeam(c)];
};

// Past 1 rather than back below 0, so the scale multiply that follows keeps the
// face contiguous at every UV SCALE instead of tearing it at a tile boundary.
const shiftedPastSeam = (uv: UV): UV => (uv[0] < SEAM_SPAN ? [uv[0] + 1, uv[1]] : uv);

// Null where the registry authored its own coordinates, which is how authored
// UVs win: they win by never being generated over. Reading both tables here
// rather than in MeshFactory keeps that rule in one place, beside the seam fix
// it has to compose with.
export const sphericalUVs = (object3D: Object3D): (FaceUV | null)[] => {
  const perPoint = object3D.points.map((point) => pointUV(point[0], point[1], point[2]));

  return object3D.triangles.map((triangle) =>
    triangle.length === 7 ? null : wrapSeam(perPoint[triangle[0]], perPoint[triangle[1]], perPoint[triangle[2]]),
  );
};
