// A UV sphere: a stack of latitude rings, each ring closed by a duplicate
// seam vertex so the checker colouring never has to wrap an index.
//
// The seam is why the point count is (lat+1) x (lon+1) rather than the smaller
// figure a shared seam would give. Sharing it would save 11 points and force
// every face in the last column to modulo its index, which is the trade the
// original made and this conversion keeps.
//
// `origin` and `fill` are the molecule epic's (HAL-155): an atom's ball is this
// same sphere built somewhere other than the world centre in one flat colour,
// and a second sphere construction next door is how the two would drift the
// first time one of them was tuned. Both default to today's behaviour — the
// world centre, the checker.

import MeshBuilder from "@data/builders/MeshBuilder";

import type { Object3D } from "@data/types";

const DEFAULT_RADIUS = 100;
const DEFAULT_LAT_SEGMENTS = 10;
const LON_SEGMENTS_OFFSET = 2;

const DARK_CELL = "rgba(220,30,30,1)";
const LIGHT_CELL = "rgba(255,255,255,1)";

export interface SphereOptions {
  radius?: number;
  latSegments?: number;
  lonSegments?: number;
  origin?: [number, number, number];
  fill?: string;
}

class SphereGenerator {
  private readonly builder: MeshBuilder;
  private readonly radius: number;
  private readonly latSegments: number;
  private readonly lonSegments: number;
  private readonly origin: [number, number, number] | null;
  private readonly fill: string | null;

  constructor(options: SphereOptions = {}) {
    this.builder = new MeshBuilder();
    this.radius = options.radius ?? DEFAULT_RADIUS;
    this.latSegments = options.latSegments ?? DEFAULT_LAT_SEGMENTS;
    this.lonSegments = options.lonSegments ?? this.latSegments + LON_SEGMENTS_OFFSET;
    this.origin = options.origin ?? null;
    this.fill = options.fill ?? null;
  }

  public build(): Object3D {
    this.addVertices();
    this.addFaces();

    return this.builder.mesh;
  }

  private addVertices() {
    for (let lat = 0; lat <= this.latSegments; lat += 1) {
      const theta = (lat * Math.PI) / this.latSegments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= this.lonSegments; lon += 1) {
        const phi = (lon * 2 * Math.PI) / this.lonSegments;
        const x = this.radius * sinTheta * Math.cos(phi);
        const y = this.radius * cosTheta;
        const z = this.radius * sinTheta * Math.sin(phi);

        // The origin is a branch, not an unconditional + 0: adding zero is not
        // guaranteed to reproduce the same float (-0 alone breaks it), and the
        // default path must stay byte-identical in the geometry baseline.
        if (this.origin === null) {
          this.builder.addPoint([x, y, z]);
        } else {
          this.builder.addPoint([x + this.origin[0], y + this.origin[1], z + this.origin[2]]);
        }
      }
    }
  }

  private addFaces() {
    for (let lat = 0; lat < this.latSegments; lat += 1) {
      for (let lon = 0; lon < this.lonSegments; lon += 1) {
        const first = lat * (this.lonSegments + 1) + lon;
        const second = first + this.lonSegments + 1;
        // The checker stays the primary form — it is the demo sphere's
        // identity — and `fill` opts out of it rather than replacing it.
        const checker = (lat + lon) % 2 === 0 ? DARK_CELL : LIGHT_CELL;
        const color = this.fill === null ? checker : this.fill;

        this.builder.addTriangle([first, second, first + 1, color]);
        this.builder.addTriangle([second, second + 1, first + 1, color]);
      }
    }
  }
}

export default SphereGenerator;
