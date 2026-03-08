import { addTexturedQuadSubdiv, triangle } from "@data/builder";
import { Object3D } from "@data/types";

const points: number[][] = [
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

const triangles: triangle[] = [
  [0, 5, 1, YELLOW],
  [5, 0, 4, YELLOW],
  [4, 6, 5, LIGHT_GREEN],
  [6, 4, 7, LIGHT_GREEN],
  [3, 2, 6, LIGHT_BLUE],
  [6, 7, 3, LIGHT_BLUE],
  [4, 0, 3, PINK],
  [3, 7, 4, PINK],
];

addTexturedQuadSubdiv({
  points,
  triangles,
  tex: "galaxy",
  grid: 14,
  p00: points[0],
  p10: points[1],
  p11: points[2],
  p01: points[3],
  flipWinding: false,
});

addTexturedQuadSubdiv({
  points,
  triangles,
  tex: "dog",
  grid: 14,
  p00: points[1],
  p10: points[5],
  p11: points[6],
  p01: points[2],
  flipWinding: false,
});

const cube: Object3D = { points, triangles };

export default cube;
