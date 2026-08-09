import FrameBuffer from "@rendering/FrameBuffer";
import Rasterizer from "@rendering/Rasterizer";
import TexturePixelCache from "@rendering/TexturePixelCache";

import type Camera from "@primitives/Camera";
import type { ProjectionMode } from "@primitives/Camera";
import type Mesh from "@primitives/Mesh";
import type RenderTarget from "@primitives/RenderTarget";
import type { TriangleRenderOptions } from "@primitives/Triangle";
import type BackgroundRenderer from "@rendering/BackgroundRenderer";
import type { ShadowBlob } from "@rendering/GroundShadow";
import type RenderStats from "@rendering/RenderStats";

export interface MeshRenderRequest {
  mesh: Mesh;
  offsetX?: number;
  offsetY?: number;
}

// Five arguments, none optional but a background renderer, so R4's options
// object rather than growing the constructor's positional list past three.
export interface Surface3DOptions {
  container: CanvasRenderingContext2D;
  camera: Camera;
  renderTarget: RenderTarget;
  backgroundRenderer?: BackgroundRenderer | null;
  // Owned by Main (E6/COS-239), not this class: Main has to call beginFrame()
  // before the rig's own matrix pass runs, which happens before render() is
  // ever reached, so the shared accumulator has to already exist by the time
  // this constructor sees it.
  stats: RenderStats;
}

// Four values that describe one frame rather than the surface, so they ride on
// the call rather than becoming fields (R4).
export interface SurfaceRenderRequest {
  renderables: MeshRenderRequest[];
  options: TriangleRenderOptions;
  timed: boolean;
  cameraTransform: number[][];
  // Reads uiState.zbuffer (E3b/COS-242) — Main is the one caller, and this is
  // the one place the toggle is consumed rather than threaded through
  // TriangleRenderOptions: it selects a per-frame BACKEND, not a per-triangle
  // paint option, which is the same distinction that already keeps `timed`
  // and `cameraTransform` off that object.
  zBufferEnabled: boolean;
}

// A snapshot is only valid for the exact inputs it was captured under —
// sixteen camera numbers rather than a reference compare, since
// CameraRig.viewMatrix() returns a fresh array every frame even when nothing
// about the camera moved.
interface SnapshotSignature {
  cameraTransform: number[][];
  // focalLength + distance is sufficient to detect any projection-relevant
  // change even though cameraTransform (the rig's own rotation/position
  // matrix) does not move when only FOV or ORTHOGRAPHIC/PERSPECTIVE changes:
  // GroundProjection's floor/grid geometry reads Camera.scaleAt, which for
  // perspective is focal/depthAt(z) and for orthographic is magnification —
  // and magnification = focal/distance, so these two numbers plus mode cover
  // every branch scaleAt can take without adding a getter Camera does not
  // already have.
  focalLength: number;
  distance: number;
  mode: ProjectionMode;
  width: number;
  height: number;
  layersVersion: number;
  fogVersion: number;
}

class Surface3D {
  private readonly surface3DContainer: CanvasRenderingContext2D;
  // Held live, the same as every Point3D holds its own camera (COS-246): a
  // slider moving the shared Camera or a later resize moving the shared
  // RenderTarget must reach the ground projection the background renderer
  // builds from these without this class being reconstructed.
  private readonly camera: Camera;
  private readonly renderTarget: RenderTarget;
  private readonly backgroundRenderer: BackgroundRenderer | null;
  private readonly stats: RenderStats;
  private readonly frameBuffer: FrameBuffer;
  private readonly rasterizer: Rasterizer;
  private readonly textureCache: TexturePixelCache;
  private snapshot: Uint8ClampedArray | null;
  private snapshotSignature: SnapshotSignature | null;

  constructor(options: Surface3DOptions) {
    this.surface3DContainer = options.container;
    this.camera = options.camera;
    this.renderTarget = options.renderTarget;
    this.backgroundRenderer = options.backgroundRenderer ?? null;
    this.stats = options.stats;
    this.frameBuffer = new FrameBuffer(options.renderTarget.width, options.renderTarget.height);
    this.textureCache = new TexturePixelCache();
    this.rasterizer = new Rasterizer(this.frameBuffer, this.textureCache);
    this.snapshot = null;
    this.snapshotSignature = null;
  }

