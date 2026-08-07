import type Point3D from "@primitives/Point3D";
import type Triangle from "@primitives/Triangle";
import type { NearClipContext, TriangleRenderOptions } from "@primitives/Triangle";
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

class Mesh {
  private readonly points: Point3D[];
  private readonly triangles: Triangle[];
  private readonly radius: number;
  private scaledRadius: number;

  // Copied rather than aliased: the factory hands over the arrays it was
  // building, and a mesh whose geometry a caller can still push into is not a
  // mesh.
  constructor(options: MeshOptions) {
    this.points = [...options.points];
    this.triangles = [...options.triangles];
    this.radius = options.boundingRadius;
    this.scaledRadius = options.boundingRadius;
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

    const transformStartedAt = pass.timed ? performance.now() : 0;

    for (const triangle of this.triangles) {
      triangle.project(pass.offsetX, pass.offsetY);
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

    for (const triangle of survivors) {
      const drawn = pass.rasterizer
        ? triangle.rasterize(pass.rasterizer, pass.options, pass.eyeDistance)
        : triangle.fill(pass.context, pass.options);

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

  // The painter's algorithm: far faces first, so near ones paint over them.
  // Descending, and the direction is not a preference — invert it and every mesh
  // renders inside-out. In place, because the order is only ever read here and a
  // sorted copy per frame would allocate one array per mesh per frame.
  private sortByDepth() {
    this.triangles.sort((t1, t2) => t2.depth - t1.depth);
  }
}

export default Mesh;
