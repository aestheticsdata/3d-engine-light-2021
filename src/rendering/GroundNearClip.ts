// Trimming the ground to the near plane, in the ground's own coordinates.
//
// This exists because the plane rotates now. While the camera looked straight
// down the z axis, "near" was a world z and every caller could iterate from it;
// once the camera can turn, a cell's near edge in world space is nowhere near
// its near edge in front of the eye, and a quad straddling the plane projects
// with a negative denominator on one corner. That corner lands mirrored across
// the render-target centre and the fill smears over the whole canvas.
//
// Clipping in (x, z) rather than in screen space is the point. The projection
// is a divide, so lerping two already-projected endpoints does not interpolate
// the same line — it is exactly the fault the near plane exists to prevent.
// GroundProjection.depthAt is affine over (x, z), so the crossing parameter is
// exact and no subdivision is needed.
//
// Dropping the offending geometry instead of trimming it is not an option: the
// cells nearest the eye are the largest on screen, so a dropped one is a hole
// across the foreground rather than a missing detail.

import type GroundProjection from "@rendering/GroundProjection";

export interface GroundVertex {
  x: number;
  z: number;
}

class GroundNearClip {
  private readonly ground: GroundProjection;

  constructor(ground: GroundProjection) {
    this.ground = ground;
  }

  // Null when the whole segment is behind the plane, which a caller skips
  // rather than draws.
  public segment(from: GroundVertex, to: GroundVertex): [GroundVertex, GroundVertex] | null {
    const near = this.ground.nearDepth;
    const fromDepth = this.ground.depthAt(from.x, from.z);
    const toDepth = this.ground.depthAt(to.x, to.z);
    const fromInside = fromDepth >= near;
    const toInside = toDepth >= near;

    if (fromInside && toInside) {
      return [from, to];
    }

    if (!fromInside && !toInside) {
      return null;
    }

    const crossing = this.crossing(from, to, fromDepth, toDepth, near);

    return fromInside ? [from, crossing] : [crossing, to];
  }

  // Sutherland–Hodgman against the single near half-plane. A convex quad stays
  // convex and gains at most one vertex, so the caller can keep filling a simple
  // path without a tessellator.
  public polygon(corners: GroundVertex[]): GroundVertex[] {
    const near = this.ground.nearDepth;
    const depths = corners.map((corner) => this.ground.depthAt(corner.x, corner.z));
    const clipped: GroundVertex[] = [];

    for (let index = 0; index < corners.length; index += 1) {
      const next = (index + 1) % corners.length;
      const currentInside = depths[index] >= near;
      const nextInside = depths[next] >= near;

      if (currentInside) {
        clipped.push(corners[index]);
      }

      if (currentInside !== nextInside) {
        clipped.push(this.crossing(corners[index], corners[next], depths[index], depths[next], near));
      }
    }

    return clipped;
  }

  private crossing(
    from: GroundVertex,
    to: GroundVertex,
    fromDepth: number,
    toDepth: number,
    near: number,
  ): GroundVertex {
    const span = toDepth - fromDepth;
    // Both ends at the same depth cannot straddle the plane, so this only
    // guards the plan-view pose where the whole sheet sits at one depth.
    const t = span === 0 ? 0 : (near - fromDepth) / span;

    return {
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
    };
  }
}

export default GroundNearClip;
