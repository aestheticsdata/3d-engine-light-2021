import type Mesh from "@primitives/Mesh";
import type { TriangleRenderOptions } from "@primitives/Triangle";
import type BackgroundRenderer from "@rendering/BackgroundRenderer";

export interface MeshRenderRequest {
  mesh: Mesh;
  offsetX?: number;
  offsetY?: number;
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
  private readonly backgroundRenderer: BackgroundRenderer | null;

  constructor(container: CanvasRenderingContext2D, backgroundRenderer: BackgroundRenderer | null = null) {
    this.surface3DContainer = container;
    this.backgroundRenderer = backgroundRenderer;
  }

  public render(renderables: MeshRenderRequest[], options: TriangleRenderOptions): RenderStats {
    const backgroundStartedAt = performance.now();

    this.backgroundRenderer?.render(this.surface3DContainer);
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
