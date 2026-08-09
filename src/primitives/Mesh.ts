import VertexNormals from "@primitives/VertexNormals";
import { formatRgba } from "@rendering/cssColor";

import type Point3D from "@primitives/Point3D";
import type Triangle from "@primitives/Triangle";
import type { DepthContext, NearClipContext, TriangleRenderOptions } from "@primitives/Triangle";
import type { RGBA } from "@rendering/cssColor";
import type Lighting from "@rendering/Lighting";
import type { MeshMaterial } from "@rendering/material";
import type Rasterizer from "@rendering/Rasterizer";
import type RenderStats from "@rendering/RenderStats";

// Three required fields — past R4's two-collaborator exemption — and
// boundingRadius is a plain number rather than a third collaborator, so this
// is the options object rather than a third positional argument.
export interface MeshOptions {
  points: Point3D[];
  triangles: Triangle[];
  // Orientation-invariant (E6/COS-239): MeshFactory folds it once, over the
  // registry's raw coordinates, before rotation exists to disturb it. See
  // MeshFactory.build for why that is also where it has to be computed.
  boundingRadius: number;
}

// Everything one renderMesh call needs, bundled rather than positional
// (E6/COS-239 pushed this past R4's three-argument line the day it needed
// both the shared stats accumulator and the eye distance the depth bins bin
// on). stats.setDepthRange must already have been called by Surface3D before
// this runs — the bin edges are fixed once per Surface3D.render call, across
// every renderable, not recomputed per mesh.
export interface MeshRenderPass {
  context: CanvasRenderingContext2D;
  offsetX: number;
  offsetY: number;
  options: TriangleRenderOptions;
  stats: RenderStats;
  // The projection denominator's constant term (Camera.distance), added to a
  // triangle's own mean z to bin it in the same eye-space depth its near/far
  // clip already reasons in. Passed rather than recomputed from Camera: Mesh
  // has never held a camera reference, and threading the one number this
  // needs is simpler than giving it one.
  eyeDistance: number;
  // The view volume's own two planes (Camera.near/Camera.far), threaded the
  // same way eyeDistance already is — Mesh has never held a Camera reference,
  // and two more numbers is simpler than giving it one (COS-418/E2b).
  near: number;
  far: number;
  // Whether this frame is one of the one-in-six RenderStats.beginFrame()
  // marked sampled. False means every pass below still runs — the mesh must
  // still be drawn — it just makes zero performance.now() calls doing it.
  timed: boolean;
  // The depth-buffered backend, or null/undefined for the painter path
  // (E3b/COS-242). Resolved once per frame by Surface3D — wireframe forces
  // this to null even when Z-BUFFER is on, since a wireframe triangle never
  // fills a pixel or tests a depth on either backend (Triangle.fill()'s own
  // wireframe branch returns before anything the depth buffer could test).
  rasterizer?: Rasterizer | null;
}

// The posed mesh's axis-aligned box in world coordinates (E5b/COS-247). Not the
// same quantity as boundingRadius above and not derivable from it: the radius is
// deliberately orientation-invariant so the depth histogram's axis holds still,
// while a shadow has to follow the silhouette the current pose actually casts.
// E7's projectedBounds will be a third — screen space, after the divide.
export interface MeshBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

// The uniform factor a transform carries, read as the length of its first
// column. Exact only for a linear part that is scale x rotation, which is the
// only kind of matrix a mesh is ever handed: the rig composes a uniform scale
// with three rotations and the camera contributes a rotation and a translation.
const uniformScaleOf = (transform: number[][]): number =>
  Math.sqrt(transform[0][0] ** 2 + transform[1][0] ** 2 + transform[2][0] ** 2);

// POINTS mode's ink (E3c/COS-243), and the same near-black the wireframe strokes
// with: the two are the diagnostic pair, one drawing the edges of the mesh and
// one drawing its corners, and they read as one view of the geometry rather than
// two unrelated overlays. Held as a tuple because that is what the rasteriser
// takes; the painter path needs the string, folded once at import rather than
// per point per frame.
const POINT_INK: RGBA = [10, 20, 60, 0.95];
const POINT_INK_CSS = formatRgba(POINT_INK);

