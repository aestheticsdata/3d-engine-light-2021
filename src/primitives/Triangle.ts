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
// - u and v are normalized in [0..1], except where UV SCALE tiles past 1.
// - (0,0) is the top-left of the texture, (1,1) is the bottom-right.
// - each triangle vertex (A,B,C) has its own UV (uva, uvb, uvc).
//
// Why UVs are optional:
// - only the cube's two subdivided faces are AUTHORED with any, and keeping the
//   slots optional is what avoids changing every triangle in the registry.
// - at runtime every triangle has them, since E4b: MeshFactory projects a set
//   for the faces the registry left bare, so a procedural mode has something to
//   sample on the other nineteen shapes.
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
//
// The key light (E3a/COS-241) enters at fill(), which is why the shading cost
// lands in E6's RASTER bracket rather than TRANSFORM: it is per-drawn-triangle
// work and the timer should say so. The face normal is computed by Lighting from
// this triangle's own three vertices — the draft put a normal pass on Mesh, which
// cannot reach them either — so a and b and c stay private and the only thing
// that had to open up was Point3D's x and y.

import { classifyMaterial, DEFAULT_MESH_MATERIAL, resolveMaterial } from "@rendering/material";

import type { UV } from "@data/types";
import type Point3D from "@primitives/Point3D";
import type AffineTextureMapper from "@rendering/AffineTextureMapper";
import type Fog from "@rendering/Fog";
import type Lighting from "@rendering/Lighting";
import type { AuthoredMaterial, MeshMaterial, ResolvedMaterial } from "@rendering/material";
import type TextureRegistry from "@textures/TextureRegistry";

export interface TriangleRenderOptions {
  // Required, not optional. An optional registry means a wiring mistake falls
  // through to filling with the raw material string — "dog" as a fillStyle,
  // which paints black and throws nothing. Required makes that a compile error.
  textures: TextureRegistry;
  // Required for the same reason (E3a/COS-241), and the failure it forecloses is
  // quieter still: an optional light would leave every face at its authored
  // colour, which is exactly what the console looked like before this ticket and
  // is not a frame anyone would look at twice.
  lighting: Lighting;
  // One for the whole surface (E4b/COS-245), where E6 gave each triangle its
  // own. It holds a pattern cache now, and a cache per triangle is not a cache.
  mapper: AffineTextureMapper;
  // Required rather than optional (E5b/COS-247), and the same instance the
  // ground layers hold: fog is a property of the air in the scene, so a mesh
  // that could be handed a different one — or none — is a mesh that can stand in
  // clear weather on a fogged floor.
  fog: Fog;
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

  // Optional in the signature, present in practice: MeshFactory fills these from
  // the registry tuple where it has them and from the spherical projection where
  // it does not, so every triangle in every mesh arrives with a set.
  private uva?: UV;
  private uvb?: UV;
  private uvc?: UV;

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
  //
  // It reports true on every path today, and that is a change rather than an
  // oversight (E4b/COS-245): the one branch that could fail was the textured
  // one, and a failed texture now falls back to the flat fill instead of
  // leaving the face unpainted. The boolean stays because it is what Mesh
  // counts drawn triangles and fill rate off, and E3b's second backend has a
  // real not-drawn state to report through it.
  public fill(context: CanvasRenderingContext2D, options: TriangleRenderOptions): boolean {
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, options.opacity ?? 1));

    // Unfogged, deliberately. A wireframe is the diagnostic view, and dissolving
    // the far edges is exactly what someone who switched to it is trying to see.
    if (options.wireframe) {
      this.strokeWireframe(context);
      context.restore();

      return true;
    }

    if (this.drawTexture(context, options)) {
      this.shadeTexture(context, options.lighting);
    } else {
      this.fillFlat(context, options.lighting);
    }

    this.veilWithFog(context, options.fog);

    context.restore();

    return true;
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

  // False whenever the texture path cannot run, and every one of the four ways
  // it can fail falls back to the flat fill rather than to nothing: no key, no
  // decoded bitmap, no UVs, or a UV triangle the affine solve cannot invert.
  //
  // That last one is why this is a fallback rather than an early return. The
  // spherical projection reads a direction and discards the distance, so two
  // vertices on one ray get identical coordinates — reachable on the cross and
  // the Menger sponge — and before E4b a face like that was silently not
  // painted at all. A hole in a solid is worse than a face in its base colour.
  //
  // The key is resolved, but the bitmap behind it is still looked up per frame
  // and never snapshotted at mesh-build time: a texture that finishes decoding
  // after the mesh was built still appears.
  private drawTexture(context: CanvasRenderingContext2D, options: TriangleRenderOptions): boolean {
    const key = this.resolved.textureKey;

    if (key === null || !this.uva || !this.uvb || !this.uvc) {
      return false;
    }

    const image = options.textures.get(key);

    if (!image) {
      return false;
    }

    return options.mapper.draw({
      context,
      ax: this.aprojX,
      ay: this.aprojY,
      bx: this.bprojX,
      by: this.bprojY,
      cx: this.cprojX,
      cy: this.cprojY,
      uva: this.uva,
      uvb: this.uvb,
      uvc: this.uvc,
      key,
      image,
      uvScale: this.resolved.uvScale,
    });
  }

  private strokeWireframe(context: CanvasRenderingContext2D) {
    context.strokeStyle = "rgba(10, 20, 60, 0.95)";
    context.lineWidth = 1;
    this.tracePath(context);
    context.stroke();
  }

  // The light reads this triangle's own three vertices rather than a normal it
  // was handed (E3a/COS-241). Everything it needs is already a field here, so
  // nothing had to be widened but Point3D's two new getters — and because this
  // runs from fill(), a triangle the clip or the cull rejected never pays for a
  // normal it would not have drawn.
  private fillFlat(context: CanvasRenderingContext2D, lighting: Lighting) {
    context.fillStyle = lighting.fillFor(this.resolved, this.a, this.b, this.c);
    this.tracePath(context);
    context.fill();
  }

  // A textured face cannot be modulated by context.fill(), so it is darkened by
  // a second pass over the same path. Inside the caller's save/restore, which is
  // what makes it inherit globalAlpha — a half-transparent face gets a
  // half-transparent wash, which is the answer that composites correctly.
  //
  // The pattern fill carries the texture-space basis on the pattern rather than
  // on the context, so the canvas is still in screen coordinates here and this
  // traces the same three projected points the texture was just filled through.
  private shadeTexture(context: CanvasRenderingContext2D, lighting: Lighting) {
    const wash = lighting.overlayFor(this.a, this.b, this.c);

    if (wash === null) {
      return;
    }

    context.fillStyle = wash;
    this.tracePath(context);
    context.fill();
  }

  // Last of the passes over this path, over the flat fill and the textured one
  // alike (E5b/COS-247). It is the same shape as the shade wash above and rides
  // the same save/restore, so a half-transparent face gets a half-transparent
  // veil — which is the answer that composites correctly against what is behind
  // it.
  //
  // Null is the commonest answer and the reason this is cheap: FOG ships at 0,
  // and even at full strength a face nearer than the threshold skips the fill
  // rather than submitting a transparent path 8008 times a frame.
  private veilWithFog(context: CanvasRenderingContext2D, fog: Fog) {
    const veil = fog.meshOverlay(this.depth);

    if (veil === null) {
      return;
    }

    context.fillStyle = veil;
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
