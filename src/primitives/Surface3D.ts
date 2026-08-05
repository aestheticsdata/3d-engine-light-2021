import type Camera from "@primitives/Camera";
import type Mesh from "@primitives/Mesh";
import type RenderTarget from "@primitives/RenderTarget";
import type { TriangleRenderOptions } from "@primitives/Triangle";
import type BackgroundRenderer from "@rendering/BackgroundRenderer";
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
  public render(renderables: MeshRenderRequest[], options: TriangleRenderOptions, timed: boolean): RenderStats {
    // Fixed for the whole call, across every renderable: two meshes mid
    // transition must bin into the same edges, or their two histograms would
    // each have their own axis and neither would describe the frame.
    const boundingRadius = Math.max(0, ...renderables.map((renderable) => renderable.mesh.boundingRadius));

    this.stats.setDepthRange(this.camera.distance - boundingRadius, this.camera.distance + boundingRadius);

    const presentStartedAt = timed ? performance.now() : 0;

    this.backgroundRenderer?.render({
      context: this.surface3DContainer,
      camera: this.camera,
      renderTarget: this.renderTarget,
    });
    if (!this.backgroundRenderer) {
      this.surface3DContainer.clearRect(
        0,
        0,
        this.surface3DContainer.canvas.width,
        this.surface3DContainer.canvas.height,
      );
    }
    // One submission either way: a real background pass or the clearRect
    // fallback, PRESENT's own canvas call for the frame (E6/COS-239).
    this.stats.addDrawCall();

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
        timed,
      });
    }

    return this.stats;
  }
}

export default Surface3D;
