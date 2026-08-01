class Matrix3D {
  // Declared without initialisers on purpose. Under `useDefineForClassFields`,
  // which ESNext turns on, a field initialiser runs before the constructor body —
  // so an initialiser calling setAngle would build the three matrices and then
  // have them overwritten with undefined a moment later.
  private rollMatrix: number[][];
  private pitchMatrix: number[][];
  private yawMatrix: number[][];

  // Zero degrees is the identity rotation, so a Matrix3D that has never been
  // given an angle still hands out three usable matrices rather than undefined.
  constructor() {
    this.setAngle(0);
  }

  // The live internal arrays, deliberately. CameraController reads all three
  // every frame for every mesh on screen; copying them defensively would mean
  // nine fresh arrays per frame to protect against a caller that does not exist.
  public get roll(): number[][] {
    return this.rollMatrix;
  }

  public get pitch(): number[][] {
    return this.pitchMatrix;
  }

  public get yaw(): number[][] {
    return this.yawMatrix;
  }

  public setAngle(degrees: number) {
    const radians = degrees * (Math.PI / 180);

    this.setMatrix3D(Math.cos(radians), Math.sin(radians));
  }

  // The cosine and the sine arrive as arguments rather than through two fields.
  // They are not this object's state — they exist for the length of one setAngle
  // call, and holding them as fields made the object look as though it
  // remembered an angle it never exposed.
  private setMatrix3D(cos: number, sin: number) {
    this.rollMatrix = [
      [cos, -sin, 0, 0],
      [sin,  cos, 0, 0],
      [0,    0,   1, 0],
      [0,    0,   0, 1],
    ];

    this.pitchMatrix = [
      [1,  0,    0,   0],
      [0,  cos, -sin, 0],
      [0,  sin,  cos, 0],
      [0,  0,    0,   1],
    ];

    this.yawMatrix = [
      [ cos, 0,  sin, 0],
      [0,    1,  0,   0],
      [-sin, 0,  cos, 0],
      [0,    0,  0,   1],
    ];
  }
}

export default Matrix3D;
