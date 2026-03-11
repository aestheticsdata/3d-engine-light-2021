import { triangle } from "@data/builder";
import { Object3D } from "@data/types";

type Vec3 = [number, number, number];

const KNOT_P = 2;
const KNOT_Q = 3;
const MAJOR_RADIUS = 74;
const PATH_RADIUS = 28;
const TUBE_RADIUS = 14;
const PATH_SEGMENTS = 220;
const TUBE_SEGMENTS = 18;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v: Vec3, factor: number): Vec3 => [
  v[0] * factor,
  v[1] * factor,
  v[2] * factor,
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const magnitude = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v: Vec3): Vec3 => {
  const len = magnitude(v);
  if (len < 1e-9) {
    return [0, 0, 0];
  }

  return scale(v, 1 / len);
};

const rotateAroundAxis = (vector: Vec3, axis: Vec3, angle: number): Vec3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const axisDot = dot(axis, vector);
  const term1 = scale(vector, cos);
  const term2 = scale(cross(axis, vector), sin);
  const term3 = scale(axis, axisDot * (1 - cos));

  return add(add(term1, term2), term3);
};

const knotCenter = (u: number): Vec3 => {
  const pu = KNOT_P * u;
  const qu = KNOT_Q * u;
  const ringRadius = MAJOR_RADIUS + PATH_RADIUS * Math.cos(qu);

  return [
    ringRadius * Math.cos(pu),
    ringRadius * Math.sin(pu),
    PATH_RADIUS * Math.sin(qu),
  ];
};

const knotTangent = (u: number): Vec3 => {
  const pu = KNOT_P * u;
  const qu = KNOT_Q * u;
  const cosPu = Math.cos(pu);
  const sinPu = Math.sin(pu);
  const cosQu = Math.cos(qu);
  const sinQu = Math.sin(qu);
  const ringRadius = MAJOR_RADIUS + PATH_RADIUS * cosQu;
  const ringRadiusDerivative = -PATH_RADIUS * KNOT_Q * sinQu;

  const x = ringRadiusDerivative * cosPu - ringRadius * KNOT_P * sinPu;
  const y = ringRadiusDerivative * sinPu + ringRadius * KNOT_P * cosPu;
  const z = PATH_RADIUS * KNOT_Q * cosQu;

  return normalize([x, y, z]);
};

const points: number[][] = [];
const triangles: triangle[] = [];

const centers: Vec3[] = [];
const tangents: Vec3[] = [];
const normals: Vec3[] = [];
const binormals: Vec3[] = [];

for (let i = 0; i < PATH_SEGMENTS; i += 1) {
  const u = (i * 2 * Math.PI) / PATH_SEGMENTS;
  centers.push(knotCenter(u));
  tangents.push(knotTangent(u));
}

const firstTangent = tangents[0];
let initialNormal: Vec3 = [1, 0, 0];
if (
  Math.abs(firstTangent[1]) <= Math.abs(firstTangent[0]) &&
  Math.abs(firstTangent[1]) <= Math.abs(firstTangent[2])
) {
  initialNormal = [0, 1, 0];
}
if (
  Math.abs(firstTangent[2]) <= Math.abs(firstTangent[0]) &&
  Math.abs(firstTangent[2]) <= Math.abs(firstTangent[1])
) {
  initialNormal = [0, 0, 1];
}

const seed = normalize(cross(firstTangent, initialNormal));
const firstNormal = normalize(cross(firstTangent, seed));

normals.push(firstNormal);
binormals.push(normalize(cross(firstTangent, firstNormal)));

for (let i = 1; i < PATH_SEGMENTS; i += 1) {
  const prevTangent = tangents[i - 1];
  const tangent = tangents[i];
  const axis = cross(prevTangent, tangent);
  const axisLen = magnitude(axis);

  let nextNormal = normals[i - 1];
  if (axisLen > 1e-8) {
    const axisDir = scale(axis, 1 / axisLen);
    const angle = Math.atan2(axisLen, dot(prevTangent, tangent));
    nextNormal = rotateAroundAxis(normals[i - 1], axisDir, angle);
  }

  const orthogonalNormal = normalize(
    sub(nextNormal, scale(tangent, dot(nextNormal, tangent))),
  );
  normals.push(orthogonalNormal);
  binormals.push(normalize(cross(tangent, orthogonalNormal)));
}

let theta = Math.acos(clamp(dot(normals[0], normals[PATH_SEGMENTS - 1]), -1, 1));
if (theta > 1e-7) {
  if (dot(tangents[0], cross(normals[0], normals[PATH_SEGMENTS - 1])) > 0) {
    theta = -theta;
  }

  const thetaStep = theta / (PATH_SEGMENTS - 1);
  for (let i = 1; i < PATH_SEGMENTS; i += 1) {
    normals[i] = normalize(
      rotateAroundAxis(normals[i], tangents[i], thetaStep * i),
    );
    binormals[i] = normalize(cross(tangents[i], normals[i]));
  }
}

const pointIndex = (path: number, tube: number) => path * TUBE_SEGMENTS + tube;

for (let path = 0; path < PATH_SEGMENTS; path += 1) {
  const center = centers[path];
  const normal = normals[path];
  const binormal = binormals[path];

  for (let tube = 0; tube < TUBE_SEGMENTS; tube += 1) {
    const v = (tube * 2 * Math.PI) / TUBE_SEGMENTS;
    const radial = add(
      scale(normal, Math.cos(v) * TUBE_RADIUS),
      scale(binormal, Math.sin(v) * TUBE_RADIUS),
    );
    const point = add(center, radial);

    points.push([point[0], point[1], point[2]]);
  }
}

const pointAsVec = (index: number): Vec3 => {
  const point = points[index];
  return [point[0], point[1], point[2]];
};

const pushOrientedTriangle = (
  a: number,
  b: number,
  c: number,
  outward: Vec3,
  color: string,
) => {
  const triNormal = cross(sub(pointAsVec(b), pointAsVec(a)), sub(pointAsVec(c), pointAsVec(a)));
  if (dot(triNormal, outward) <= 0) {
    triangles.push([a, b, c, color]);
    return;
  }

  triangles.push([a, c, b, color]);
};

for (let path = 0; path < PATH_SEGMENTS; path += 1) {
  const nextPath = (path + 1) % PATH_SEGMENTS;

  for (let tube = 0; tube < TUBE_SEGMENTS; tube += 1) {
    const nextTube = (tube + 1) % TUBE_SEGMENTS;

    const a = pointIndex(path, tube);
    const b = pointIndex(nextPath, tube);
    const c = pointIndex(path, nextTube);
    const d = pointIndex(nextPath, nextTube);
    const color = (path + tube) % 2 === 0 ? "rgba(144,213,255,1)" : "rgba(255, 0, 102,1)";
    const quadOutward = normalize(
      add(
        add(sub(pointAsVec(a), centers[path]), sub(pointAsVec(b), centers[nextPath])),
        add(sub(pointAsVec(c), centers[path]), sub(pointAsVec(d), centers[nextPath])),
      ),
    );

    pushOrientedTriangle(a, b, c, quadOutward, color);
    pushOrientedTriangle(c, b, d, quadOutward, color);
  }
}

const torusKnot: Object3D = { points, triangles };

export default torusKnot;
