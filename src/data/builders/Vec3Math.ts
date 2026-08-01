// Tuple vector math, as a stateless collaborator.
//
// It stays TUPLE math and does not become an immutable Vec3 value class. The
// torus knot's tube loop runs 220 x 18 and calls through here several times per
// vertex; a value class would put on the order of 10^5 short-lived objects on
// the heap to compute a shape that never changes after import.
//
// It exists because the same three-term dot product had been written out five
// times across this folder, and a sign error in any one of them produces a solid
// that still renders.

type Vec3 = [number, number, number];

class Vec3Math {
  public add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  public sub(a: number[], b: number[]): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  public scale(v: Vec3, factor: number): Vec3 {
    return [v[0] * factor, v[1] * factor, v[2] * factor];
  }

  public dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  public cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  public magnitude(v: Vec3): number {
    return Math.hypot(v[0], v[1], v[2]);
  }

  // Returns the zero vector rather than dividing by a length that rounds to
  // zero. Every caller here treats a zero result as "no direction", which is the
  // honest answer for a degenerate input.
  //
  // It divides three times rather than multiplying by one reciprocal, and that
  // is not a style choice. The two disagree in the last bit, and the truncated
  // cuboctahedron's octagons sit close enough to the winding test's threshold
  // that the reciprocal form flips two of them inside-out. The geometry baseline
  // is what caught it.
  public normalize(v: Vec3): Vec3 {
    const len = this.magnitude(v);
    if (len < 1e-9) {
      return [0, 0, 0];
    }

    return [v[0] / len, v[1] / len, v[2] / len];
  }

  public centroid(points: number[][]): Vec3 {
    const sum = points.reduce<Vec3>(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
      [0, 0, 0],
    );

    return [
      sum[0] / points.length,
      sum[1] / points.length,
      sum[2] / points.length,
    ];
  }

  // Rodrigues' rotation. The axis must already be a unit vector.
  public rotateAroundAxis(vector: Vec3, axis: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const axisDot = this.dot(axis, vector);

    return this.add(
      this.add(this.scale(vector, cos), this.scale(this.cross(axis, vector), sin)),
      this.scale(axis, axisDot * (1 - cos)),
    );
  }
}

export default Vec3Math;
