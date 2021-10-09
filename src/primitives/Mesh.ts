import Triangle from "./Triangle";
import Point3D from "./Point3D";


class Mesh {
  pointsMesh: Point3D[] = [];
  trianglesMesh: Triangle[] = [];

  renderMesh(container: any) {
    for (const i in this.trianglesMesh) {
      this.trianglesMesh[i].render(container);
    }
  }

  changeFocal(value: number) {
    for (const i in this.trianglesMesh) {
      this.trianglesMesh[i].changeFocal(value);
    }
  };

  changeOffset(value: number) {
    for (const i in this.trianglesMesh) {
      this.trianglesMesh[i].changeOffsetZ(value);
    }
  };

  transformMesh(rot: number[][]) {
    for (const i in this.pointsMesh) {
      this.pointsMesh[i].transformPt(rot);
    }
  };

  setMesh(points: Point3D[], triangles: Triangle[]) {
    for (const i in this.pointsMesh) {
      this.pointsMesh[i] = points[i];
    }

    for (const i in triangles) {
      this.trianglesMesh [i] = triangles[i];
    }
  }
};

export default Mesh;


