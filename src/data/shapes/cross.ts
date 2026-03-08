import { triangle } from "@data/builder";
import { Object3D } from "@data/types";

const points: number[][] = [];
const triangles: triangle[] = [];

const crossBasePoints = [
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

[-30, 30].forEach((z) => {
  crossBasePoints.forEach((point) => points.push([point[0], point[1], z]));
});

const addQuad = (
  target: triangle[],
  p1: number,
  p2: number,
  p3: number,
  p4: number,
  color: string,
) => {
  target.push([p1, p2, p3, color]);
  target.push([p1, p3, p4, color]);
};

const blue = "rgba(0,89,150,1)";
const green = "rgba(0,180,89,1)";

addQuad(triangles, 0, 1, 2, 3, blue);
addQuad(triangles, 4, 5, 1, 0, blue);
addQuad(triangles, 1, 6, 7, 2, blue);
addQuad(triangles, 3, 2, 8, 9, blue);
addQuad(triangles, 11, 0, 3, 10, blue);

addQuad(triangles, 12, 15, 14, 13, blue);
addQuad(triangles, 16, 12, 13, 17, blue);
addQuad(triangles, 13, 14, 19, 18, blue);
addQuad(triangles, 15, 21, 20, 14, blue);
addQuad(triangles, 23, 22, 15, 12, blue);

const crossOutline = [4, 5, 1, 6, 7, 2, 8, 9, 3, 10, 11, 0];
for (let i = 0; i < crossOutline.length; i += 1) {
  const u = crossOutline[i];
  const v = crossOutline[(i + 1) % crossOutline.length];

  addQuad(triangles, u, u + 12, v + 12, v, green);
}

const cross: Object3D = { points, triangles };

export default cross;
