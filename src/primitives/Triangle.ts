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
// pass that fills only the survivors. A render() that composed the three in
// order outlived the split as documented public API with no caller; E3c
// removed it rather than grow it a fifth positional argument for a depth
// context it had no way to build.
//
// The key light (E3a/COS-241) enters at fill(), which is why the shading cost
// lands in E6's RASTER bracket rather than TRANSFORM: it is per-drawn-triangle
// work and the timer should say so. The face normal is computed by Lighting from
// this triangle's own three vertices — the draft put a normal pass on Mesh, which
// cannot reach them either — so a and b and c stay private and the only thing
// that had to open up was Point3D's x and y.
//
// -----------------------------------------------------------------------------
// SHADING MODES (E3c/COS-243)
// -----------------------------------------------------------------------------
// Six chips, and this class is where four of them are decided — POINTS is a
// vertex pass on Mesh and never reaches a triangle at all.
//
//   WIRE      the stroke below, unfogged and unlit, unchanged since E5b.
//   FLAT      one lit colour per face, fog blended into it here.
//   GOURAUD   the UNLIT colour, plus a diffuse term per vertex for the
//             rasteriser to interpolate. Unlit is the whole point: fillRgba's
//             per-face shade would multiply the vertex term a second time and
//             the mesh would ship at shade squared.
//   DEPTH     one grey per face on the painter path, a per-pixel ramp on the
//             buffered one.
//   NORMALS   one colour per face on both, since a face normal is constant
//             across it.
//
// DEPTH and NORMALS are unfogged and untextured, for the reason the wireframe
// branch has always been: a grey that has to decode back to a depth and an RGB
// that has to decode back to a normal are not pictures of the scene, and haze
// over either destroys the thing being read.
//
// GOURAUD renders as FLAT on the painter path. It is the one mode that needs a
// per-pixel stage — its own ticket lists E3b as the prerequisite — and the
// alternative, one averaged shade per face, is indistinguishable from FLAT on
// every finely tessellated shape in the registry while costing a vertex-normal
// rebuild per frame to produce.

import { blendRgba, formatRgba, parseCssColor } from "@rendering/cssColor";
import { depthGrey } from "@rendering/depthGrey";
import { classifyMaterial, DEFAULT_MESH_MATERIAL, resolveMaterial } from "@rendering/material";
import { clipTriangleToNear } from "@rendering/nearPlaneClip";
import { normalRgba } from "@rendering/normalRgba";
import { isDiagnostic } from "@rendering/shadingMode";

import type { UV } from "@data/types";
import type Point3D from "@primitives/Point3D";
import type VertexNormals from "@primitives/VertexNormals";
import type AffineTextureMapper from "@rendering/AffineTextureMapper";
import type { RGBA } from "@rendering/cssColor";
import type Fog from "@rendering/Fog";
import type Lighting from "@rendering/Lighting";
import type { AuthoredMaterial, MeshMaterial, ResolvedMaterial } from "@rendering/material";
import type { ClipVertex } from "@rendering/nearPlaneClip";
import type Rasterizer from "@rendering/Rasterizer";
import type { RasterFillRequest, RasterShading } from "@rendering/Rasterizer";
import type { ShadingMode } from "@rendering/shadingMode";
import type TextureRegistry from "@textures/TextureRegistry";
import type { TextureSource } from "@textures/TextureRegistry";

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
  // Required for the same reason the four above are (E3c/COS-243): an optional
  // mode falls back to FLAT, which is exactly what five of the six chips used to
  // do, and a wiring mistake that reproduces the bug this ticket removed should
  // not compile.
  shadingMode: ShadingMode;
  wireframe?: boolean;
  cullBackfaces?: boolean;
  opacity?: number;
  // Device pixels, not CSS pixels — the caller passes renderTarget.scale
  // (E9b/COS-250), the same number every vertex is already projected through.
  // A hardcoded 1 is a half-thickness hairline the moment the backing store
  // renders above the reference height, DPR included.
  lineWidth?: number;
}

// The four numbers and one flag clipToNear needs, built once per
// Mesh.renderMesh call rather than once per triangle (R4) — near, far,
// eyeDistance, the offset and the cull flag are the same for every triangle
// in the pass, and building this literal on every one of the torus knot's
// 7920 would be exactly the allocation the fast path below exists to avoid.
export interface NearClipContext {
  near: number;
  far: number;
  eyeDistance: number;
  offsetX: number;
  offsetY: number;
  cullBackfaces: boolean;
}

