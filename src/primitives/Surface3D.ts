import type Camera from "@primitives/Camera";
import type Mesh from "@primitives/Mesh";
import type RenderTarget from "@primitives/RenderTarget";
import type { TriangleRenderOptions } from "@primitives/Triangle";
import type BackgroundRenderer from "@rendering/BackgroundRenderer";

export interface MeshRenderRequest {
  mesh: Mesh;
  offsetX?: number;
  offsetY?: number;
}

// Four arguments, none optional but a background renderer, so R4's options
// object rather than growing the constructor's positional list past three.
export interface Surface3DOptions {
  container: CanvasRenderingContext2D;
  camera: Camera;
  renderTarget: RenderTarget;
  backgroundRenderer?: BackgroundRenderer | null;
}

// What one call to render() cost, split by the passes this renderer actually
// has. The design's four phases (TRANSFORM / CLIP-CULL / RASTERIZE / PRESENT)
// do not map onto it: there is no present step in a 2D canvas, and the backface
// test lives inside Triangle.render where it cannot be timed separately without
// instrumenting the inner loop. These two are separable, real, and measured
// here rather than by the caller — only this class knows where the boundary is.
export interface RenderStats {
  triangles: number;
  backgroundMs: number;
  rasterMs: number;
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

  constructor(options: Surface3DOptions) {
    this.surface3DContainer = options.container;
    this.camera = options.camera;
    this.renderTarget = options.renderTarget;
    this.backgroundRenderer = options.backgroundRenderer ?? null;
  }

  public render(renderables: MeshRenderRequest[], options: TriangleRenderOptions): RenderStats {
    const backgroundStartedAt = performance.now();

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

    const rasterStartedAt = performance.now();
    let renderedTriangles = 0;

    for (const renderable of renderables) {
      renderedTriangles += renderable.mesh.renderMesh(
        this.surface3DContainer,
        renderable.offsetX ?? 0,
        renderable.offsetY ?? 0,
        options,
      );
    }

    return {
      triangles: renderedTriangles,
      backgroundMs: rasterStartedAt - backgroundStartedAt,
      rasterMs: performance.now() - rasterStartedAt,
    };
  }
}

export default Surface3D;
