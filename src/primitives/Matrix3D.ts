class Matrix3D {
  roll: number[][];
  pitch: number[][];
  yaw: number[][];
  cos: number = 0;
  sin: number = 0;

  setMatrix3D() {
    this.roll = [
      [this.cos, -this.sin, 0, 0],
      [this.sin,  this.cos, 0, 0],
      [0,         0,        1, 0],
      [0,         0,        0, 1],
    ];

    this.pitch = [
      [1,  0,         0,        0],
      [0,  this.cos, -this.sin, 0],
      [0,  this.sin,  this.cos, 0],
      [0,  0,         0,        1],
    ];

    this.yaw = [
      [ this.cos, 0,  this.sin, 0],
      [0,         1,  0,        0],
      [-this.sin, 0,  this.cos, 0],
      [0,         0,  0,        1],
    ];
  };

  setAngle(agl: number) {
    agl = agl * (Math.PI / 180); // radian angle
    this.cos = Math.cos(agl);
    this.sin = Math.sin(agl);

    this.setMatrix3D();
  };
}

export default Matrix3D;