// Device pixels per side of a point's block, before the render target's own
// scale. A fixed 2 is a half-visible dot the moment the backing store renders
// above the reference height, which is the same reason lineWidth is threaded
// rather than hardcoded (E9b/COS-250).
const POINT_SIZE = 2;

class Mesh {
  private readonly points: Point3D[];
  private readonly triangles: Triangle[];
  private readonly radius: number;
  private scaledRadius: number;
  // Allocated with the mesh even though only GOURAUD refills it: it is two
  // Float32Arrays sized to the points array — 68KB on the largest shape in the
  // registry — and allocating them on the first frame the chip is picked would
  // put a 4224-element allocation inside a frame instead of inside a shape
  // change.
  private readonly vertexNormals: VertexNormals;

  // Copied rather than aliased: the factory hands over the arrays it was
  // building, and a mesh whose geometry a caller can still push into is not a
  // mesh.
  constructor(options: MeshOptions) {
    this.points = [...options.points];
    this.triangles = [...options.triangles];
    this.radius = options.boundingRadius;
    this.scaledRadius = options.boundingRadius;
    this.vertexNormals = new VertexNormals(this.points.length);
  }

  // The histogram's fixed bin edges (E6) are camera.distance ± this, rather
  // than the submitted set's own per-frame min/max — a rotating mesh must not
  // make its own axis breathe.
  //
  // A *scaling* mesh must, though, and that is the difference E4a introduced:
  // rotation is rigid and leaves the extent alone, so the authored radius was
  // the whole answer until SCALE existed. At 3.0 every depth sample would fall
  // outside a window folded from the registry's raw coordinates, and the
  // histogram would pile up against both edges rather than describe the shape.
  public get boundingRadius(): number {
    return this.scaledRadius;
  }

  // What this mesh submits, for the GEOMETRY card. MeshFactory maps the
  // registry entry one-for-one, so these are the same two numbers SHAPE INFO
  // prints — counted per mesh rather than per primitive, which is what keeps
  // them honest while a transition has two meshes on screen at once.
  public get pointCount(): number {
    return this.points.length;
  }

  public get triangleCount(): number {
    return this.triangles.length;
  }

  // Folded on demand rather than cached, and called only while GROUND SHADOW is
  // on — Surface3D reads the layer flag before it asks. The points hold whatever
  // the frame's setTransform wrote, so the box describes the pose about to be
  // drawn rather than the one the registry authored; caching it would need an
  // invalidation path on every transform, for a fold over at most 4224 points
  // that costs nothing beside the fill it precedes.
  //
  // A mesh with no points comes back with an inverted box rather than a zeroed
  // one. Nothing in the registry is empty, and a caller that got zeros would
  // draw a shadow at the origin instead of noticing.
  public getBounds(): MeshBounds {
    const bounds: MeshBounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };

    for (const point of this.points) {
      bounds.minX = Math.min(bounds.minX, point.xValue);
      bounds.maxX = Math.max(bounds.maxX, point.xValue);
      bounds.minY = Math.min(bounds.minY, point.yValue);
      bounds.maxY = Math.max(bounds.maxY, point.yValue);
      bounds.minZ = Math.min(bounds.minZ, point.zValue);
      bounds.maxZ = Math.max(bounds.maxZ, point.zValue);
    }

