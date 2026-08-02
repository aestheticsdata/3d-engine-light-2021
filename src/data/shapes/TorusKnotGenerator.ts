// A (p, q) torus knot, swept as a tube.
//
// The curve and the frame it carries are KnotPath's; what is left here is the
// sweep — a ring of vertices around each frame, and a quad between consecutive
// rings. It splits there because the frame construction is the hard, subtle half
// and the sweep is the mechanical one, and because past the length rule this is
// the seam that does not cut through anything.
//
// Winding is decided per triangle against the tube's outward direction rather
// than assumed from the index pattern: the knot passes over itself, so a fixed
// pattern gets it wrong on the crossings.

import MeshBuilder from "@data/builders/MeshBuilder";
import Vec3Math from "@data/builders/Vec3Math";
import type { KnotFrame } from "@data/shapes/KnotPath";
import KnotPath from "@data/shapes/KnotPath";
import type { Object3D } from "@data/types";

type Vec3 = [number, number, number];

const DEFAULT_P = 2;
const DEFAULT_Q = 3;
const DEFAULT_MAJOR_RADIUS = 74;
const DEFAULT_PATH_RADIUS = 28;
const DEFAULT_TUBE_RADIUS = 14;
const DEFAULT_PATH_SEGMENTS = 220;
const DEFAULT_TUBE_SEGMENTS = 18;

const LIGHT_CELL = "rgba(144,213,255,1)";
const DARK_CELL = "rgba(255, 0, 102,1)";

export interface TorusKnotOptions {
  p?: number;
  q?: number;
  majorRadius?: number;
  pathRadius?: number;
  tubeRadius?: number;
  pathSegments?: number;
  tubeSegments?: number;
}

class TorusKnotGenerator {
  private readonly builder: MeshBuilder;
  private readonly vec: Vec3Math;
  private readonly path: KnotPath;
  private readonly tubeRadius: number;
  private readonly tubeSegments: number;

  constructor(options: TorusKnotOptions = {}) {
    this.builder = new MeshBuilder();
    this.vec = new Vec3Math();
    this.path = new KnotPath({
      p: options.p ?? DEFAULT_P,
      q: options.q ?? DEFAULT_Q,
      majorRadius: options.majorRadius ?? DEFAULT_MAJOR_RADIUS,
      pathRadius: options.pathRadius ?? DEFAULT_PATH_RADIUS,
      segments: options.pathSegments ?? DEFAULT_PATH_SEGMENTS,
    });
    this.tubeRadius = options.tubeRadius ?? DEFAULT_TUBE_RADIUS;
    this.tubeSegments = options.tubeSegments ?? DEFAULT_TUBE_SEGMENTS;
  }

  public build(): Object3D {
    const frames = this.path.frames();

    this.addTubeVertices(frames);
    this.addTubeFaces(frames);

    return this.builder.mesh;
  }

  private addTubeVertices(frames: KnotFrame[]) {
    frames.forEach((frame) => {
      for (let tube = 0; tube < this.tubeSegments; tube += 1) {
        const v = (tube * 2 * Math.PI) / this.tubeSegments;
        const radial = this.vec.add(
          this.vec.scale(frame.normal, Math.cos(v) * this.tubeRadius),
          this.vec.scale(frame.binormal, Math.sin(v) * this.tubeRadius),
        );
        const point = this.vec.add(frame.center, radial);

        this.builder.addPoint([point[0], point[1], point[2]]);
      }
    });
  }

  private addTubeFaces(frames: KnotFrame[]) {
    for (let path = 0; path < frames.length; path += 1) {
      const nextPath = (path + 1) % frames.length;

      for (let tube = 0; tube < this.tubeSegments; tube += 1) {
        const nextTube = (tube + 1) % this.tubeSegments;

        const a = this.pointIndex(path, tube);
        const b = this.pointIndex(nextPath, tube);
        const c = this.pointIndex(path, nextTube);
        const d = this.pointIndex(nextPath, nextTube);
        const color = (path + tube) % 2 === 0 ? LIGHT_CELL : DARK_CELL;

        // The sum of the quad's four spokes, each measured from the centre of
        // the ring its corner belongs to. Left as one nested expression rather
        // than a reduce: floating-point addition is not associative, and the
        // sign of a dot product against this vector is what decides the
        // winding a few lines down.
        const outward = this.vec.normalize(
          this.vec.add(
            this.vec.add(
              this.vec.sub(this.pointAsVec(a), frames[path].center),
              this.vec.sub(this.pointAsVec(b), frames[nextPath].center),
            ),
            this.vec.add(
              this.vec.sub(this.pointAsVec(c), frames[path].center),
              this.vec.sub(this.pointAsVec(d), frames[nextPath].center),
            ),
          ),
        );

        this.addOrientedTriangle(a, b, c, outward, color);
        this.addOrientedTriangle(c, b, d, outward, color);
      }
    }
  }

  private addOrientedTriangle(
    a: number,
    b: number,
    c: number,
    outward: Vec3,
    color: string,
  ) {
    const faceNormal = this.vec.cross(
      this.vec.sub(this.pointAsVec(b), this.pointAsVec(a)),
      this.vec.sub(this.pointAsVec(c), this.pointAsVec(a)),
    );

    if (this.vec.dot(faceNormal, outward) <= 0) {
      this.builder.addTriangle([a, b, c, color]);
      return;
    }

    this.builder.addTriangle([a, c, b, color]);
  }

  private pointIndex(path: number, tube: number): number {
    return path * this.tubeSegments + tube;
  }

  private pointAsVec(index: number): Vec3 {
    const point = this.builder.pointAt(index);

    return [point[0], point[1], point[2]];
  }
}

export default TorusKnotGenerator;
