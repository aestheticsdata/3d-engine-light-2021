// -----------------------------------------------------------------------------
// UV / TEXTURE MAPPING SUPPORT
// -----------------------------------------------------------------------------
// This Triangle can be rendered in two different modes:
//
// 1) Flat color:
//    - the resolved fill is a CSS color string (e.g. "rgba(...)").
//    - the triangle is filled with ctx.fill().
//
// 2) Textured:
//    - the resolved material carries a texture key (e.g. "dog", "galaxy") used
//      to fetch an image from the textures registry carried in the render
//      options.
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
//
// Which of the two a triangle is is no longer read off the raw string per frame
// (E4a/COS-240). The authored slot is classified once, when the mesh is built,
// and resolved against the mesh's runtime material into the fill and the texture
// key this class actually draws with — so the BASE swatch can tint a shape and
// SOLID can suppress its textures without any of that reaching the render path.
// setMaterial is what re-resolves; nothing here resolves per frame.
//
// project() / isFrontFacing() / fill() are Mesh.renderMesh's three passes
// (E6/COS-239), pulled apart from what used to be one fused per-triangle call
// so each can be timed on its own: a transform pass that projects every
// triangle, a clip-cull pass that sorts and tests every triangle, and a raster
// pass that fills only the survivors. render() still exists and still
// composes the three in the same order, so anything outside Mesh that called
// it — there is nothing today, but the method is public API — sees unchanged
// behaviour.

import Point2D from "@primitives/Point2D";
import AffineTextureMapper from "@rendering/AffineTextureMapper";
import { classifyMaterial, DEFAULT_MESH_MATERIAL, resolveMaterial } from "@rendering/material";

