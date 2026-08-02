// The (p, q) knot curve, and a rotation-minimising frame at every step of it.
//
// THE FRAME PROBLEM. Sweeping a circle along a curve needs a normal at every
// step, and the obvious choice — the Frenet normal, which points along the
// curve's second derivative — spins wildly where the curve is nearly straight
// and flips outright at an inflection. The tube would twist visibly. What is
// built here instead is a rotation-minimising frame: the first normal is chosen
// arbitrarily (perpendicular to the first tangent, seeded from whichever world
// axis the tangent leans on least), and every later normal is the previous one
// carried forward by the smallest rotation that takes the previous tangent onto
// the current one. That rotation is about their cross product, by the angle
// between them, and it introduces no spin of its own.
//
// THE TWIST CLOSURE. Parallel transport around a closed loop does not come back
// to where it started — the residual angle is the loop's holonomy, and leaving
// it produces one visible seam where the last cross-section meets the first. It
// is closed by measuring the residual between the first and last normals and
// redistributing it linearly around the loop, so every cross-section absorbs an
// equal share and no single joint carries the whole error.
//
// THE THREE PHASES ARE ORDER-DEPENDENT and fail silently if reordered: the seed
// reads the first tangent, the transport loop reads the previous iteration's
// normal, and the twist correction reads the last normal the transport loop
// produced. Wrong order yields a tube that renders and is subtly twisted, which
// no type checker and no glance will catch. The geometry baseline is the only
// check that will.
//
// The two epsilons here are tuned to these specific constants and are not
// general tolerances: 1e-8 decides that two consecutive tangents are parallel
// enough to skip the rotation, and 1e-7 decides that the loop closed on its own
// and needs no twist correction at all.

import Vec3Math from "@data/builders/Vec3Math";

type Vec3 = [number, number, number];

export interface KnotPathOptions {
  p: number;
  q: number;
  majorRadius: number;
  pathRadius: number;
  segments: number;
}

export interface KnotFrame {
  center: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

class KnotPath {
  private readonly vec: Vec3Math;
  private readonly p: number;
  private readonly q: number;
  private readonly majorRadius: number;
  private readonly pathRadius: number;
  private readonly segments: number;

  constructor(options: KnotPathOptions) {
    this.vec = new Vec3Math();
    this.p = options.p;
    this.q = options.q;
    this.majorRadius = options.majorRadius;
    this.pathRadius = options.pathRadius;
    this.segments = options.segments;
  }

  public frames(): KnotFrame[] {
    const frames: KnotFrame[] = [];

    for (let i = 0; i < this.segments; i += 1) {
      const u = (i * 2 * Math.PI) / this.segments;

      frames.push({
        center: this.center(u),
        tangent: this.tangent(u),
        normal: [0, 0, 0],
        binormal: [0, 0, 0],
      });
    }

    this.seedFirstFrame(frames);
    this.transportFrames(frames);
    this.closeFrameTwist(frames);

    return frames;
  }

  // Seeded from the world axis the first tangent leans on least, so the cross
  // product that follows is never near-degenerate.
  private seedFirstFrame(frames: KnotFrame[]) {
    const tangent = frames[0].tangent;
    let initialNormal: Vec3 = [1, 0, 0];

    if (Math.abs(tangent[1]) <= Math.abs(tangent[0]) && Math.abs(tangent[1]) <= Math.abs(tangent[2])) {
      initialNormal = [0, 1, 0];
    }

    if (Math.abs(tangent[2]) <= Math.abs(tangent[0]) && Math.abs(tangent[2]) <= Math.abs(tangent[1])) {
      initialNormal = [0, 0, 1];
    }

    const seed = this.unit(this.vec.cross(tangent, initialNormal));

    frames[0].normal = this.unit(this.vec.cross(tangent, seed));
    frames[0].binormal = this.unit(this.vec.cross(tangent, frames[0].normal));
  }

  private transportFrames(frames: KnotFrame[]) {
    for (let i = 1; i < frames.length; i += 1) {
      const prevTangent = frames[i - 1].tangent;
      const tangent = frames[i].tangent;
      const axis = this.vec.cross(prevTangent, tangent);
      const axisLength = this.vec.magnitude(axis);

      let carried = frames[i - 1].normal;
      if (axisLength > 1e-8) {
        const angle = Math.atan2(axisLength, this.vec.dot(prevTangent, tangent));
        carried = this.vec.rotateAroundAxis(frames[i - 1].normal, this.vec.scale(axis, 1 / axisLength), angle);
      }

      frames[i].normal = this.unit(this.vec.sub(carried, this.vec.scale(tangent, this.vec.dot(carried, tangent))));
      frames[i].binormal = this.unit(this.vec.cross(tangent, frames[i].normal));
    }
  }

  private closeFrameTwist(frames: KnotFrame[]) {
    const last = frames.length - 1;
    // Clamped because acos is undefined a hair outside [-1, 1], and two unit
    // vectors can dot to 1.0000000000000002.
    const alignment = this.vec.dot(frames[0].normal, frames[last].normal);
    let theta = Math.acos(Math.max(-1, Math.min(1, alignment)));

    if (theta <= 1e-7) {
      return;
    }

    // acos loses the sign, so it comes back from which side of the first
    // tangent the residual rotation turns towards.
    if (this.vec.dot(frames[0].tangent, this.vec.cross(frames[0].normal, frames[last].normal)) > 0) {
      theta = -theta;
    }

    const thetaStep = theta / last;
    for (let i = 1; i < frames.length; i += 1) {
      frames[i].normal = this.unit(this.vec.rotateAroundAxis(frames[i].normal, frames[i].tangent, thetaStep * i));
      frames[i].binormal = this.unit(this.vec.cross(frames[i].tangent, frames[i].normal));
    }
  }

  private center(u: number): Vec3 {
    const pu = this.p * u;
    const qu = this.q * u;
    const ringRadius = this.majorRadius + this.pathRadius * Math.cos(qu);

    return [ringRadius * Math.cos(pu), ringRadius * Math.sin(pu), this.pathRadius * Math.sin(qu)];
  }

  private tangent(u: number): Vec3 {
    const pu = this.p * u;
    const qu = this.q * u;
    const cosPu = Math.cos(pu);
    const sinPu = Math.sin(pu);
    const cosQu = Math.cos(qu);
    const sinQu = Math.sin(qu);
    const ringRadius = this.majorRadius + this.pathRadius * cosQu;
    const ringRadiusDerivative = -this.pathRadius * this.q * sinQu;

    return this.unit([
      ringRadiusDerivative * cosPu - ringRadius * this.p * sinPu,
      ringRadiusDerivative * sinPu + ringRadius * this.p * cosPu,
      this.pathRadius * this.q * cosQu,
    ]);
  }

  // Vec3Math.normalize does three divides; this does one reciprocal and three
  // multiplies, which is what this curve has always been computed with. The two
  // disagree in the last bit, and every vertex of the tube is placed from these
  // normals — so swapping the form moves all 3960 points and the geometry
  // baseline stops matching. It is kept here, deliberately, rather than pushed
  // onto Vec3Math where a caller could pick the wrong one by accident.
  private unit(v: Vec3): Vec3 {
    const len = this.vec.magnitude(v);
    if (len < 1e-9) {
      return [0, 0, 0];
    }

    return this.vec.scale(v, 1 / len);
  }
}

export default KnotPath;
