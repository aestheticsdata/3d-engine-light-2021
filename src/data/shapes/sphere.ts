import { triangle } from "@data/builder";
import { Object3D } from "@data/types";

const SPHERE_RADIUS = 100;
const LAT_SEGMENTS = 10;
const LON_SEGMENTS = LAT_SEGMENTS + 2;

const points: number[][] = [];
const triangles: triangle[] = [];

for (let lat = 0; lat <= LAT_SEGMENTS; lat += 1) {
  const theta = (lat * Math.PI) / LAT_SEGMENTS;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  for (let lon = 0; lon <= LON_SEGMENTS; lon += 1) {
    const phi = (lon * 2 * Math.PI) / LON_SEGMENTS;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = SPHERE_RADIUS * sinTheta * cosPhi;
    const y = SPHERE_RADIUS * cosTheta;
    const z = SPHERE_RADIUS * sinTheta * sinPhi;

    points.push([x, y, z]);
  }
}

for (let lat = 0; lat < LAT_SEGMENTS; lat += 1) {
  for (let lon = 0; lon < LON_SEGMENTS; lon += 1) {
    const first = lat * (LON_SEGMENTS + 1) + lon;
    const second = first + LON_SEGMENTS + 1;
    const color =
      (lat + lon) % 2 === 0 ? "rgba(220,30,30,1)" : "rgba(255,255,255,1)";

    triangles.push([first, second, first + 1, color]);
    triangles.push([second, second + 1, first + 1, color]);
  }
}

const sphere: Object3D = { points, triangles };

export default sphere;
