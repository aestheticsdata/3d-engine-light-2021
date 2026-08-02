// A Menger sponge, at level 2.
//
// THE SOLID-CELL PREDICATE. The sponge is defined by repeated subdivision: cut
// the cube into 27, remove the six face centres and the body centre, recurse
// into what is left. Rather than recursing, a cell is tested directly — write
// its integer coordinates in base 3, and the cell is removed exactly when some
// digit position has two or more coordinates equal to 1. Two middles means the
// cell sits in the middle of a face; three means the body centre. The loop
// walks the digits from least to most significant, and a single hit anywhere in
// the ladder is enough to remove the cell.
//
// THE FACE-CULLING RULE. A face is emitted only where a solid cell meets empty
// space, so the sponge's interior tunnels are surfaced but the seams between
// two touching solid cells are not. Out-of-range neighbours are absent from the
// set, which is what makes the outer boundary emit without a special case.
//
// NO VERTEX SHARING, deliberately. Every quad appends four fresh points, so two
// cells that share an edge do not share its vertices — 4224 points for 2112
// triangles. Deduplicating them would be a visible change: the SHAPE INFO panel
// prints the point count.

import MeshBuilder from "@data/builders/MeshBuilder";

import type { Object3D } from "@data/types";

const DEFAULT_LEVEL = 2;
const DEFAULT_TOTAL_SIZE = 210;

// Each face's two tones, [even, odd] by the cell's checker parity.
const POS_X = ["rgba(255, 149, 76,1)", "rgba(255, 178, 102,1)"];
const NEG_X = ["rgba(245, 87, 108,1)", "rgba(255, 126, 95,1)"];
const POS_Y = ["rgba(139, 92, 246,1)", "rgba(167, 139, 250,1)"];
const NEG_Y = ["rgba(45, 212, 191,1)", "rgba(94, 234, 212,1)"];
const POS_Z = ["rgba(56, 189, 248,1)", "rgba(125, 211, 252,1)"];
const NEG_Z = ["rgba(74, 222, 128,1)", "rgba(134, 239, 172,1)"];

export interface MengerOptions {
  level?: number;
  totalSize?: number;
}

interface CellFace {
  neighbour: number[];
  corners: number[][];
  color: string;
}

class MengerSpongeGenerator {
  private readonly builder: MeshBuilder;
  private readonly solids: Set<string>;
  private readonly level: number;
  private readonly divisions: number;
  private readonly cellSize: number;
  private readonly halfSize: number;

  constructor(options: MengerOptions = {}) {
    this.builder = new MeshBuilder();
    this.solids = new Set();
    this.level = options.level ?? DEFAULT_LEVEL;

    const totalSize = options.totalSize ?? DEFAULT_TOTAL_SIZE;
    this.divisions = 3 ** this.level;
    this.cellSize = totalSize / this.divisions;
    this.halfSize = totalSize / 2;
  }

  public build(): Object3D {
    this.collectSolidCells();
    this.emitFaces();

    return this.builder.mesh;
  }

  private collectSolidCells() {
    for (let x = 0; x < this.divisions; x += 1) {
      for (let y = 0; y < this.divisions; y += 1) {
        for (let z = 0; z < this.divisions; z += 1) {
          if (this.isSolidCell(x, y, z)) {
            this.solids.add(this.keyOf(x, y, z));
          }
        }
      }
    }
  }

  private emitFaces() {
    for (let x = 0; x < this.divisions; x += 1) {
      for (let y = 0; y < this.divisions; y += 1) {
        for (let z = 0; z < this.divisions; z += 1) {
          if (!this.solids.has(this.keyOf(x, y, z))) {
            continue;
          }

          this.facesOf(x, y, z).forEach((face) => {
            this.addFaceIfExposed(x, y, z, face);
          });
        }
      }
    }
  }

  private addFaceIfExposed(x: number, y: number, z: number, face: CellFace) {
    const [dx, dy, dz] = face.neighbour;

    if (!this.solids.has(this.keyOf(x + dx, y + dy, z + dz))) {
      this.builder.addQuadByCoords(face.corners[0], face.corners[1], face.corners[2], face.corners[3], face.color);
    }
  }

  // Six near-identical branches collapsed into one table. Each row is the
  // neighbour that hides this face, the four corners in winding order, and the
  // colour — the only three things the branches ever differed by.
  private facesOf(x: number, y: number, z: number): CellFace[] {
    const x0 = -this.halfSize + x * this.cellSize;
    const y0 = -this.halfSize + y * this.cellSize;
    const z0 = -this.halfSize + z * this.cellSize;
    const x1 = x0 + this.cellSize;
    const y1 = y0 + this.cellSize;
    const z1 = z0 + this.cellSize;
    const checker = (x + y + z) % 2;

    return [
      {
        neighbour: [1, 0, 0],
        corners: [
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ],
        color: POS_X[checker],
      },
      {
        neighbour: [-1, 0, 0],
        corners: [
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
          [x0, y0, z0],
        ],
        color: NEG_X[checker],
      },
      {
        neighbour: [0, 1, 0],
        corners: [
          [x0, y1, z0],
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
        ],
        color: POS_Y[checker],
      },
      {
        neighbour: [0, -1, 0],
        corners: [
          [x0, y0, z1],
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
        ],
        color: NEG_Y[checker],
      },
      {
        neighbour: [0, 0, 1],
        corners: [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        color: POS_Z[checker],
      },
      {
        neighbour: [0, 0, -1],
        corners: [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
        color: NEG_Z[checker],
      },
    ];
  }

  private isSolidCell(x: number, y: number, z: number): boolean {
    let cx = x;
    let cy = y;
    let cz = z;

    for (let level = 0; level < this.level; level += 1) {
      const xMid = cx % 3 === 1;
      const yMid = cy % 3 === 1;
      const zMid = cz % 3 === 1;

      if ((xMid && yMid) || (xMid && zMid) || (yMid && zMid)) {
        return false;
      }

      cx = Math.floor(cx / 3);
      cy = Math.floor(cy / 3);
      cz = Math.floor(cz / 3);
    }

    return true;
  }

  private keyOf(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
}

export default MengerSpongeGenerator;
