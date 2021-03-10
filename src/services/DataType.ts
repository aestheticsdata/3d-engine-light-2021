type Point = [number, number, number];
type Points = Array<Point>;

type Triangle = [number, number, number, string];
type Triangles = Array<Triangle>;

interface Object3D {
  points: Points;
  triangles: Triangles;
}
export interface DataType {
  [k: string] : Object3D;
}
