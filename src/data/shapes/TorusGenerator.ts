// A torus: a ring of tube cross-sections, each closed by a duplicate seam
// vertex, exactly like the sphere beside it.
//
// It emits the same ring-strip topology as SphereGenerator and winds it the
// OTHER WAY: the sphere pushes (first, second, first+1) where this pushes
// (first, first+1, second). Both render correctly, so the two files disagree
// about a convention neither of them states. They are deliberately not unified
// here — picking one means re-verifying both against the back-face cull, and
// nothing in the repo would notice a shape rendering inside-out.

import MeshBuilder from "@data/builders/MeshBuilder";
import { Object3D } from "@data/types";

const DEFAULT_TORUS_RADIUS = 80;
const DEFAULT_TUBE_RADIUS = 30;
const DEFAULT_LAT_SEGMENTS = 40;
const DEFAULT_LON_SEGMENTS = 20;

const DARK_CELL = "rgba(100, 194, 166,1)";
const LIGHT_CELL = "rgba(170, 222, 167,1)";

export interface TorusOptions {
  torusRadius?: number;
  tubeRadius?: number;
  latSegments?: number;
  lonSegments?: number;
}

class TorusGenerator {
  private readonly builder: MeshBuilder;
  private readonly torusRadius: number;
  private readonly tubeRadius: number;
  private readonly latSegments: number;
  private readonly lonSegments: number;

  constructor(options: TorusOptions = {}) {
    this.builder = new MeshBuilder();
    this.torusRadius = options.torusRadius ?? DEFAULT_TORUS_RADIUS;
    this.tubeRadius = options.tubeRadius ?? DEFAULT_TUBE_RADIUS;
    this.latSegments = options.latSegments ?? DEFAULT_LAT_SEGMENTS;
    this.lonSegments = options.lonSegments ?? DEFAULT_LON_SEGMENTS;
  }

  public build(): Object3D {
    this.addVertices();
    this.addFaces();

    return this.builder.mesh;
  }

  private addVertices() {
    for (let lat = 0; lat <= this.latSegments; lat += 1) {
      const theta = (lat * 2 * Math.PI) / this.latSegments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= this.lonSegments; lon += 1) {
        const phi = (lon * 2 * Math.PI) / this.lonSegments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const ringRadius = this.torusRadius + this.tubeRadius * cosPhi;

        this.builder.addPoint([
          ringRadius * cosTheta,
          ringRadius * sinTheta,
          this.tubeRadius * sinPhi,
        ]);
      }
    }
  }

  private addFaces() {
    for (let lat = 0; lat < this.latSegments; lat += 1) {
      for (let lon = 0; lon < this.lonSegments; lon += 1) {
        const first = lat * (this.lonSegments + 1) + lon;
        const second = first + this.lonSegments + 1;
        const color = this.colorFor(lat, lon);

        this.builder.addTriangle([first, first + 1, second, color]);
        this.builder.addTriangle([second, first + 1, second + 1, color]);
      }
    }
  }

  // A method rather than two literals inside the loop, which is where they were
  // and where no other shape in the folder puts them.
  private colorFor(lat: number, lon: number): string {
    return (lat + lon) % 2 === 0 ? DARK_CELL : LIGHT_CELL;
  }
}

export default TorusGenerator;
