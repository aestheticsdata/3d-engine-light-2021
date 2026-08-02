// The mesh accumulator every generator in src/data/shapes builds through.
//
// It replaces a set of module-scope functions that took the two arrays as
// out-parameters, so every shape file declared a loose `points` and `triangles`
// and stapled them together at the end. Here the arrays are the object's, and
// `addPoint` returning the index it wrote is what makes vertex identity
// expressible at all.
//
// -----------------------------------------------------------------------------
// Why subdivision for textured quads?
// -----------------------------------------------------------------------------
// The renderer maps textures onto triangles with a 2D canvas affine transform.
// Affine mapping is fast but is NOT perspective-correct: when a face rotates in
// 3D, perspective should compress parts of the texture differently across the
// surface, and an affine transform cannot reproduce that. The result is visible
// warping.
//
// The workaround is to subdivide each large quad into many small triangles. Each
// small triangle is still affinely mapped, but because the triangles are small
// the approximation error becomes tiny and the warping visually negligible.
//
// The grid itself is bilinear interpolation over (u, v) in [0..1]²:
//   left(v) = lerp(p00, p01, v), right(v) = lerp(p10, p11, v)
//   p(u, v) = lerp(left(v), right(v), u)
// UVs are assigned linearly as (u, v), so texture coordinates match geometry.
//
// Winding: the engine culls by projected 2D winding, so triangles must come out
// consistently wound. `flipWinding` reverses it for a face that appears
// inside-out.

import PolyhedronBuilder from "@data/builders/PolyhedronBuilder";
import type { Object3D, Triangle3D, UV } from "@data/types";

const DEFAULT_SUBDIVISION_GRID = 12;
const DEFAULT_CIRCUMRADIUS = 100;

// Seeds, for the one shape that hand-authors its corner points and its flat
// faces before asking for two subdivided textured ones.
export interface MeshBuilderOptions {
  points?: number[][];
  triangles?: Triangle3D[];
}

export interface TexturedQuadOptions {
  p00: number[];
  p10: number[];
  p11: number[];
  p01: number[];
  tex: string;
  grid?: number;
  flipWinding?: boolean;
}

export interface ConvexPolyhedronOptions {
  vertices: number[][];
  faces: number[][];
  colorForFace: (vertexCount: number, faceIndex: number) => string;
  radius?: number;
}

class MeshBuilder {
  private readonly points: number[][];
  private readonly triangles: Triangle3D[];
  private readonly polyhedron: PolyhedronBuilder;

  constructor(options: MeshBuilderOptions = {}) {
    this.points = options.points ?? [];
    this.triangles = options.triangles ?? [];
    this.polyhedron = new PolyhedronBuilder();
  }

  public get mesh(): Object3D {
    return { points: this.points, triangles: this.triangles };
  }

  public get pointCount(): number {
    return this.points.length;
  }

  public pointAt(index: number): number[] {
    return this.points[index];
  }

  public addPoint(point: number[]): number {
    this.points.push(point);

    return this.points.length - 1;
  }

  public addTriangle(triangle: Triangle3D) {
    this.triangles.push(triangle);
  }

  // The two quad methods are NOT the same operation and must never be merged
  // under one name. This one takes indices into points that already exist and
  // shares them; the next appends four fresh points and shares nothing, and the
  // two wind in opposite directions. Merging them silently corrupts one caller,
  // and the only tell is a face rendering inside-out.
  //
  // Positional rather than an options object because the order IS the meaning:
  // these four indices are a winding, and naming them would not make the order
  // any less load-bearing.
  public addQuadByIndices(
    a: number,
    b: number,
    c: number,
    d: number,
    color: string,
  ) {
    this.triangles.push([a, b, c, color]);
    this.triangles.push([a, c, d, color]);
  }

  public addQuadByCoords(
    p0: number[],
    p1: number[],
    p2: number[],
    p3: number[],
    color: string,
  ) {
    const i0 = this.addPoint(p0);
    const i1 = this.addPoint(p1);
    const i2 = this.addPoint(p2);
    const i3 = this.addPoint(p3);

    this.triangles.push([i0, i2, i1, color]);
    this.triangles.push([i0, i3, i2, color]);
  }

  public addTexturedQuadSubdiv(options: TexturedQuadOptions) {
    const { p00, p10, p11, p01, tex } = options;
    const grid = options.grid ?? DEFAULT_SUBDIVISION_GRID;
    const flip = options.flipWinding ?? false;

    const idx: number[][] = [];
    for (let y = 0; y <= grid; y += 1) {
      const ty = y / grid;
      const row: number[] = [];
      const left = this.lerp3(p00, p01, ty);
      const right = this.lerp3(p10, p11, ty);

      for (let x = 0; x <= grid; x += 1) {
        const tx = x / grid;
        row.push(this.addPoint(this.lerp3(left, right, tx)));
      }
      idx.push(row);
    }

    const uv = (x: number, y: number): UV => [x / grid, y / grid];

    for (let y = 0; y < grid; y += 1) {
      for (let x = 0; x < grid; x += 1) {
        const a = idx[y][x];
        const b = idx[y][x + 1];
        const c = idx[y + 1][x + 1];
        const d = idx[y + 1][x];

        const uva = uv(x, y);
        const uvb = uv(x + 1, y);
        const uvc = uv(x + 1, y + 1);
        const uvd = uv(x, y + 1);

        if (!flip) {
          this.triangles.push([a, b, c, tex, uva, uvb, uvc]);
          this.triangles.push([a, c, d, tex, uva, uvc, uvd]);
        } else {
          this.triangles.push([a, c, b, tex, uva, uvc, uvb]);
          this.triangles.push([a, d, c, tex, uva, uvd, uvc]);
        }
      }
    }
  }

  // A face is fan-triangulated and all of its triangles share one colour. That
  // is deliberate: these solids are about their polygonal faces, and colouring
  // the fan triangles individually makes a cuboctahedron read as 20 triangles
  // rather than as 6 squares and 8 triangles.
  public addConvexPolyhedron(options: ConvexPolyhedronOptions) {
    const radius = options.radius ?? DEFAULT_CIRCUMRADIUS;
    const scaled = this.polyhedron.centerAndScale(options.vertices, radius);

    const baseIndex = this.points.length;
    scaled.forEach((vertex) => this.points.push(vertex));

    this.polyhedron
      .orderFaces(scaled, options.faces)
      .forEach((ordered, faceIndex) => {
        const color = options.colorForFace(
          options.faces[faceIndex].length,
          faceIndex,
        );

        for (let i = 1; i < ordered.length - 1; i += 1) {
          this.triangles.push([
            baseIndex + ordered[0],
            baseIndex + ordered[i],
            baseIndex + ordered[i + 1],
            color,
          ]);
        }
      });
  }

  private lerp3(p0: number[], p1: number[], t: number): number[] {
    return [
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t,
      p0[2] + (p1[2] - p0[2]) * t,
    ];
  }
}

export default MeshBuilder;
