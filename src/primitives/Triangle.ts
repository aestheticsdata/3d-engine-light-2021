import Point3D from "./Point3D";
import Point2D from "./Point2D";

class Triangle {
  a: Point3D;
  b: Point3D;
  c: Point3D;
  aproj: Point2D;
  bproj: Point2D;
  cproj: Point2D;
  color: string;

  constructor(a: Point3D, b: Point3D, c: Point3D, color: string) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.color = color;
  }

  render(context: CanvasRenderingContext2D): void {
    this.aproj = this.a.convert3D2D();
    this.bproj = this.b.convert3D2D();
    this.cproj = this.c.convert3D2D();

    // console.log('-----------');
    // console.log(this.aproj.x);
    // console.log(this.bproj.x);
    // console.log(this.cproj.x);
    // console.log('-----------');

    // context.globalAlpha = 0.5;
    context.fillStyle = this.color;
    context.beginPath();
    context.moveTo(this.aproj.x, this.aproj.y);
    context.lineTo(this.bproj.x, this.bproj.y);
    context.lineTo(this.cproj.x, this.cproj.y);
    context.lineTo(this.aproj.x, this.aproj.y);
    context.closePath();
    context.fill();
  };

  changeFocal(value: number) {
    this.a.fl = this.b.fl = this.c.fl = value;
  };

  changeOffsetZ(value: number) {
    this.a.zOffset = this.b.zOffset = this.c.zOffset = value;
  }
}

export default Triangle;

