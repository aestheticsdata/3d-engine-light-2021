// type triangle = [number, number, number, string];

// export interface Object3D {
//   points: number[][];
//   triangles: triangle[];
// }

// export interface Data3D {
//   [k: string]: Object3D;
// }

// // ///////////////////////////////////////////////////////////////////////////
// // ChatGPT https://chatgpt.com/share/693f2c7e-3b98-8013-9509-709594c022c4 ///
// const SPHERE_RADIUS = 100;
// const LAT_SEGMENTS = 6;
// const LON_SEGMENTS = 8;

// const spherePoints: number[][] = [];
// const sphereTriangles: triangle[] = [];

// // points generation
// for (let lat = 0; lat <= LAT_SEGMENTS; lat++) {
//   const theta = (lat * Math.PI) / LAT_SEGMENTS;
//   const sinTheta = Math.sin(theta);
//   const cosTheta = Math.cos(theta);

//   for (let lon = 0; lon <= LON_SEGMENTS; lon++) {
//     const phi = (lon * 2 * Math.PI) / LON_SEGMENTS;
//     const sinPhi = Math.sin(phi);
//     const cosPhi = Math.cos(phi);

//     const x = SPHERE_RADIUS * sinTheta * cosPhi;
//     const y = SPHERE_RADIUS * cosTheta;
//     const z = SPHERE_RADIUS * sinTheta * sinPhi;

//     spherePoints.push([x, y, z]);
//   }
// }

// // checkerboard and triangles generation
// for (let lat = 0; lat < LAT_SEGMENTS; lat++) {
//   for (let lon = 0; lon < LON_SEGMENTS; lon++) {
//     const first = lat * (LON_SEGMENTS + 1) + lon;
//     const second = first + LON_SEGMENTS + 1;

//     const isRed = (lat + lon) % 2 === 0;
//     const color = isRed ? "rgba(220,30,30,1)" : "rgba(255,255,255,1)";

//     // triangle 1
//     sphereTriangles.push([first, second, first + 1, color]);

//     // triangle 2
//     sphereTriangles.push([second, second + 1, first + 1, color]);
//   }
// }
// // ///////////////////////////////////////////////////////////////////////////

// const TORUS_RADIUS = 80;
// const TUBE_RADIUS = 30;
// const TORUS_LAT_SEGMENTS = 40;
// const TORUS_LON_SEGMENTS = 20;

// const donutPoints: number[][] = [];
// const donutTriangles: triangle[] = [];

// // donut points generation
// for (let lat = 0; lat <= TORUS_LAT_SEGMENTS; lat++) {
//   const theta = (lat * 2 * Math.PI) / TORUS_LAT_SEGMENTS;
//   const sinTheta = Math.sin(theta);
//   const cosTheta = Math.cos(theta);

//   for (let lon = 0; lon <= TORUS_LON_SEGMENTS; lon++) {
//     const phi = (lon * 2 * Math.PI) / TORUS_LON_SEGMENTS;
//     const sinPhi = Math.sin(phi);
//     const cosPhi = Math.cos(phi);

//     const x = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * cosTheta;
//     const y = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * sinTheta;
//     const z = TUBE_RADIUS * sinPhi;

//     donutPoints.push([x, y, z]);
//   }
// }

// // donut triangles generation
// for (let lat = 0; lat < TORUS_LAT_SEGMENTS; lat++) {
//   for (let lon = 0; lon < TORUS_LON_SEGMENTS; lon++) {
//     const first = lat * (TORUS_LON_SEGMENTS + 1) + lon;
//     const second = first + TORUS_LON_SEGMENTS + 1;

//     const isGreen = (lat + lon) % 2 === 0;
//     const color = isGreen ? "rgba(100, 194, 166,1)" : "rgba(170, 222, 167,1)";

//     // triangle 1
//     donutTriangles.push([first, first + 1, second, color]);

//     // triangle 2
//     donutTriangles.push([second, first + 1, second + 1, color]);
//   }
// }

// const crossPoints: number[][] = [];
// const crossTriangles: triangle[] = [];

// // Base 2D profile points (Z will be added)
// // 0-3: Inner Square (TL, TR, BR, BL)
// // 4-5: Top Arm Tip (TL, TR)
// // 6-7: Right Arm Tip (TR, BR)
// // 8-9: Bot Arm Tip (BR, BL)
// // 10-11: Left Arm Tip (BL, TL)
// const basePoints = [
//   [-30, -30],
//   [30, -30],
//   [30, 30],
//   [-30, 30], // 0, 1, 2, 3
//   [-30, -100],
//   [30, -100], // 4, 5
//   [100, -30],
//   [100, 30], // 6, 7
//   [30, 100],
//   [-30, 100], // 8, 9
//   [-100, 30],
//   [-100, -30], // 10, 11
// ];

// // Generate 3D Points
// // 0-11: Near Face (Z = -30)
// // 12-23: Far Face (Z = 30)
// [-30, 30].forEach((z) => {
//   basePoints.forEach((p) => crossPoints.push([p[0], p[1], z]));
// });

// // Helper
// const addQuad = (
//   p1: number,
//   p2: number,
//   p3: number,
//   p4: number,
//   color: string,
// ) => {
//   crossTriangles.push([p1, p2, p3, color]);
//   crossTriangles.push([p1, p3, p4, color]);
// };

