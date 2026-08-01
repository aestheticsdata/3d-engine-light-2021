import Triangle, { TriangleRenderOptions } from "@primitives/Triangle";
import Point3D from "@primitives/Point3D";

class Mesh {
  private readonly points: Point3D[] = [];
  private readonly triangles: Triangle[] = [];

  constructor(points: Point3D[], triangles: Triangle[]) {
    this.points = [...points];
    this.triangles = [...triangles];
  }

  public renderMesh(
    context: CanvasRenderingContext2D,
    offsetX: number = 0,
    offsetY: number = 0,
    options: TriangleRenderOptions,
  ): number {
    this.triangles.sort((t1, t2) => t2.depth - t1.depth);
    let renderedTriangles = 0;

    for (const i in this.triangles) {
      if (this.triangles[i].render(context, offsetX, offsetY, options)) {
        renderedTriangles++;
      }
    }

    return renderedTriangles;
  }

  public changeFocal(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeFocal(value);
    }
  }

  public changeOffsetZ(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeOffsetZ(value);
    }
  }

  public transformMesh(rot: number[][]) {
    for (const i in this.points) {
      this.points[i].transformPt(rot);
    }
  }
}

export default Mesh;
