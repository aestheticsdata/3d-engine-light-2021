type triangle = [number, number, number, string];

export interface Object3D {
  points: number[][];
  triangles: triangle[];
}

export interface Data3D {
  [k: string]: Object3D;
}

// ///////////////////////////////////////////////////////////////////////////
// ChatGPT https://chatgpt.com/share/693f2c7e-3b98-8013-9509-709594c022c4 ///
const SPHERE_RADIUS = 100;
const LAT_SEGMENTS = 6;
const LON_SEGMENTS = 8;

const spherePoints: number[][] = [];
const sphereTriangles: triangle[] = [];

// points generation
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

// checkerboard and triangles generation
for (let lat = 0; lat < LAT_SEGMENTS; lat++) {
  for (let lon = 0; lon < LON_SEGMENTS; lon++) {
    const first = lat * (LON_SEGMENTS + 1) + lon;
    const second = first + LON_SEGMENTS + 1;

    const isRed = (lat + lon) % 2 === 0;
    const color = isRed ? "rgba(220,30,30,1)" : "rgba(255,255,255,1)";

    // triangle 1
    sphereTriangles.push([first, second, first + 1, color]);

    // triangle 2
    sphereTriangles.push([second, second + 1, first + 1, color]);
  }
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
      [0, 2, 3, "rgba(0,255,127,1)"],
      [0, 3, 4, "rgba(66,66,127,1)"],
      [0, 4, 1, "rgba(66,0,27,1)"],
      [1, 3, 2, "rgba(120,66,32,1)"],
      [1, 4, 3, "rgba(120,66,32,1)"],
    ],
  },
  plate: {
    points: [
      [-50, -50, -50],
      [50, -50, -50],
      [50, 50, -50],
      [-50, 50, -50],
    ],
    triangles: [
      [0, 1, 2, "rgba(255,250,50,1)"],
      [0, 2, 3, "rgba(255,250,50,1)"],
      [0, 2, 1, "rgba(255,250,50,1)"],
      [0, 3, 2, "rgba(255,250,50,1)"],
    ],
  },
  cross: {
    points: [
      [-50, -50, -50],
      [50, -50, -50],
      [50, 50, -50],
      [-50, 50, -50],
      [-100, 0, -100],
      [50, 0, -100],
      [50, 0, 50],
      [-50, 0, 50],
    ],
    triangles: [
      [0, 1, 2, "rgba(0,89,150,1)"],
      [0, 2, 3, "rgba(0,89,150,1)"],
      [4, 5, 6, "rgba(0,89,0,1)"],
      [4, 6, 7, "rgba(0,89,0,1)"],
      [0, 2, 1, "rgba(0,89,150,1)"],
      [0, 3, 2, "rgba(0,89,150,1)"],
      [4, 6, 5, "rgba(0,89,0,1)"],
      [4, 7, 6, "rgba(0,89,0,1)"],
    ],
  },
};

export default data;