  // Called by Main alongside mapper.invalidate() (RenderPipelinePanel's own
  // texture-swatch handler) — the two caches are invalidated by the same
  // event for the same reason: ProceduralTextures repaints CHECKER and UV
  // GRID in place, so a cached decode is wrong the moment a swatch moves.
  public invalidateTextures() {
    this.textureCache.invalidate();
  }

  // timed comes from Main's own RenderStats.beginFrame() call, made before
  // the rig's matrix pass — not called again here, because beginFrame() may
  // only run once per frame or its one-in-six sampling cadence would drift.
  public render(request: SurfaceRenderRequest): RenderStats {
    const { renderables, options, timed, cameraTransform, zBufferEnabled } = request;
    // Fixed for the whole call, across every renderable: two meshes mid
    // transition must bin into the same edges, or their two histograms would
    // each have their own axis and neither would describe the frame.
    const boundingRadius = Math.max(0, ...renderables.map((renderable) => renderable.mesh.boundingRadius));

    this.stats.setDepthRange(this.camera.distance - boundingRadius, this.camera.distance + boundingRadius);
    // Read back off the accumulator rather than recomputed from the same two
    // expressions (E3c/COS-243): DEPTH mode's grey ramp and the Z-BUFFER card's
    // axis labels have to describe one window, and one origin is how that stays
    // true without a second call site to keep in step.
    this.rasterizer.setDepthRange(this.stats.depthNear, this.stats.depthFar);
    // The same pair the depth bins are centred on, which is why the fog is aimed
    // from here rather than from Main (E5b/COS-247): the scene radius exists only
    // once this call has folded it, and the near edge of the fog is the near edge
    // of the subject.
    options.fog.setCamera(this.camera.distance, boundingRadius);

    // Wireframe never fills a pixel on either backend (Triangle.fill()'s own
    // wireframe branch returns before anything the depth buffer could test),
    // so there is nothing for the rasteriser to do with it — see Mesh's own
    // raster pass for the other half of this.
    const useRasterizer = zBufferEnabled && !options.wireframe && this.backgroundRenderer !== null;

    if (useRasterizer) {
      return this.renderBuffered({ renderables, options, timed, cameraTransform });
    }

    return this.renderPainted({ renderables, options, timed, cameraTransform });
  }

  private renderPainted(request: Omit<SurfaceRenderRequest, "zBufferEnabled">): RenderStats {
    const { renderables, options, timed, cameraTransform } = request;
    const presentStartedAt = timed ? performance.now() : 0;
    const blobs = this.shadowBlobs(renderables);

    this.backgroundRenderer?.render({
      context: this.surface3DContainer,
      camera: this.camera,
      renderTarget: this.renderTarget,
      cameraTransform,
      fog: options.fog,
      blobs,
      stats: this.stats,
    });
    if (!this.backgroundRenderer) {
      this.surface3DContainer.clearRect(
        0,
        0,
        this.surface3DContainer.canvas.width,
        this.surface3DContainer.canvas.height,
      );
      // The fallback's own submission. A real background pass counts one per
      // layer it painted instead (E5b/COS-247), which is why this increment is
      // no longer shared between the two branches.
      this.stats.addDrawCall();
    }

    if (timed) {
      this.stats.addPresentMs(performance.now() - presentStartedAt);
    }

    for (const renderable of renderables) {
      renderable.mesh.renderMesh({
        context: this.surface3DContainer,
        offsetX: renderable.offsetX ?? 0,
        offsetY: renderable.offsetY ?? 0,
        options,
        stats: this.stats,
        eyeDistance: this.camera.distance,
        near: this.camera.near,
        far: this.camera.far,
        timed,
        rasterizer: null,
      });
    }

    // The ground again, and only when the camera has dropped under it: from
    // below, the floor is in front of every solid standing on it, and with no
    // depth buffer the painting order is the only thing that can say so.
    this.backgroundRenderer?.renderGroundOverlay({
      context: this.surface3DContainer,
      camera: this.camera,
      renderTarget: this.renderTarget,
      cameraTransform,
      fog: options.fog,
      blobs,
      stats: this.stats,
    });

    return this.stats;
  }

