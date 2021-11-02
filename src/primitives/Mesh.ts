import Triangle from "./Triangle";
import Point3D from "./Point3D";


class Mesh {
  private readonly points: Point3D[] = [];
  private readonly triangles: Triangle[] = [];

  constructor(points: Point3D[], triangles: Triangle[]) {
    this.points = [...points];
    this.triangles = [...triangles];
  }

  public renderMesh(context: CanvasRenderingContext2D) {
    for (const i in this.triangles) {
      this.triangles[i].render(context);
    }
  }

  public changeFocal(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeFocal(value);
    }
  };

  public changeOffsetZ(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeOffsetZ(value);
    }
  };

  public transformMesh(rot: number[][]) {
    for (const i in this.points) {
      this.points[i].transformPt(rot);
    }
  };
}

export default Mesh;


