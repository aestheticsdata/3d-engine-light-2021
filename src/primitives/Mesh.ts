import type { TriangleRenderOptions } from "@primitives/Triangle";
import type Triangle from "@primitives/Triangle";
import type Point3D from "@primitives/Point3D";

class Mesh {
  private readonly points: Point3D[];
  private readonly triangles: Triangle[];

  // Copied rather than aliased: the factory hands over the arrays it was
  // building, and a mesh whose geometry a caller can still push into is not a
  // mesh.
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
    this.sortByDepth();

    let renderedTriangles = 0;

    for (const triangle of this.triangles) {
      if (triangle.render(context, offsetX, offsetY, options)) {
        renderedTriangles++;
      }
    }

    return renderedTriangles;
  }

  public changeFocal(value: number) {
    for (const triangle of this.triangles) {
      triangle.changeFocal(value);
    }
  }

  public changeOffsetZ(value: number) {
    for (const triangle of this.triangles) {
      triangle.changeOffsetZ(value);
    }
  }

  public transformMesh(rot: number[][]) {
    for (const point of this.points) {
      point.transformPt(rot);
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
