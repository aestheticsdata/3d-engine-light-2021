import Point3D from "./Point3D";
import Point2D from "./Point2D";

class Triangle {
  private a: Point3D;
  private b: Point3D;
  private c: Point3D;
  public aproj: Point2D;
  public bproj: Point2D;
  public cproj: Point2D;
  public color: string;

  constructor(a: Point3D, b: Point3D, c: Point3D, color: string) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.color = color;
  }

  public render(context: CanvasRenderingContext2D): void {
    this.aproj = this.a.convert3D2D();
    this.bproj = this.b.convert3D2D();
    this.cproj = this.c.convert3D2D();

    context.fillStyle = this.color;
    context.beginPath();
    context.moveTo(this.aproj.x, this.aproj.y);
    context.lineTo(this.bproj.x, this.bproj.y);
    context.lineTo(this.cproj.x, this.cproj.y);
    context.lineTo(this.aproj.x, this.aproj.y);
    context.closePath();
    context.fill();
  };

  public changeFocal(value: number) {
    this.a.fl = this.b.fl = this.c.fl = value;
  };

  public changeOffsetZ(value: number) {
    this.a.zOffset = this.b.zOffset = this.c.zOffset = value;
  }
}

export default Triangle;

