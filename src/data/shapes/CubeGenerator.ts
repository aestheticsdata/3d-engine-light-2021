// The cube: eight hand-authored corners, four flat faces, and two faces
// subdivided into a 14x14 grid so their textures do not warp.
//
// It is the one shape whose point table is written by hand and appended to, so
// it is also the proof that the accumulator preserves vertex identity: the flat
// face list below indexes points 0-7 literally, and the two grids must land
// after them or every colour lands on the wrong face.

import MeshBuilder from "@data/builders/MeshBuilder";
import { Object3D, Triangle3D } from "@data/types";

const CORNERS: number[][] = [
  [-100, -100, -100],
  [100, -100, -100],
  [100, 100, -100],
  [-100, 100, -100],
  [-100, -100, 100],
  [100, -100, 100],
  [100, 100, 100],
  [-100, 100, 100],
];

const YELLOW = "rgba(255, 230, 0, 1)";
const LIGHT_GREEN = "rgba(150, 255, 180, 1)";
const LIGHT_BLUE = "rgba(130, 200, 255, 1)";
const PINK = "rgba(255, 120, 200, 1)";

const FLAT_FACES: Triangle3D[] = [
  [0, 5, 1, YELLOW],
  [5, 0, 4, YELLOW],
  [4, 6, 5, LIGHT_GREEN],
  [6, 4, 7, LIGHT_GREEN],
  [3, 2, 6, LIGHT_BLUE],
  [6, 7, 3, LIGHT_BLUE],
  [4, 0, 3, PINK],
  [3, 7, 4, PINK],
];

// 14 rather than the builder's default 12. Finer than the default because these
// two faces carry the only bitmaps in the registry and are seen head-on.
const SUBDIVISION_GRID = 14;

class CubeGenerator {
  private readonly builder: MeshBuilder;

  constructor() {
    // Copies, not the module tables: a second generator must not append into
    // the arrays the first one was built from.
    this.builder = new MeshBuilder({
      points: CORNERS.map((corner) => [...corner]),
      triangles: [...FLAT_FACES],
    });
  }

  public build(): Object3D {
    this.addTexturedFace("galaxy", [0, 1, 2, 3]);
    this.addTexturedFace("dog", [1, 5, 6, 2]);

    return this.builder.mesh;
  }

  // The four corners are given as indices into the hand-authored table and read
  // back out of the accumulator, so the grid is interpolated between the same
  // coordinates the flat faces use.
  private addTexturedFace(tex: string, corners: number[]) {
    this.builder.addTexturedQuadSubdiv({
      tex,
      grid: SUBDIVISION_GRID,
      p00: this.builder.pointAt(corners[0]),
      p10: this.builder.pointAt(corners[1]),
      p11: this.builder.pointAt(corners[2]),
      p01: this.builder.pointAt(corners[3]),
      flipWinding: false,
    });
  }
}

export default CubeGenerator;
