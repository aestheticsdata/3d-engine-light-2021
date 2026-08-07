import type Camera from "@primitives/Camera";
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

  constructor(options: Surface3DOptions) {
    this.surface3DContainer = options.container;
    this.camera = options.camera;
    this.renderTarget = options.renderTarget;
    this.backgroundRenderer = options.backgroundRenderer ?? null;
    this.stats = options.stats;
  }

  // timed comes from Main's own RenderStats.beginFrame() call, made before
  // the rig's matrix pass — not called again here, because beginFrame() may
  // only run once per frame or its one-in-six sampling cadence would drift.
  public render(request: SurfaceRenderRequest): RenderStats {
    const { renderables, options, timed, cameraTransform } = request;
    // Fixed for the whole call, across every renderable: two meshes mid
    // transition must bin into the same edges, or their two histograms would
    // each have their own axis and neither would describe the frame.
    const boundingRadius = Math.max(0, ...renderables.map((renderable) => renderable.mesh.boundingRadius));

    this.stats.setDepthRange(this.camera.distance - boundingRadius, this.camera.distance + boundingRadius);
    // The same pair the depth bins are centred on, which is why the fog is aimed
    // from here rather than from Main (E5b/COS-247): the scene radius exists only
    // once this call has folded it, and the near edge of the fog is the near edge
    // of the subject.
    options.fog.setCamera(this.camera.distance, boundingRadius);

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
