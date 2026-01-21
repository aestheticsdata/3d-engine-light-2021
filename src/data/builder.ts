// builders.ts
//
// This file contains small geometry helpers used to generate meshes (points + triangles).
// We keep those helpers out of data.ts so that:
// - data.ts stays readable (it should describe objects, not implement algorithms)
// - geometry generation can be reused (cube, future planes, billboards, etc.)
// - math-heavy code is isolated, easier to test and evolve
//
// -----------------------------------------------------------------------------
// Why subdivision for textured quads?
// -----------------------------------------------------------------------------
// The renderer maps textures on triangles using a 2D canvas affine transform.
// Affine texture mapping is fast, but it is NOT perspective-correct.
// When a face rotates in 3D, perspective should "compress" parts of the texture
// differently across the surface. An affine transform cannot reproduce this,
// which causes visible texture warping/stretching.
//
// A pragmatic workaround is to subdivide each large quad into many small triangles.
// Each small triangle is still affinely mapped, but because triangles are small,
// the approximation error becomes tiny and the warping becomes visually negligible.
//
// -----------------------------------------------------------------------------
// Mathematical note: bilinear interpolation on a quad
// -----------------------------------------------------------------------------
// A quad surface is parameterized by (u, v) in [0..1]².
// We generate a grid (grid+1 by grid+1 vertices) by interpolating between edges.
//
// For a given v (vertical parameter):
//   left(v)  = lerp(p00, p01, v)
//   right(v) = lerp(p10, p11, v)
//
// Then for a given u (horizontal parameter):
//   p(u, v)  = lerp(left(v), right(v), u)
//
// This is bilinear interpolation, producing evenly distributed points on the quad.
// UVs are assigned linearly as (u, v), so texture coordinates match geometry.
//
// -----------------------------------------------------------------------------
// Winding order / back-face culling
// -----------------------------------------------------------------------------
// The engine uses back-face culling based on projected 2D winding.
// To keep faces visible, we must output triangles with a consistent winding.
// flipWinding allows reversing the winding if a face appears "inside-out".

export type UV = [number, number];

export type triangle =
  | [number, number, number, string]
  | [number, number, number, string, UV, UV, UV];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerp3 = (p0: number[], p1: number[], t: number) => [
  lerp(p0[0], p1[0], t),
  lerp(p0[1], p1[1], t),
  lerp(p0[2], p1[2], t),
];

const pushPoint = (points: number[][], p: number[]) => {
  points.push(p);
  return points.length - 1;
};

export const addTexturedQuadSubdiv = (args: {
  points: number[][];
  triangles: triangle[];
  p00: number[];
  p10: number[];
  p11: number[];
  p01: number[];
  tex: string;
  grid?: number;
  flipWinding?: boolean;
}) => {
  const { points, triangles, p00, p10, p11, p01, tex } = args;
  const grid = args.grid ?? 12;
  const flip = args.flipWinding ?? false;

  const idx: number[][] = [];
  for (let y = 0; y <= grid; y++) {
    const ty = y / grid;
    const row: number[] = [];
    const left = lerp3(p00, p01, ty);
    const right = lerp3(p10, p11, ty);

    for (let x = 0; x <= grid; x++) {
      const tx = x / grid;
      row.push(pushPoint(points, lerp3(left, right, tx)));
    }
    idx.push(row);
  }

  const uv = (x: number, y: number): UV => [x / grid, y / grid];

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const a = idx[y][x];
      const b = idx[y][x + 1];
      const c = idx[y + 1][x + 1];
      const d = idx[y + 1][x];

      const uva = uv(x, y);
      const uvb = uv(x + 1, y);
      const uvc = uv(x + 1, y + 1);
      const uvd = uv(x, y + 1);

      if (!flip) {
        triangles.push([a, b, c, tex, uva, uvb, uvc]);
        triangles.push([a, c, d, tex, uva, uvc, uvd]);
      } else {
        triangles.push([a, c, b, tex, uva, uvc, uvb]);
        triangles.push([a, d, c, tex, uva, uvd, uvc]);
      }
    }
  }
};
