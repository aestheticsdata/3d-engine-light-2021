import Point2D from "./Point2D";

class Point3D {
  private x: number;
  private y: number;
  private z: number;
  public fl: number = 300;
  public zOffset: number = 0;
  private canvas: HTMLCanvasElement = document.querySelector('canvas');
  private readonly vpX: number;
  private readonly vpY: number;
  
  constructor(x: number, y: number, z: number) {
    if (this.canvas) {
      this.vpX = this.canvas.width >> 1;
      this.vpY = this.canvas.height >> 1;
    }

    this.x = x;
    this.y = y;
    this.z = z;
  }

  public convert3D2D(): Point2D {
    const scale = this.fl / (this.fl + this.z + this.zOffset);
    const tmpX = this.vpX + (this.x * scale);
    const tmpY = this.vpY + (this.y * scale);

    return new Point2D(tmpX, tmpY);
  };

  public transformPt(rot: number[][]) {
    let vect: [number, number, number, number] = [0, 0, 0, 0];
    vect[0] = rot[0][0] * this.x + rot[0][1] * this.y + rot[0][2] * this.z + rot[0][3] * 1;
    vect[1] = rot[1][0] * this.x + rot[1][1] * this.y + rot[1][2] * this.z + rot[1][3] * 1;
    vect[2] = rot[2][0] * this.x + rot[2][1] * this.y + rot[2][2] * this.z + rot[2][3] * 1;
    vect[3] = 1;

    this.x = vect[0];
    this.y = vect[1];
    this.z = vect[2];

    return {
      x: this.x,
      y: this.y,
      z: this.z
    };
  };
}

export default Point3D;