// One projected vertex, in the shape the rasteriser's edge-function math
// consumes (E3b/COS-242) — screen-space x/y (the same aprojX/aprojY project()
// already writes), 1/d (E2's eye-space depth, reciprocated once here rather
// than per pixel), and the UV this vertex carries, or {0,0} when the
// triangle has none — mirrored from nearClipVertices' own fallback, since a
// textured request is never built for a triangle without UVs (see
// rasterize() below).
export interface RasterVertex {
  x: number;
  y: number;
  invD: number;
  u: number;
  v: number;
  // GOURAUD's diffuse term at this vertex (E3c/COS-243), and 1 in every other
  // mode — nothing reads it there, and a slot that is sometimes absent would
  // make the three literals rasterVertices builds two different shapes.
  shade: number;
}

// This triangle's three vertices as positions in the mesh's own points array.
// Optional because a near-plane clip fragment has none: it is built from
// interpolated positions that exist for one frame and have no entry in that
// array to accumulate a normal into.
export type VertexIndices = readonly [number, number, number];

// The frame's depth facts, built once per Mesh.renderMesh call rather than once
// per triangle, for the reason NearClipContext above already is. eyeDistance is
// Camera.distance; near and far are RenderStats' own histogram edges rather than
// Camera's view volume — see depthGrey for why the volume is the wrong window.
export interface DepthContext {
  eyeDistance: number;
  near: number;
  far: number;
}