  // The depth-buffered path (E3b/COS-242). Seeds the colour buffer from the
  // (possibly cached) background snapshot, walks the mesh loop through the
  // rasteriser instead of the canvas, presents the buffer's own dirty rect,
  // then draws the two layers the snapshot cannot cover.
  private renderBuffered(request: Omit<SurfaceRenderRequest, "zBufferEnabled">): RenderStats {
    const { renderables, options, timed, cameraTransform } = request;
    const backgroundRenderer = this.backgroundRenderer as BackgroundRenderer;

    this.frameBuffer.setSize(this.renderTarget.width, this.renderTarget.height);

    const presentStartedAt = timed ? performance.now() : 0;
    const snapshot = this.snapshotFor(backgroundRenderer, cameraTransform, options);

    this.frameBuffer.clear(snapshot);

    for (const renderable of renderables) {
      renderable.mesh.renderMesh({
        context: this.surface3DContainer,
        offsetX: renderable.offsetX ?? 0,
        offsetY: renderable.offsetY ?? 0,
        options,
        stats: this.stats,
        eyeDistance: this.camera.distance,
        near: this.camera.near,
        far: this.camera.far,
        timed,
        rasterizer: this.rasterizer,
      });
    }

    this.frameBuffer.present(this.surface3DContainer);

    backgroundRenderer.renderPostMeshLayers({
      context: this.surface3DContainer,
      camera: this.camera,
      renderTarget: this.renderTarget,
      cameraTransform,
      fog: options.fog,
      blobs: this.shadowBlobs(renderables),
      stats: this.stats,
    });

    if (timed) {
      this.stats.addPresentMs(performance.now() - presentStartedAt);
    }

    return this.stats;
  }

  // Rebuilds the cached snapshot only when the signature it was captured
  // under has changed, rather than through explicit invalidate() calls
  // scattered across every Main.ts call site that can move the camera, the
  // layers, or fog — a signature compare is self-healing by construction:
  // anything that changes one of these inputs is caught, with no
  // per-call-site bookkeeping for a future ticket to forget. getImageData is
  // the one call in this method that costs anything; every frame that reuses
  // the cache pays a handful of comparisons instead.
  private snapshotFor(
    backgroundRenderer: BackgroundRenderer,
    cameraTransform: number[][],
    options: SurfaceRenderRequest["options"],
  ): Uint8ClampedArray {
    const signature: SnapshotSignature = {
      cameraTransform,
      focalLength: this.camera.focalLength,
      distance: this.camera.distance,
      mode: this.camera.mode,
      width: this.renderTarget.width,
      height: this.renderTarget.height,
      layersVersion: backgroundRenderer.layersVersion,
      fogVersion: options.fog.version,
    };

    if (this.snapshot && this.snapshotSignature && this.signaturesMatch(this.snapshotSignature, signature)) {
      return this.snapshot;
    }

    backgroundRenderer.renderSnapshotLayers({
      context: this.surface3DContainer,
      camera: this.camera,
      renderTarget: this.renderTarget,
      cameraTransform,
      fog: options.fog,
      blobs: [],
      stats: this.stats,
    });

    const captured = this.surface3DContainer.getImageData(0, 0, this.renderTarget.width, this.renderTarget.height);

    this.snapshot = captured.data;
    this.snapshotSignature = signature;

    return this.snapshot;
  }

  private signaturesMatch(a: SnapshotSignature, b: SnapshotSignature): boolean {
    if (
      a.width !== b.width ||
      a.height !== b.height ||
      a.layersVersion !== b.layersVersion ||
      a.fogVersion !== b.fogVersion ||
      a.focalLength !== b.focalLength ||
      a.distance !== b.distance ||
      a.mode !== b.mode
    ) {
      return false;
    }

    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        if (a.cameraTransform[row][column] !== b.cameraTransform[row][column]) {
          return false;
        }
      }
    }

    return true;
  }

  // Folded here rather than by the background renderer, because this is the
  // class that holds the mesh list — and folded only while GROUND SHADOW is on,
  // so an off switch costs a boolean read instead of a pass over 4224 points.
  // The transition's screen offsets come along, or a shadow sits under the
  // middle of the canvas while the shape it belongs to slides off the edge.
  private shadowBlobs(renderables: MeshRenderRequest[]): readonly ShadowBlob[] {
    if (!this.backgroundRenderer?.shadow) {
      return [];
    }

    return renderables.map((renderable) => ({
      bounds: renderable.mesh.getBounds(),
      offsetX: renderable.offsetX ?? 0,
      offsetY: renderable.offsetY ?? 0,
    }));
  }
}

export default Surface3D;
