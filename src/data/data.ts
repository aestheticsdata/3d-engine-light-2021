import { Data3D } from "@data/types";
import cross from "@data/shapes/cross";
import cube from "@data/shapes/cube";
import donut from "@data/shapes/donut";
import pyramid from "@data/shapes/pyramid";
import sphere from "@data/shapes/sphere";

export type { Data3D, Object3D } from "@data/types";

const data: Data3D = {
  sphere,
  cube,
  pyramid,
  cross,
  donut,
};

export default data;
