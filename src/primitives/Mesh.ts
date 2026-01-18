import Triangle from "@primitives/Triangle";
import Point3D from "@primitives/Point3D";

class Mesh {
  private readonly points: Point3D[] = [];
  private readonly triangles: Triangle[] = [];

  constructor(points: Point3D[], triangles: Triangle[]) {
    this.points = [...points];
    this.triangles = [...triangles];
  }

  public renderMesh(context: CanvasRenderingContext2D) {
    this.triangles.sort((t1, t2) => t2.depth - t1.depth);

    for (const i in this.triangles) {
      this.triangles[i].render(context);
    }
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