// const blue = "rgba(0,89,150,1)";
// const green = "rgba(0,180,89,1)";

// // 1. NEAR FACE (Z = -30) -> CLOCKWISE
// addQuad(0, 1, 2, 3, blue); // Center
// addQuad(4, 5, 1, 0, blue); // Top Arm
// addQuad(1, 6, 7, 2, blue); // Right Arm
// addQuad(3, 2, 8, 9, blue); // Bot Arm
// addQuad(11, 0, 3, 10, blue); // Left Arm

// // 2. FAR FACE (Z = 30) -> COUNTER-CLOCKWISE (Indices + 12)
// // To force outward normals, we reverse the order
// addQuad(12, 15, 14, 13, blue); // Center (0->3->2->1)
// addQuad(16, 12, 13, 17, blue); // Top Arm (4->0->1->5)
// addQuad(13, 14, 19, 18, blue); // Right Arm (1->2->7->6)
// addQuad(15, 21, 20, 14, blue); // Bot Arm (3->9->8->2)
// addQuad(23, 22, 15, 12, blue); // Left Arm (11->10->3->0)

// // 3. SIDES (Connecting Near to Far)
// // Outline path on base indices
// const outline = [4, 5, 1, 6, 7, 2, 8, 9, 3, 10, 11, 0];

// for (let i = 0; i < outline.length; i++) {
//   const u = outline[i];
//   const v = outline[(i + 1) % outline.length];

//   // Connect Near(u, v) to Far(v+12, u+12)
//   addQuad(u, u + 12, v + 12, v, green);
// }

// const data: Data3D = {
//   sphere: {
//     points: spherePoints,
//     triangles: sphereTriangles,
//   },
//   cube: {
//     points: [
//       [-100, -100, -100],
//       [100, -100, -100],
//       [100, 100, -100],
//       [-100, 100, -100],
//       [-100, -100, 100],
//       [100, -100, 100],
//       [100, 100, 100],
//       [-100, 100, 100],
//     ],
//     triangles: [
//       [0, 1, 2, "rgba(255,255,127,1)"],
//       [2, 3, 0, "rgba(255,255,127,1)"],
//       [0, 5, 1, "rgba(66,66,127,1)"],
//       [5, 0, 4, "rgba(66,66,127,1)"],
//       [4, 6, 5, "rgba(120,66,32,1)"],
//       [6, 4, 7, "rgba(120,66,32,1)"],
//       [3, 2, 6, "rgba(66,255,0,1)"],
//       [6, 7, 3, "rgba(66,255,0,1)"],
//       [1, 5, 6, "rgba(250,120,127,1)"],
//       [6, 2, 1, "rgba(250,120,127,1)"],
//       [4, 0, 3, "rgba(255,0,0,1)"],
//       [3, 7, 4, "rgba(255,0,0,1)"],
//     ],
//   },
//   pyramid: {
//     points: [
//       [0, -100, 0],
//       [100, 100, -100],
//       [-100, 100, -100],
//       [-100, 100, 100],
//       [100, 100, 100],
//     ],
//     triangles: [
//       [0, 1, 2, "rgba(255,255,127,1)"],
//       [0, 2, 3, "rgba(0,255,127,1)"],
//       [0, 3, 4, "rgba(66,66,127,1)"],
//       [0, 4, 1, "rgba(66,0,27,1)"],
//       [1, 3, 2, "rgba(120,66,32,1)"],
//       [1, 4, 3, "rgba(120,66,32,1)"],
//     ],
//   },
//   plate: {
//     points: [
//       [-50, -50, -50],
//       [50, -50, -50],
//       [50, 50, -50],
//       [-50, 50, -50],
//     ],
//     triangles: [
//       [0, 1, 2, "rgba(255,250,50,1)"],
//       [0, 2, 3, "rgba(255,250,50,1)"],
//       [0, 2, 1, "rgba(255,250,50,1)"],
//       [0, 3, 2, "rgba(255,250,50,1)"],
//     ],
//   },
//   cross: {
//     points: crossPoints,
//     triangles: crossTriangles,
//   },
//   donut: {
//     points: donutPoints,
//     triangles: donutTriangles,
//   },
// };

// export default data;

type triangle = [number, number, number, string];

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
  cube: {
    points: [
      [-100, -100, -100],
      [100, -100, -100],
      [100, 100, -100],
      [-100, 100, -100],
      [-100, -100, 100],
      [100, -100, 100],
      [100, 100, 100],
      [-100, 100, 100],
    ],
    triangles: [
      [0, 1, 2, "rgba(255,255,127,1)"],
      [2, 3, 0, "rgba(255,255,127,1)"],
      [0, 5, 1, "rgba(66,66,127,1)"],
      [5, 0, 4, "rgba(66,66,127,1)"],
      [4, 6, 5, "rgba(120,66,32,1)"],
      [6, 4, 7, "rgba(120,66,32,1)"],
      [3, 2, 6, "rgba(66,255,0,1)"],
      [6, 7, 3, "rgba(66,255,0,1)"],
      [1, 5, 6, "rgba(250,120,127,1)"],
      [6, 2, 1, "rgba(250,120,127,1)"],
      [4, 0, 3, "rgba(255,0,0,1)"],
      [3, 7, 4, "rgba(255,0,0,1)"],
    ],
  },
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
      [0, 2, 3, "rgba((0,255,127,1)"], // keep your original if needed
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