import type { UV } from "@data/types";
import type Point3D from "@primitives/Point3D";
import type { AuthoredMaterial, MeshMaterial, ResolvedMaterial } from "@rendering/material";
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

  // Scratch, rewritten by every project() and read by isFrontFacing()/fill()/
  // screenArea(). Six scalars rather than three Point2D instances (E6/COS-239):
  // with the transform pass now a real loop of its own, two heap objects per
  // triangle per frame — 15,840 of them a second on the torus knot at 60fps —
  // is exactly the allocation churn T28/T29 spent this codebase's early
  // tickets removing, for values nothing outside this class ever read as a
  // Point2D in the first place.
  private aprojX: number;
  private aprojY: number;
  private bprojX: number;
  private bprojY: number;
  private cprojX: number;
  private cprojY: number;

  // The registry's fourth slot, classified once. Readonly because the authored
  // surface is geometry — it changes when the shape changes, which builds a new
  // mesh — while the material above it is scene state that moves on its own.
  private readonly authored: AuthoredMaterial;
  // What the two of them come to, cached. Rewritten by setMaterial and read by
  // fill(), so a swatch costs one resolution per triangle per click rather than
  // one per triangle per frame.
  private resolved: ResolvedMaterial;

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
    this.authored = classifyMaterial(material);
    // Seeded with the default rather than left undefined until someone pushes a
    // material: the default is the identity of the blend, so a mesh that is
    // built and drawn before Main gets to it draws exactly what the registry
    // authored.
    this.resolved = resolveMaterial(this.authored, DEFAULT_MESH_MATERIAL);
    this.uva = uva;
    this.uvb = uvb;
    this.uvc = uvc;
    this.textureMapper = new AffineTextureMapper();
    this.aprojX = 0;
    this.aprojY = 0;
    this.bprojX = 0;
    this.bprojY = 0;
    this.cprojX = 0;
    this.cprojY = 0;
  }

  public get depth(): number {
    return (this.a.zValue + this.b.zValue + this.c.zValue) / 3;
  }

  // Outside the view volume, which is the camera's question rather than this
  // triangle's: whole-vertex rejection, so one vertex outside drops all
  // three and the artefact is a hole rather than the smear a mirrored vertex
  // used to paint. COS-418 (E2b) is what splits a straddling triangle
  // instead.
  public get isClipped(): boolean {
    return this.a.isClipped || this.b.isClipped || this.c.isClipped;
  }

  // Re-resolves and re-caches, which is the whole cost of a material change on
  // this side. Called through Mesh.setMaterial, never per frame, and idempotent
  // for the same reason setTransform is: it derives from the authored slot
  // rather than from whatever the last resolution left behind.
  public setMaterial(material: MeshMaterial) {
    this.resolved = resolveMaterial(this.authored, material);
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
    if (this.isClipped) {
      return false;
    }

    this.project(offsetX, offsetY);

    if ((options.cullBackfaces ?? true) && !this.isFrontFacing()) {
      return false;
    }

    return this.fill(context, options);
  }

  // The transform pass, over one triangle: both vertices' own convert3D2D,
  // exactly as before, just no longer paired with the clip test or the facing
  // test in the same call — Mesh.renderMesh's transform pass calls this alone,
  // over every triangle, before clip-cull runs.
  public project(offsetX: number, offsetY: number) {
    const aproj = this.a.convert3D2D();
    const bproj = this.b.convert3D2D();
    const cproj = this.c.convert3D2D();

    this.aprojX = aproj.x + offsetX;
    this.aprojY = aproj.y + offsetY;
    this.bprojX = bproj.x + offsetX;
    this.bprojY = bproj.y + offsetY;
    this.cprojX = cproj.x + offsetX;
    this.cprojY = cproj.y + offsetY;
  }

  // 2D backface culling: the sign of the cross product of the two projected
  // edges, which is the winding the face ended up with on screen. Positive
  // rather than negative-or-zero (isBackfacing's old sign) so a degenerate,
  // zero-area triangle — every projected point coincident — reads as facing
  // away rather than toward, which is what dropping it silently requires.
  public isFrontFacing(): boolean {
    const v1x = this.bprojX - this.aprojX;
    const v1y = this.bprojY - this.aprojY;
    const v2x = this.cprojX - this.aprojX;
    const v2y = this.cprojY - this.aprojY;

    return v1x * v2y - v1y * v2x > 0;
  }

  // The raster pass, over one triangle already known to have survived
  // clip-cull: paints it and reports whether anything actually reached the
  // canvas, the same three-way branch render() always had.
  public fill(context: CanvasRenderingContext2D, options: TriangleRenderOptions): boolean {
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, options.opacity ?? 1));

    if (options.wireframe) {
      this.strokeWireframe(context);
      context.restore();

      return true;
    }

    // The key is resolved, but the bitmap behind it is still looked up at render
    // time and never snapshotted at mesh-build time: a texture that finishes
    // decoding after the mesh was built still appears.
    const key = this.resolved.textureKey;
    const image = key === null ? undefined : options.textures.get(key);

    if (!image || !this.uva || !this.uvb || !this.uvc) {
      this.fillFlat(context);
      context.restore();

      return true;
    }

    // The one place a Point2D still gets built: AffineTextureMapper's contract
    // (D8) is a Point2D, not a pair of scalars, and only the textured branch —
    // a handful of faces in the whole registry, not every triangle every
    // frame — pays for it.
    const drawn = this.textureMapper.draw({
      context,
      a: new Point2D(this.aprojX, this.aprojY),
      b: new Point2D(this.bprojX, this.bprojY),
      c: new Point2D(this.cprojX, this.cprojY),
      uva: this.uva,
      uvb: this.uvb,
      uvc: this.uvc,
      image,
    });

    context.restore();

    return drawn;
  }

  // The fill-rate accounting's own unit of work (E6/COS-239): the projected
  // triangle's screen-space area, the same cross product isFrontFacing already
  // takes the sign of. Called only on triangles fill() actually painted, so a
  // culled or clipped triangle costs nothing here.
  public screenArea(): number {
    const v1x = this.bprojX - this.aprojX;
    const v1y = this.bprojY - this.aprojY;
    const v2x = this.cprojX - this.aprojX;
    const v2y = this.cprojY - this.aprojY;

    return Math.abs(v1x * v2y - v1y * v2x) / 2;
  }

  private strokeWireframe(context: CanvasRenderingContext2D) {
    context.strokeStyle = "rgba(10, 20, 60, 0.95)";
    context.lineWidth = 1;
    this.tracePath(context);
    context.stroke();
  }

  private fillFlat(context: CanvasRenderingContext2D) {
    context.fillStyle = this.resolved.fill;
    this.tracePath(context);
    context.fill();
  }

  private tracePath(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.moveTo(this.aprojX, this.aprojY);
    context.lineTo(this.bprojX, this.bprojY);
    context.lineTo(this.cprojX, this.cprojY);
    context.closePath();
  }
}

export default Triangle;
