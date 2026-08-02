// A cross, extruded: one twelve-point plane profile stamped at two depths, the
// two copies capped, and the outline walked once to close the side walls.
//
// The two things here that look like tidying targets and are not:
//
// The ten cap quads were wound by eye against the back-face cull, and the back
// layer's five are NOT the front layer's five plus an offset — look at the
// first pair, [0,1,2,3] against [12,15,14,13]. Rewriting them as a derived list
// flips faces inside-out, and the only tell is a visual one.
//
// LAYER_STRIDE is the literal 12, not PROFILE.length. It means "the second
// extrusion layer starts here", which happens to equal the profile length; a
// derived value would keep working for the wrong reason if the profile ever
// gained a point.

import MeshBuilder from "@data/builders/MeshBuilder";

import type { Object3D } from "@data/types";

const PROFILE: number[][] = [
  [-30, -30],
  [30, -30],
  [30, 30],
  [-30, 30],
  [-30, -100],
  [30, -100],
  [100, -30],
  [100, 30],
  [30, 100],
  [-30, 100],
  [-100, 30],
  [-100, -30],
];

const DEPTHS = [-30, 30];
const LAYER_STRIDE = 12;

const CAP_COLOR = "rgba(0,89,150,1)";
const WALL_COLOR = "rgba(0,180,89,1)";

const CAP_QUADS: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 1, 0],
  [1, 6, 7, 2],
  [3, 2, 8, 9],
  [11, 0, 3, 10],
  [12, 15, 14, 13],
  [16, 12, 13, 17],
  [13, 14, 19, 18],
  [15, 21, 20, 14],
  [23, 22, 15, 12],
];

// The twelve outer corners in order around the silhouette, so each consecutive
// pair is one side wall.
const OUTLINE = [4, 5, 1, 6, 7, 2, 8, 9, 3, 10, 11, 0];

class CrossGenerator {
  private readonly builder: MeshBuilder;

  constructor() {
    this.builder = new MeshBuilder();
  }

  public build(): Object3D {
    this.extrudeProfile();
    this.addCaps();
    this.addSideWalls();

    return this.builder.mesh;
  }

  private extrudeProfile() {
    DEPTHS.forEach((z) => {
      PROFILE.forEach((point) => {
        this.builder.addPoint([point[0], point[1], z]);
      });
    });
  }

  private addCaps() {
    CAP_QUADS.forEach((quad) => {
      this.builder.addQuadByIndices(quad[0], quad[1], quad[2], quad[3], CAP_COLOR);
    });
  }

  private addSideWalls() {
    OUTLINE.forEach((near, i) => {
      const next = OUTLINE[(i + 1) % OUTLINE.length];

      this.builder.addQuadByIndices(near, near + LAYER_STRIDE, next + LAYER_STRIDE, next, WALL_COLOR);
    });
  }
}

export default CrossGenerator;
