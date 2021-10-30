import Triangle from "./Triangle";
import Point3D from "./Point3D";


class Mesh {
  points: Point3D[] = [];
  triangles: Triangle[] = [];

  constructor(points: Point3D[], triangles: Triangle[]) {
    this.points = [...points];
    this.triangles = [...triangles];
  }

  renderMesh(context: any) {
    for (const i in this.triangles) {
      this.triangles[i].render(context);
    }
  }

  changeFocal(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeFocal(value);
    }
  };

  changeOffsetZ(value: number) {
    for (const i in this.triangles) {
      this.triangles[i].changeOffsetZ(value);
    }
  };

  transformMesh(rot: number[][]) {
    for (const i in this.points) {
      this.points[i].transformPt(rot);
    }
  };

};

export default Mesh;