// A colour cssColor could not read, which for a texture-keyed material means its
// fill is the raw key ("dog"). White because it is the identity of the multiply
// that follows, the same choice and the same reason as Lighting's own fallback.
const UNREADABLE_FILL: RGBA = [255, 255, 255, 1];

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

  // Where this face's three corners live in the mesh's shared points array, so
  // GOURAUD can add its normal to each of them (E3c/COS-243). Null on a clip
  // fragment, which has no entry in that array — the fragment inherits its
  // parent's shades instead, see emitFragment.
  private readonly indices: VertexIndices | null;

  // The three vertices' own diffuse terms, refilled in place by
  // cacheVertexShades once per frame in GOURAUD mode. Held here rather than
  // looked up through indices at read time because Mesh sorts this array by
  // depth every frame, so a triangle's position in it says nothing about which
  // face it is — and because a fragment can then be handed a value at all.
  private readonly vertexShades: [number, number, number];

  // Positional, and one of the constructors R4 exempts by name: MeshFactory
  // spreads a registry tuple straight into it, and the order of a, b, c is the
  // winding. indices rides last, after the three optional UV slots, because it
  // is the one argument the other construction site — emitFragment — has
  // nothing to pass.
  constructor(
    a: Point3D,
    b: Point3D,
    c: Point3D,
    material: string,
    uva?: UV,
    uvb?: UV,
    uvc?: UV,
    indices?: VertexIndices,
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.indices = indices ?? null;
    this.vertexShades = [1, 1, 1];
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

  public get resolvedMaterial(): ResolvedMaterial {
    return this.resolved;
  }

  // Re-resolves and re-caches, which is the whole cost of a material change on
  // this side. Called through Mesh.setMaterial, never per frame, and idempotent
  // for the same reason setTransform is: it derives from the authored slot
  // rather than from whatever the last resolution left behind.
  public setMaterial(material: MeshMaterial) {
    this.resolved = resolveMaterial(this.authored, material);
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
  public fill(context: CanvasRenderingContext2D, options: TriangleRenderOptions, depth: DepthContext): boolean {
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, options.opacity ?? 1));

    // Unfogged, deliberately. A wireframe is the diagnostic view, and dissolving
    // the far edges is exactly what someone who switched to it is trying to see.
    if (options.wireframe) {
      this.strokeWireframe(context, options.lineWidth ?? 1);
      context.restore();

      return true;
    }

    // The same exemption, extended to the two modes that encode a quantity
    // rather than paint a surface (E3c/COS-243): no texture, no light, no fog.
    if (isDiagnostic(options.shadingMode)) {
      context.fillStyle = formatRgba(this.diagnosticRgba(options.shadingMode, depth));
      this.tracePath(context);
      context.fill();
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

  // The rasteriser's own per-vertex data (E3b/COS-242) — project() must
  // already have run this frame, the same precondition fill() carries.
  // eyeDistance is E2's Camera.distance, threaded the same way
  // NearClipContext already threads it rather than giving this class a
  // Camera reference of its own.
  public rasterVertices(eyeDistance: number): [RasterVertex, RasterVertex, RasterVertex] {
    return [
      {
        x: this.aprojX,
        y: this.aprojY,
        invD: 1 / (this.a.zValue + eyeDistance),
        u: this.uva?.[0] ?? 0,
        v: this.uva?.[1] ?? 0,
        shade: this.vertexShades[0],
      },
      {
        x: this.bprojX,
        y: this.bprojY,
        invD: 1 / (this.b.zValue + eyeDistance),
        u: this.uvb?.[0] ?? 0,
        v: this.uvb?.[1] ?? 0,
        shade: this.vertexShades[1],
      },
      {
        x: this.cprojX,
        y: this.cprojY,
        invD: 1 / (this.c.zValue + eyeDistance),
        u: this.uvc?.[0] ?? 0,
        v: this.uvc?.[1] ?? 0,
        shade: this.vertexShades[2],
      },
    ];
  }

  // GOURAUD's accumulation half (E3c/COS-243): this face's raw cross product,
  // added into each of its three corners' slots in the shared sink. Raw and not
  // normalised on purpose — the magnitude is twice the face's area, so summing
  // raw products area-weights the average for free, and the sign is dealt with
  // once per vertex where VertexNormals normalises rather than once per face
  // here.
  //
  // Reads a, b and c, which is why this lives on Triangle rather than on the
  // class that owns the sink: the header above records that the three vertices
  // stay private and that Lighting reaches them the same way, by being called
  // with them rather than by holding them.
  public accumulateFaceNormal(sink: Float32Array) {
    if (!this.indices) {
      return;
    }

    const ax = this.a.xValue;
    const ay = this.a.yValue;
    const az = this.a.zValue;
    const nx = (this.b.yValue - ay) * (this.c.zValue - az) - (this.b.zValue - az) * (this.c.yValue - ay);
    const ny = (this.b.zValue - az) * (this.c.xValue - ax) - (this.b.xValue - ax) * (this.c.zValue - az);
    const nz = (this.b.xValue - ax) * (this.c.yValue - ay) - (this.b.yValue - ay) * (this.c.xValue - ax);

    for (const index of this.indices) {
      const slot = index * 3;

      sink[slot] += nx;
      sink[slot + 1] += ny;
      sink[slot + 2] += nz;
    }
  }

  // The read half, called by Mesh once per frame in GOURAUD mode after the sink
  // above has been folded into shades. Written into the tuple in place rather
  // than replacing it: 7920 three-element arrays a frame on the torus knot is
  // the allocation churn the projected-scalar fields above record removing.
  public cacheVertexShades(normals: VertexNormals) {
    if (!this.indices) {
      return;
    }

    this.vertexShades[0] = normals.shadeAt(this.indices[0]);
    this.vertexShades[1] = normals.shadeAt(this.indices[1]);
    this.vertexShades[2] = normals.shadeAt(this.indices[2]);
  }

  // The depth-buffered backend's own entry point, alongside fill() above —
  // called only when options.wireframe is falsy (Mesh.renderMesh keeps
  // wireframe on fill() for both backends; see this file's header note).
  // Builds exactly the colour data fill()'s own two branches
  // (fillFlat+veilWithFog, or drawTexture+shadeTexture+veilWithFog) already
  // compute, pre-blended per triangle rather than left for Rasterizer to
  // call Lighting or Fog itself — the same separation fill() already keeps
  // by resolving a CSS string before handing it to context.fillStyle.
  public rasterize(rasterizer: Rasterizer, options: TriangleRenderOptions, depth: DepthContext): boolean {
    const mode = options.shadingMode;
    const vertices = this.rasterVertices(depth.eyeDistance);
    const opacity = options.opacity ?? 1;

    // Unfogged and untextured, the same exemption fill() makes above. DEPTH
    // carries no colour at all — the rasteriser reads the pixel's own depth —
    // which is the one request that leaves flatColor null.
    if (isDiagnostic(mode)) {
      return rasterizer.fillTriangle({
        shading: mode === "DEPTH" ? "DEPTH" : "FLAT",
        vertices,
        texture: null,
        flatColor: mode === "DEPTH" ? null : this.faceNormalRgba(),
        textureWash: null,
        fogVeil: null,
        opacity,
      });
    }

    const gouraud = mode === "GOURAUD";
    const veilCss = options.fog.meshOverlay(this.depth);
    const fogVeil = veilCss ? parseCssColor(veilCss) : null;
    const hasUVs = this.uva !== undefined && this.uvb !== undefined && this.uvc !== undefined;
    const textureImage =
      this.resolved.textureKey !== null && hasUVs ? options.textures.get(this.resolved.textureKey) : undefined;

    if (textureImage) {
      // No wash under GOURAUD: the wash IS the flat path's shade, painted as a
      // black overlay because a canvas fill cannot modulate a texel, and the
      // per-pixel multiply the vertex shades drive is the same darkening done
      // properly. Sending both would shade the face twice.
      const washCss = gouraud ? null : options.lighting.overlayFor(this.a, this.b, this.c);

      return rasterizer.fillTriangle(
        this.textureFillRequest(vertices, textureImage, washCss, fogVeil, opacity, gouraud),
      );
    }

    if (gouraud) {
      return rasterizer.fillTriangle({
        shading: "GOURAUD",
        vertices,
        texture: null,
        // Unlit. The three vertex shades are the entire lighting term on this
        // path, and fillRgba's own per-face shade would be a second one.
        flatColor: this.baseRgba(),
        textureWash: null,
        // Unblended, unlike FLAT below: the veil has to land after the shade
        // multiply, or the haze in front of a face gets darkened by the face.
        fogVeil,
        opacity,
      });
    }

    const lit = options.lighting.fillRgba(this.resolved, this.a, this.b, this.c);
    const flatColor = fogVeil ? blendRgba(lit, fogVeil) : lit;

    return rasterizer.fillTriangle({
      shading: "FLAT",
      vertices,
      texture: null,
      flatColor,
      textureWash: null,
      // Already in flatColor: one blend per triangle rather than one per pixel,
      // which is what lets Rasterizer hand this colour back by reference.
      fogVeil: null,
      opacity,
    });
  }

  private textureFillRequest(
    vertices: [RasterVertex, RasterVertex, RasterVertex],
    image: TextureSource,
    washCss: string | null,
    fogVeil: RGBA | null,
    opacity: number,
    gouraud: boolean,
  ): RasterFillRequest {
    const shading: RasterShading = gouraud ? "GOURAUD" : "FLAT";

    return {
      shading,
      vertices,
      texture: { key: this.resolved.textureKey as string, image, uvScale: this.resolved.uvScale },
      flatColor: null,
      textureWash: washCss ? parseCssColor(washCss) : null,
      fogVeil,
      opacity,
    };
  }

  // What the two diagnostic modes paint a whole face with. Both are constant
  // across it — a face has one normal, and the painter path has one depth per
  // face because it has no per-pixel stage to ramp across.
  private diagnosticRgba(mode: ShadingMode, depth: DepthContext): RGBA {
    if (mode === "NORMALS") {
      return this.faceNormalRgba();
    }

    return depthGrey(this.depth + depth.eyeDistance, depth.near, depth.far);
  }

  private faceNormalRgba(): RGBA {
    return normalRgba(
      this.a.xValue,
      this.a.yValue,
      this.a.zValue,
      this.b.xValue,
      this.b.yValue,
      this.b.zValue,
      this.c.xValue,
      this.c.yValue,
      this.c.zValue,
    );
  }

  // The authored colour with no light on it, which is what GOURAUD multiplies
  // its interpolated shade into. resolved.rgba is null for a texture-keyed
  // material, whose fill is the raw key — reachable here when the key resolves
  // but the bitmap has not decoded yet, or when the face has no UVs.
  private baseRgba(): RGBA {
    return this.resolved.rgba ?? parseCssColor(this.resolved.fill) ?? UNREADABLE_FILL;
  }

  // The near-plane half of the view-volume test (COS-418/E2b), replacing the
  // whole-triangle reject Mesh.renderMesh used to make. Pushes 0, 1 or 2
  // triangles into `out`: itself, unchanged, when every vertex is in front —
  // the out.push(this) path allocates nothing, which is what lets the
  // overwhelming majority of triangles in any frame take exactly the path
  // they took before this ticket — nothing when every vertex is behind, and
  // one or two new fragment triangles, split at the plane by
  // nearPlaneClip's Sutherland-Hodgman walk, when the triangle straddles it.
  // The far plane keeps the old whole-triangle reject: this ticket only
  // splits near, per its own scoping, since nothing in the registry reaches
  // d = 5000 (see Camera.ts).
  public clipToNear(context: NearClipContext, out: Triangle[]): void {
    const da = this.a.zValue + context.eyeDistance;
    const db = this.b.zValue + context.eyeDistance;
    const dc = this.c.zValue + context.eyeDistance;

    if (da > context.far || db > context.far || dc > context.far) {
      return;
    }

    const aIn = da >= context.near;
    const bIn = db >= context.near;
    const cIn = dc >= context.near;

    if (aIn && bIn && cIn) {
      if (!context.cullBackfaces || this.isFrontFacing()) {
        out.push(this);
      }

      return;
    }

    if (!aIn && !bIn && !cIn) {
      return;
    }

    const polygon = clipTriangleToNear(this.nearClipVertices(), context.near, context.eyeDistance);

    this.emitFragment(polygon[0], polygon[1], polygon[2], context, out);

    if (polygon.length === 4) {
      this.emitFragment(polygon[0], polygon[2], polygon[3], context, out);
    }
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

  private strokeWireframe(context: CanvasRenderingContext2D, lineWidth: number) {
    context.strokeStyle = "rgba(10, 20, 60, 0.95)";
    context.lineWidth = lineWidth;
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

  // The three vertices in the plain shape nearPlaneClip works in — camera
  // space, pre-projection, with the UV each already carries, or {0,0} for an
  // authored face with none. E4b guarantees every runtime triangle has a
  // set, but the slots stay optional on the type the registry authors
  // against, so the fallback lives here rather than being asserted away.
  private nearClipVertices(): [ClipVertex, ClipVertex, ClipVertex] {
    const [ua, va] = this.uva ?? [0, 0];
    const [ub, vb] = this.uvb ?? [0, 0];
    const [uc, vc] = this.uvc ?? [0, 0];

    return [
      { x: this.a.xValue, y: this.a.yValue, z: this.a.zValue, u: ua, v: va },
      { x: this.b.xValue, y: this.b.yValue, z: this.b.zValue, u: ub, v: vb },
      { x: this.c.xValue, y: this.c.yValue, z: this.c.zValue, u: uc, v: vc },
    ];
  }

  // One fragment triangle from three polygon vertices nearPlaneClip
  // returned. Reads this.a for the projection basis only — a, b and c share
  // one camera and one render target, so it does not matter which of the
  // three withPosition is called on. The resolved material is copied in
  // directly rather than re-derived: resolveMaterial needs the scene's
  // current MeshMaterial, which nothing at this call site holds, and
  // resolved is not readonly, unlike authored — which is why rawMaterial()
  // exists instead, to reproduce authored exactly through the constructor's
  // own classifyMaterial rather than skip it.
  private emitFragment(p0: ClipVertex, p1: ClipVertex, p2: ClipVertex, context: NearClipContext, out: Triangle[]) {
    const fragment = new Triangle(
      this.a.withPosition(p0.x, p0.y, p0.z),
      this.a.withPosition(p1.x, p1.y, p1.z),
      this.a.withPosition(p2.x, p2.y, p2.z),
      this.rawMaterial(),
      [p0.u, p0.v],
      [p1.u, p1.v],
      [p2.u, p2.v],
    );

    fragment.resolved = this.resolved;
    // A fragment has no entry in the points array, so no vertex normal was
    // accumulated for it and cacheVertexShades would skip it. It inherits the
    // parent's mean instead of the parent's three: its corners are convex
    // combinations of them in an order this call site does not track, and one
    // smooth value is a better wrong answer than three assigned by position.
    // It costs the smoothing on whichever one or two triangles are straddling
    // the near plane in a given frame.
    fragment.vertexShades.fill((this.vertexShades[0] + this.vertexShades[1] + this.vertexShades[2]) / 3);
    fragment.project(context.offsetX, context.offsetY);

    if (!context.cullBackfaces || fragment.isFrontFacing()) {
      out.push(fragment);
    }
  }

  // authored.css / authored.key is the exact string classifyMaterial was
  // given in the first place, so handing it back to the constructor
  // reproduces authored exactly rather than approximating it — cheap, and
  // only ever paid on the rare straddling triangle.
  private rawMaterial(): string {
    return this.authored.kind === "texture" ? this.authored.key : this.authored.css;
  }
}

export default Triangle;
