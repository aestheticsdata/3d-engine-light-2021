import { triangle, addTexturedQuadSubdiv } from "@data/builder";

export interface Object3D {
  points: number[][];
  triangles: triangle[];
}

export interface Data3D {
  [k: string]: Object3D;
}

// ///////////////////////////////////////////////////////////////////////////
// SPHERE
const SPHERE_RADIUS = 100;
const LAT_SEGMENTS = 6;
const LON_SEGMENTS = 8;

const spherePoints: number[][] = [];
const sphereTriangles: triangle[] = [];

for (let lat = 0; lat <= LAT_SEGMENTS; lat++) {
  const theta = (lat * Math.PI) / LAT_SEGMENTS;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  for (let lon = 0; lon <= LON_SEGMENTS; lon++) {
    const phi = (lon * 2 * Math.PI) / LON_SEGMENTS;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = SPHERE_RADIUS * sinTheta * cosPhi;
    const y = SPHERE_RADIUS * cosTheta;
    const z = SPHERE_RADIUS * sinTheta * sinPhi;

    spherePoints.push([x, y, z]);
  }
}

for (let lat = 0; lat < LAT_SEGMENTS; lat++) {
  for (let lon = 0; lon < LON_SEGMENTS; lon++) {
    const first = lat * (LON_SEGMENTS + 1) + lon;
    const second = first + LON_SEGMENTS + 1;

    const isRed = (lat + lon) % 2 === 0;
    const color = isRed ? "rgba(220,30,30,1)" : "rgba(255,255,255,1)";

    sphereTriangles.push([first, second, first + 1, color]);
    sphereTriangles.push([second, second + 1, first + 1, color]);
  }
}
// ///////////////////////////////////////////////////////////////////////////

// ///////////////////////////////////////////////////////////////////////////
// DONUT / TORUS
const TORUS_RADIUS = 80;
const TUBE_RADIUS = 30;
const TORUS_LAT_SEGMENTS = 40;
const TORUS_LON_SEGMENTS = 20;

const donutPoints: number[][] = [];
const donutTriangles: triangle[] = [];

for (let lat = 0; lat <= TORUS_LAT_SEGMENTS; lat++) {
  const theta = (lat * 2 * Math.PI) / TORUS_LAT_SEGMENTS;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  for (let lon = 0; lon <= TORUS_LON_SEGMENTS; lon++) {
    const phi = (lon * 2 * Math.PI) / TORUS_LON_SEGMENTS;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * cosTheta;
    const y = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * sinTheta;
    const z = TUBE_RADIUS * sinPhi;

    donutPoints.push([x, y, z]);
  }
}

for (let lat = 0; lat < TORUS_LAT_SEGMENTS; lat++) {
  for (let lon = 0; lon < TORUS_LON_SEGMENTS; lon++) {
    const first = lat * (TORUS_LON_SEGMENTS + 1) + lon;
    const second = first + TORUS_LON_SEGMENTS + 1;

    const isGreen = (lat + lon) % 2 === 0;
    const color = isGreen ? "rgba(100, 194, 166,1)" : "rgba(170, 222, 167,1)";

    donutTriangles.push([first, first + 1, second, color]);
    donutTriangles.push([second, first + 1, second + 1, color]);
  }
}
// ///////////////////////////////////////////////////////////////////////////

// ///////////////////////////////////////////////////////////////////////////
// CROSS
const crossPoints: number[][] = [];
const crossTriangles: triangle[] = [];

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
  crossBasePoints.forEach((p) => crossPoints.push([p[0], p[1], z]));
});

const addQuad = (
  tris: triangle[],
  p1: number,
  p2: number,
  p3: number,
  p4: number,
  color: string,
) => {
  tris.push([p1, p2, p3, color]);
  tris.push([p1, p3, p4, color]);
};

const blue = "rgba(0,89,150,1)";
const green = "rgba(0,180,89,1)";

