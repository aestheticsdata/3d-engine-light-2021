import Mesh from "@primitives/Mesh";
import { TriangleRenderOptions } from "@primitives/Triangle";

export interface MeshRenderRequest {
  mesh: Mesh;
  offsetX?: number;
  offsetY?: number;
}

class Surface3D {
  private readonly surface3DContainer: CanvasRenderingContext2D;

  constructor(container: CanvasRenderingContext2D) {
    this.surface3DContainer = container;
  }

  public render(
    renderables: MeshRenderRequest[],
    options: TriangleRenderOptions = {},
  ): number {
    this.surface3DContainer.clearRect(
      0,
      0,
      this.surface3DContainer.canvas.width,
      this.surface3DContainer.canvas.height,
    );
    let renderedTriangles = 0;

    for (const renderable of renderables) {
      renderedTriangles += renderable.mesh.renderMesh(
        this.surface3DContainer,
        renderable.offsetX ?? 0,
        renderable.offsetY ?? 0,
        options,
      );
    }

    return renderedTriangles;
  }
}

export default Surface3D;
