// Transform matrices, built rather than remembered.
//
// This class used to hold three mutable 4x4 fields recomputed together from one
// cos/sin pair, so `pitch`, `yaw` and `roll` were only ever valid for the angle
// most recently handed to setAngle — reading two of them read one angle twice.
// Nothing here holds state now: every call returns a fresh matrix, which is what
// lets the camera rig compose one product per frame instead of applying three
// rotations in sequence to already-rotated points.
//
// Stateless and still a class, for the reason Vec3Math is one: five derivations
// bound by a shared convention — row-major 4x4, degrees in, translation in
// column 3 — that must not end up spelled out twice.

const DEGREES_TO_RADIANS = Math.PI / 180;
const COLUMNS = [0, 1, 2, 3];

class Matrix3D {
  public pitchMatrix(degrees: number): number[][] {
    const radians = degrees * DEGREES_TO_RADIANS;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return [
      [1, 0, 0, 0],
      [0, cos, -sin, 0],
      [0, sin, cos, 0],
      [0, 0, 0, 1],
    ];
  }

  public yawMatrix(degrees: number): number[][] {
    const radians = degrees * DEGREES_TO_RADIANS;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return [
      [cos, 0, sin, 0],
      [0, 1, 0, 0],
      [-sin, 0, cos, 0],
      [0, 0, 0, 1],
    ];
  }

  public rollMatrix(degrees: number): number[][] {
    const radians = degrees * DEGREES_TO_RADIANS;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return [
      [cos, -sin, 0, 0],
      [sin, cos, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  // Rodrigues' rotation about an arbitrary axis, which is what a constant
  // angular velocity actually is. Composing roll·yaw·pitch deltas instead would
  // be close but not equal — those three do not commute, so the composed axis
  // shifts with the step size and the tumble would drift with the frame rate.
  // One axis, one angle, and R(a)·R(b) = R(a+b) exactly.
  //
  // The axis need not arrive normalised; a zero-length one is the identity,
  // which is the honest answer for "no angular velocity" rather than a NaN.
  public axisAngleMatrix(x: number, y: number, z: number, degrees: number): number[][] {
    const length = Math.sqrt(x * x + y * y + z * z);

    if (length === 0) {
      return this.identity();
    }

    const ux = x / length;
    const uy = y / length;
    const uz = z / length;
    const radians = degrees * DEGREES_TO_RADIANS;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const t = 1 - cos;

    return [
      [t * ux * ux + cos, t * ux * uy - sin * uz, t * ux * uz + sin * uy, 0],
      [t * ux * uy + sin * uz, t * uy * uy + cos, t * uy * uz - sin * ux, 0],
      [t * ux * uz - sin * uy, t * uy * uz + sin * ux, t * uz * uz + cos, 0],
      [0, 0, 0, 1],
    ];
  }

  // The starting point for an accumulated rotation: a turntable that composes a
  // fixed delta every frame has to begin somewhere, and "no rotation yet" is a
  // matrix rather than three angles.
  public identity(): number[][] {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  // Uniform on all three axes, which is what the SCALE row means and all the
  // console offers. A non-uniform scale would not commute with the rotations it
  // composes with, so the order of the product would stop being free and the
  // bounding radius would stop being one number — neither is worth having for a
  // control nothing asks for.
  public scaleMatrix(factor: number): number[][] {
    return [
      [factor, 0, 0, 0],
      [0, factor, 0, 0],
      [0, 0, factor, 0],
      [0, 0, 0, 1],
    ];
  }

  // Column 3, which is the column Point3D.setFromSource already reads. A 4x4 is
  // otherwise more matrix than three rotations need; carrying the translation is
  // what earns the fourth row and column.
  public translation(x: number, y: number, z: number): number[][] {
    return [
      [1, 0, 0, x],
      [0, 1, 0, y],
      [0, 0, 1, z],
      [0, 0, 0, 1],
    ];
  }

  // `a` then `b`, in the order the maths is written: multiply(roll, pitch) is
  // the matrix that pitches first and rolls the result.
  public multiply(a: number[][], b: number[][]): number[][] {
    return a.map((row) =>
      COLUMNS.map(
        (column) => row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column] + row[3] * b[3][column],
      ),
    );
  }
}

export default Matrix3D;