    return bounds;
  }

  // Three named passes over the same triangle array, replacing the one fused
  // call render() used to make per triangle (E6/COS-239) — so each can be
  // timed on its own and the histogram can read a real depth for every
  // submitted triangle, culled or not, rather than only the drawn ones.
  // Nothing here returns a count: every number this used to hand back to the
  // caller now lives on pass.stats, written as it is produced, which is what
  // lets two renderables mid-transition sum into the one frame both belong to
  // instead of each caller adding up return values by hand.
  public renderMesh(pass: MeshRenderPass) {
    pass.stats.addSubmitted(this.triangles.length);

    // Built once per call, like clipContext below and for the same reason. The
    // two edges are read off the shared accumulator rather than recomputed:
    // Surface3D fixes them for the whole frame before this runs, which is what
    // makes DEPTH's ramp and the Z-BUFFER card's axis one window.
    const depth: DepthContext = {
      eyeDistance: pass.eyeDistance,
      near: pass.stats.depthNear,
      far: pass.stats.depthFar,
    };
    const transformStartedAt = pass.timed ? performance.now() : 0;

    for (const triangle of this.triangles) {
      triangle.project(pass.offsetX, pass.offsetY);
    }

    // In the transform bracket rather than the raster one: it is a fold over
    // geometry, it runs over every triangle whether or not it will be drawn, and
    // it happens before the sort for the same reason the projection does.
    // GOURAUD only — nothing else reads a vertex shade, and this is a second
    // pass over the torus knot's 7920 faces.
    if (pass.options.shadingMode === "GOURAUD" && pass.rasterizer) {
      this.shadeVertices(pass.options.lighting);
    }

    if (pass.timed) {
      pass.stats.addTransformMs(performance.now() - transformStartedAt);
    }

    // The painter's sort belongs to this pass, not the one before it: it
    // reads each triangle's own z, which project() does not touch, so its
    // result is identical whichever side of the transform loop it runs on —
    // grouped here to match where E6 puts its cost in the timing bracket.
    this.sortByDepth();

    const clipCullStartedAt = pass.timed ? performance.now() : 0;
    const survivors: Triangle[] = [];
    // Built once per call rather than once per triangle — see NearClipContext
    // on Triangle for why that matters to the fast path.
    const clipContext: NearClipContext = {
      near: pass.near,
      far: pass.far,
      eyeDistance: pass.eyeDistance,
      offsetX: pass.offsetX,
      offsetY: pass.offsetY,
      cullBackfaces: pass.options.cullBackfaces ?? true,
    };

    for (const triangle of this.triangles) {
      // Binned here, over every submitted triangle rather than only the
      // ones that go on to raster: a backface-culled triangle still occupies
      // real depth, and reads Triangle.depth (the mean z the sort already
      // uses) rather than a projected coordinate, so it costs nothing extra
      // and cannot be garbage the way a post-projection value could be for a
      // triangle the near plane was about to reject.
      pass.stats.addDepthSample(triangle.depth + pass.eyeDistance);

      // Near-plane split, far-plane reject and the backface test all now
      // live on this one call (COS-418/E2b) — a straddling triangle can
      // push two fragments here instead of the one-or-none this loop saw
      // before.
      triangle.clipToNear(clipContext, survivors);
    }

    if (pass.timed) {
      pass.stats.addClipCullMs(performance.now() - clipCullStartedAt);
    }

    const rasterStartedAt = pass.timed ? performance.now() : 0;

    if (pass.options.shadingMode === "POINTS") {
      this.renderPoints(pass, survivors.length);
    } else {
      this.renderSurvivors(pass, survivors, depth);
    }

    if (pass.timed) {
      pass.stats.addRasterMs(performance.now() - rasterStartedAt);
    }
  }

  // Idempotent, unlike the incremental transform it replaces: applying the same
  // matrix twice leaves the mesh where it was. That is what lets a transition
  // hand the same matrix to both the outgoing and the incoming mesh and get one
  // shared attitude, and it removes a whole class of drift — the geometry is
  // never the product of the frames that came before it.
  public setTransform(transform: number[][]) {
    for (const point of this.points) {
      point.setFromSource(transform);
    }

    // One sqrt per mesh per frame, which is what keeps boundingRadius describing
    // the mesh that was just posed rather than the one the registry authored.
    // Derived from the matrix rather than passed in, so nothing has to thread
    // the SCALE row down through the render path to reach it.
    this.scaledRadius = this.radius * uniformScaleOf(transform);
  }

  // The material half of setTransform above, and deliberately the same shape:
  // one push over the triangles, idempotent, with the caller free to hand the
  // same object to both meshes alive during a transition. It is a push rather
  // than a held reference so nothing has to be resolved on the render path —
  // the cost lands on the click that moved the swatch.
  public setMaterial(material: MeshMaterial) {
    for (const triangle of this.triangles) {
      triangle.setMaterial(material);
    }
  }

  private renderSurvivors(pass: MeshRenderPass, survivors: Triangle[], depth: DepthContext) {
    for (const triangle of survivors) {
      const drawn = pass.rasterizer
        ? triangle.rasterize(pass.rasterizer, pass.options, depth)
        : triangle.fill(pass.context, pass.options, depth);

      if (!drawn) {
        continue;
      }

      pass.stats.addDrawn();
      pass.stats.addDrawCall();

      const area = triangle.screenArea();

      // E2's near plane already guarantees a positive projection denominator
      // for anything that reaches this pass; a non-finite area means it
      // somehow did not. Counted rather than thrown, because a defensive
      // assertion that stops the frame is worse than a card that says so.
      if (Number.isFinite(area)) {
        pass.stats.addFillPx(area);
      } else {
        pass.stats.addInverted();
      }
    }
  }

  // POINTS mode's raster pass (E3c/COS-243), replacing the triangle loop rather
  // than joining it: the mode draws the mesh's corners and nothing else.
  //
  // The survivor count still goes in as drawn, even though no triangle is
  // rasterised. D6 fixes what that word means — passed culling and the
  // near-plane guard — and these did; reporting zero would make the GEOMETRY
  // card print 100% culled over a frame whose every vertex is on screen.
  //
  // isClipped per point, which the triangle path never needs: clipToNear splits
  // a straddling face at the plane, and there is nothing to split here. A vertex
  // behind the eye divides by a negative depth and lands mirrored across the
  // vanishing point, so it is dropped rather than drawn somewhere it is not.
  private renderPoints(pass: MeshRenderPass, drawnTriangles: number) {
    const size = Math.max(POINT_SIZE, Math.round(POINT_SIZE * (pass.options.lineWidth ?? 1)));

    pass.stats.addDrawn(drawnTriangles);
    pass.context.save();
    pass.context.globalAlpha = Math.min(1, Math.max(0, pass.options.opacity ?? 1));
    pass.context.fillStyle = POINT_INK_CSS;

    for (const point of this.points) {
      if (point.isClipped) {
        continue;
      }

      const projected = point.convert3D2D();
      const x = projected.x + pass.offsetX;
      const y = projected.y + pass.offsetY;

      if (pass.rasterizer) {
        const invD = 1 / (point.zValue + pass.eyeDistance);

        if (!pass.rasterizer.fillPoint(x, y, invD, POINT_INK, size)) {
          continue;
        }
      } else {
        pass.context.fillRect(Math.round(x) - (size >> 1), Math.round(y) - (size >> 1), size, size);
      }

      pass.stats.addDrawCall();
      pass.stats.addFillPx(size * size);
    }

    pass.context.restore();
  }

  // GOURAUD's per-frame fold: every face's normal into the corners it shares,
  // then one shade per corner. Rebuilt rather than rotated because the points
  // hold whatever this frame's setTransform wrote and the light is in that same
  // space — see VertexNormals for why carrying an object-space set would be both
  // more work and more ways to be wrong.
  private shadeVertices(lighting: Lighting) {
    this.vertexNormals.rebuild(this.triangles, lighting);

    for (const triangle of this.triangles) {
      triangle.cacheVertexShades(this.vertexNormals);
    }
  }

  // The painter's algorithm: far faces first, so near ones paint over them.
  // Descending, and the direction is not a preference — invert it and every mesh
  // renders inside-out. In place, because the order is only ever read here and a
  // sorted copy per frame would allocate one array per mesh per frame.
  private sortByDepth() {
    this.triangles.sort((t1, t2) => t2.depth - t1.depth);
  }
}

export default Mesh;