addQuad(crossTriangles, 0, 1, 2, 3, blue);
addQuad(crossTriangles, 4, 5, 1, 0, blue);
addQuad(crossTriangles, 1, 6, 7, 2, blue);
addQuad(crossTriangles, 3, 2, 8, 9, blue);
addQuad(crossTriangles, 11, 0, 3, 10, blue);

addQuad(crossTriangles, 12, 15, 14, 13, blue);
addQuad(crossTriangles, 16, 12, 13, 17, blue);
addQuad(crossTriangles, 13, 14, 19, 18, blue);
addQuad(crossTriangles, 15, 21, 20, 14, blue);
addQuad(crossTriangles, 23, 22, 15, 12, blue);

const crossOutline = [4, 5, 1, 6, 7, 2, 8, 9, 3, 10, 11, 0];
for (let i = 0; i < crossOutline.length; i++) {
  const u = crossOutline[i];
  const v = crossOutline[(i + 1) % crossOutline.length];

  // fixed winding
  addQuad(crossTriangles, u, u + 12, v + 12, v, green);
}
// ///////////////////////////////////////////////////////////////////////////

const data: Data3D = {
  sphere: {
    points: spherePoints,
    triangles: sphereTriangles,
  },
  cube: (() => {
    const points: number[][] = [
      [-100, -100, -100], // 0
      [100, -100, -100], // 1
      [100, 100, -100], // 2
      [-100, 100, -100], // 3
      [-100, -100, 100], // 4
      [100, -100, 100], // 5
      [100, 100, 100], // 6
      [-100, 100, 100], // 7
    ];

    const YELLOW = "rgba(255, 230, 0, 1)"; // bright yellow
    const LIGHT_GREEN = "rgba(150, 255, 180, 1)"; // light green
    const LIGHT_BLUE = "rgba(130, 200, 255, 1)"; // light blue
    const PINK = "rgba(255, 120, 200, 1)"; // pink

    const triangles: triangle[] = [
      // 4 flat-color faces (each face = 2 triangles)
      [0, 5, 1, YELLOW],
      [5, 0, 4, YELLOW],

      [4, 6, 5, LIGHT_GREEN],
      [6, 4, 7, LIGHT_GREEN],

      [3, 2, 6, LIGHT_BLUE],
      [6, 7, 3, LIGHT_BLUE],

      [4, 0, 3, PINK],
      [3, 7, 4, PINK],
    ];

    // TEXTURED FACE 1: -Z (back) quad = 0-1-2-3 (galaxy)
    addTexturedQuadSubdiv({
      points,
      triangles,
      tex: "galaxy",
      grid: 14,
      p00: points[0],
      p10: points[1],
      p11: points[2],
      p01: points[3],
      // matches your old triangles [0,1,2] [2,3,0]
      flipWinding: false,
    });

    // TEXTURED FACE 2: +X (right) quad = 1-5-6-2 (dog)
    addTexturedQuadSubdiv({
      points,
      triangles,
      tex: "dog",
      grid: 14,
      p00: points[1],
      p10: points[5],
      p11: points[6],
      p01: points[2],
      // matches your old triangles [1,5,6] [6,2,1]
      flipWinding: false,
    });

    return { points, triangles };
  })(),
  pyramid: {
    points: [
      [0, -100, 0],
      [100, 100, -100],
      [-100, 100, -100],
      [-100, 100, 100],
      [100, 100, 100],
    ],
    triangles: [
      [0, 1, 2, "rgba(255,255,127,1)"],
      [0, 2, 3, "rgba((0,255,127,1)"],
      [0, 3, 4, "rgba(66,66,127,1)"],
      [0, 4, 1, "rgba(66,0,27,1)"],
      [1, 3, 2, "rgba(120,66,32,1)"],
      [1, 4, 3, "rgba(120,66,32,1)"],
    ],
  },
  cross: {
    points: crossPoints,
    triangles: crossTriangles,
  },
  donut: {
    points: donutPoints,
    triangles: donutTriangles,
  },
};

export default data;
