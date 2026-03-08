import { triangle } from "@data/builder";
import { Object3D } from "@data/types";

const TORUS_RADIUS = 80;
const TUBE_RADIUS = 30;
const TORUS_LAT_SEGMENTS = 40;
const TORUS_LON_SEGMENTS = 20;

const points: number[][] = [];
const triangles: triangle[] = [];

for (let lat = 0; lat <= TORUS_LAT_SEGMENTS; lat += 1) {
  const theta = (lat * 2 * Math.PI) / TORUS_LAT_SEGMENTS;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  for (let lon = 0; lon <= TORUS_LON_SEGMENTS; lon += 1) {
    const phi = (lon * 2 * Math.PI) / TORUS_LON_SEGMENTS;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * cosTheta;
    const y = (TORUS_RADIUS + TUBE_RADIUS * cosPhi) * sinTheta;
    const z = TUBE_RADIUS * sinPhi;

    points.push([x, y, z]);
  }
}

for (let lat = 0; lat < TORUS_LAT_SEGMENTS; lat += 1) {
  for (let lon = 0; lon < TORUS_LON_SEGMENTS; lon += 1) {
    const first = lat * (TORUS_LON_SEGMENTS + 1) + lon;
    const second = first + TORUS_LON_SEGMENTS + 1;
    const color =
      (lat + lon) % 2 === 0
        ? "rgba(100, 194, 166,1)"
        : "rgba(170, 222, 167,1)";

    triangles.push([first, first + 1, second, color]);
    triangles.push([second, first + 1, second + 1, color]);
  }
}

const donut: Object3D = { points, triangles };

export default donut;
