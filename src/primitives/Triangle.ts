import Point3D from "@primitives/Point3D";
import Point2D from "@primitives/Point2D";

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

  public get depth(): number {
    return (this.a.zValue + this.b.zValue + this.c.zValue) / 3;
  }

  public render(context: CanvasRenderingContext2D): void {
    this.aproj = this.a.convert3D2D();
    this.bproj = this.b.convert3D2D();
    this.cproj = this.c.convert3D2D();

    // Back-face culling:
    // Determine the winding order by calculating the cross product (z-component)
    // of the two edge vectors in 2D space.
    // Vector 1: B - A
    const v1x = this.bproj.x - this.aproj.x;
    const v1y = this.bproj.y - this.aproj.y;
    // Vector 2: C - A
    const v2x = this.cproj.x - this.aproj.x;
    const v2y = this.cproj.y - this.aproj.y;

    // Assuming standard winding order, a positive result indicates the face is visible
    // (Clockwise in Y-down canvas coordinates equivalent to CCW in standard 3D).
    if (v1x * v2y - v1y * v2x > 0) {
      context.fillStyle = this.color;
      context.beginPath();
      context.moveTo(this.aproj.x, this.aproj.y);
      context.lineTo(this.bproj.x, this.bproj.y);
      context.lineTo(this.cproj.x, this.cproj.y);
      context.lineTo(this.aproj.x, this.aproj.y);
      context.closePath();
      context.fill();
    }
  }

  public changeFocal(value: number) {
    this.a.fl = this.b.fl = this.c.fl = value;
  }

  public changeOffsetZ(value: number) {
    this.a.zOffset = this.b.zOffset = this.c.zOffset = value;
  }
}

export default Triangle;
