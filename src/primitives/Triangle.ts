import Point3D from "./Point3D";
import Point2D from "./Point2D";

class Triangle {
  constructor(a: Point3D, b: Point3D, c: Point3D, color: string) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.color = color;
  }

  a: Point3D;
  b: Point3D;
  c: Point3D;
  aproj: Point2D = new Point2D(0,0);
  bproj: Point2D = new Point2D(0,0);
  cproj: Point2D = new Point2D(0,0);
  color: any;

  render(container: any): void {
    this.aproj = this.a.convert3D2D();
    this.bproj = this.b.convert3D2D();
    this.cproj = this.c.convert3D2D();

    container.graphics.beginFill(this.color);
    container.graphics.moveTo(this.aproj.x, this.aproj.y);
    container.graphics.lineTo(this.bproj.x, this.bproj.y);
    container.graphics.lineTo(this.cproj.x, this.cproj.y);
    container.graphics.lineTo(this.aproj.x, this.aproj.y);
    container.graphics.endFill();
  };

  changeFocal(value: number) {
    this.a.fl = this.b.fl = this.c.fl = value;
  };

  changeOffsetZ(value: number) {
    this.a.zOffset = this.b.zOffset = this.c.zOffset = value;
  }
}

export default Triangle;

