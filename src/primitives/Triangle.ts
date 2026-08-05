// -----------------------------------------------------------------------------
// UV / TEXTURE MAPPING SUPPORT
// -----------------------------------------------------------------------------
// This Triangle can be rendered in two different modes:
//
// 1) Flat color:
//    - material is a CSS color string (e.g. "rgba(...)").
//    - the triangle is filled with ctx.fill().
//
// 2) Textured:
//    - material is a texture key (e.g. "dog", "galaxy") used to fetch an image
//      from the textures registry carried in the render options.
//    - uva/uvb/uvc define the (u,v) texture coordinates for each vertex.
//
// UV coordinates:
// - u and v are normalized in [0..1].
// - (0,0) is the top-left of the texture, (1,1) is the bottom-right.
// - each triangle vertex (A,B,C) has its own UV (uva, uvb, uvc).
//
// Why UVs are optional:
// - most primitives are still solid colors.
// - only some objects (like the cube faces) need textures.
// - keeping UVs optional avoids changing every triangle in the registry.
//
// The affine mapping itself, and the notes explaining it, live with
// AffineTextureMapper.
// -----------------------------------------------------------------------------

import Point2D from "@primitives/Point2D";
import AffineTextureMapper from "@rendering/AffineTextureMapper";

import type { UV } from "@data/types";
import type Point3D from "@primitives/Point3D";
import type TextureRegistry from "@textures/TextureRegistry";

export interface TriangleRenderOptions {
  // Required, not optional. An optional registry means a wiring mistake falls
  // through to filling with the raw material string — "dog" as a fillStyle,
  // which paints black and throws nothing. Required makes that a compile error.
  textures: TextureRegistry;
  wireframe?: boolean;
  cullBackfaces?: boolean;
  opacity?: number;
}

class Triangle {
  private a: Point3D;
  private b: Point3D;
  private c: Point3D;

  // Scratch, rewritten by every render and read by nothing outside this class.
  // Declared rather than assigned in the constructor on purpose: under
  // `useDefineForClassFields` these are real properties holding undefined from
  // construction, not properties that appear on the first render.
  private aproj: Point2D;
  private bproj: Point2D;
  private cproj: Point2D;

  // can be a color OR a texture key
  private material: string;

  // optional UVs
  private uva?: UV;
  private uvb?: UV;
  private uvc?: UV;

  // One per triangle rather than one shared instance, which costs an empty
  // object per triangle at mesh-build time and nothing at all per frame. The
  // alternatives were a module-scope singleton — the shape this epic is
  // removing everywhere else — or an eighth constructor argument on a
  // constructor that has to stay spreadable from a registry tuple.
  private readonly textureMapper: AffineTextureMapper;

  // Positional, and one of the constructors R4 exempts by name: MeshFactory
  // spreads a registry tuple straight into it, and the order of a, b, c is the
  // winding.
  constructor(a: Point3D, b: Point3D, c: Point3D, material: string, uva?: UV, uvb?: UV, uvc?: UV) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.material = material;
    this.uva = uva;
    this.uvb = uvb;
    this.uvc = uvc;
    this.textureMapper = new AffineTextureMapper();
  }

  public get depth(): number {
    return (this.a.zValue + this.b.zValue + this.c.zValue) / 3;
  }

  // One save, one restore, on every path that reaches them. The cull exit leaves
  // before the save and so restores nothing; the other three each close the one
  // pair this method opened. The textured branch opens a second pair inside the
  // mapper and closes it there.
  public render(
    context: CanvasRenderingContext2D,
    offsetX: number = 0,
    offsetY: number = 0,
    options: TriangleRenderOptions,
  ): boolean {
    // Before the projection, not after: a vertex behind the eye divides by a
    // negative depth and lands mirrored across the vanishing point, so by the
    // time there are three projected points there is nothing left to recognise
    // the case by. The backface test below is a 2D winding check and would read
    // that mirrored triangle as a legitimately front-facing one.
    if (this.isClipped()) {
      return false;
    }

    this.project(offsetX, offsetY);

    if ((options.cullBackfaces ?? true) && this.isBackfacing()) {
      return false;
    }

    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, options.opacity ?? 1));

    if (options.wireframe) {
      this.strokeWireframe(context);
      context.restore();

      return true;
    }

    // Read at render time, never snapshotted at mesh-build time: a texture
    // that finishes decoding after the mesh was built still appears.
    const image = options.textures.get(this.material);

    if (!image || !this.uva || !this.uvb || !this.uvc) {
      this.fillFlat(context);
      context.restore();

      return true;
    }

    const drawn = this.textureMapper.draw({
      context,
      a: this.aproj,
      b: this.bproj,
      c: this.cproj,
      uva: this.uva,
      uvb: this.uvb,
      uvc: this.uvc,
      image,
    });

    context.restore();

    return drawn;
  }

  // Whole-triangle rejection rather than a clip against the plane: one vertex
  // outside drops all three, so the artefact is a hole rather than a smear.
  // COS-418 (E2b) is what splits a straddling triangle instead, and it is a real
  // piece of work — the UVs have to be interpolated along the cut and this
  // method would have to emit geometry it does not own.
  private isClipped(): boolean {
    return this.a.isClipped || this.b.isClipped || this.c.isClipped;
  }

  private project(offsetX: number, offsetY: number) {
    const aproj = this.a.convert3D2D();
    const bproj = this.b.convert3D2D();
    const cproj = this.c.convert3D2D();

    this.aproj = new Point2D(aproj.x + offsetX, aproj.y + offsetY);
    this.bproj = new Point2D(bproj.x + offsetX, bproj.y + offsetY);
    this.cproj = new Point2D(cproj.x + offsetX, cproj.y + offsetY);
  }

  // 2D backface culling: the sign of the cross product of the two projected
  // edges, which is the winding the face ended up with on screen.
  private isBackfacing(): boolean {
    const v1x = this.bproj.x - this.aproj.x;
    const v1y = this.bproj.y - this.aproj.y;
    const v2x = this.cproj.x - this.aproj.x;
    const v2y = this.cproj.y - this.aproj.y;

    return v1x * v2y - v1y * v2x <= 0;
  }

  private strokeWireframe(context: CanvasRenderingContext2D) {
    context.strokeStyle = "rgba(10, 20, 60, 0.95)";
    context.lineWidth = 1;
    this.tracePath(context);
    context.stroke();
  }

  private fillFlat(context: CanvasRenderingContext2D) {
    context.fillStyle = this.material;
    this.tracePath(context);
    context.fill();
  }

  private tracePath(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.moveTo(this.aproj.x, this.aproj.y);
    context.lineTo(this.bproj.x, this.bproj.y);
    context.lineTo(this.cproj.x, this.cproj.y);
    context.closePath();
  }
}

export default Triangle;
