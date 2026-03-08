import { triangle } from "@data/builder";

export interface Object3D {
  points: number[][];
  triangles: triangle[];
}

export interface Data3D {
  [k: string]: Object3D;
}
