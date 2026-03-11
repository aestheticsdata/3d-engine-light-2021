import { triangle } from "@data/builder";
import { Object3D } from "@data/types";

const LEVEL = 2;
const TOTAL_SIZE = 210;
const DIVISIONS = 3 ** LEVEL;
const CELL_SIZE = TOTAL_SIZE / DIVISIONS;
const HALF_SIZE = TOTAL_SIZE / 2;

const points: number[][] = [];
const triangles: triangle[] = [];

const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

const isSolidCell = (x: number, y: number, z: number) => {
  let cx = x;
  let cy = y;
  let cz = z;

  for (let level = 0; level < LEVEL; level += 1) {
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
};

const addQuad = (
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  color: string,
) => {
  const i0 = points.push(p0) - 1;
  const i1 = points.push(p1) - 1;
  const i2 = points.push(p2) - 1;
  const i3 = points.push(p3) - 1;

  triangles.push([i0, i2, i1, color]);
  triangles.push([i0, i3, i2, color]);
};

const solids = new Set<string>();
for (let x = 0; x < DIVISIONS; x += 1) {
  for (let y = 0; y < DIVISIONS; y += 1) {
    for (let z = 0; z < DIVISIONS; z += 1) {
      if (isSolidCell(x, y, z)) {
        solids.add(keyOf(x, y, z));
      }
    }
  }
}

for (let x = 0; x < DIVISIONS; x += 1) {
  for (let y = 0; y < DIVISIONS; y += 1) {
    for (let z = 0; z < DIVISIONS; z += 1) {
      if (!solids.has(keyOf(x, y, z))) {
        continue;
      }

      const x0 = -HALF_SIZE + x * CELL_SIZE;
      const x1 = x0 + CELL_SIZE;
      const y0 = -HALF_SIZE + y * CELL_SIZE;
      const y1 = y0 + CELL_SIZE;
      const z0 = -HALF_SIZE + z * CELL_SIZE;
      const z1 = z0 + CELL_SIZE;
      const checker = (x + y + z) % 2;

      const posX = checker
        ? "rgba(255, 178, 102,1)"
        : "rgba(255, 149, 76,1)";
      const negX = checker ? "rgba(255, 126, 95,1)" : "rgba(245, 87, 108,1)";
      const posY = checker ? "rgba(167, 139, 250,1)" : "rgba(139, 92, 246,1)";
      const negY = checker ? "rgba(94, 234, 212,1)" : "rgba(45, 212, 191,1)";
      const posZ = checker ? "rgba(125, 211, 252,1)" : "rgba(56, 189, 248,1)";
      const negZ = checker ? "rgba(134, 239, 172,1)" : "rgba(74, 222, 128,1)";

      if (!solids.has(keyOf(x + 1, y, z))) {
        addQuad(
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
          posX,
        );
      }

      if (!solids.has(keyOf(x - 1, y, z))) {
        addQuad(
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
          [x0, y0, z0],
          negX,
        );
      }

      if (!solids.has(keyOf(x, y + 1, z))) {
        addQuad(
          [x0, y1, z0],
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
          posY,
        );
      }

      if (!solids.has(keyOf(x, y - 1, z))) {
        addQuad(
          [x0, y0, z1],
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          negY,
        );
      }

      if (!solids.has(keyOf(x, y, z + 1))) {
        addQuad(
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
          posZ,
        );
      }

      if (!solids.has(keyOf(x, y, z - 1))) {
        addQuad(
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
          negZ,
        );
      }
    }
  }
}

const menger: Object3D = { points, triangles };

export default menger;
