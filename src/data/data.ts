import { Data3D } from "@data/types";
import cross from "@data/shapes/cross";
import cube from "@data/shapes/cube";
import cuboctahedron from "@data/shapes/cuboctahedron";
import donut from "@data/shapes/donut";
import kisRhombicDodecahedron from "@data/shapes/kisRhombicDodecahedron";
import menger from "@data/shapes/menger";
import pyramid from "@data/shapes/pyramid";
import rhombicDodecahedron from "@data/shapes/rhombicDodecahedron";
import sphere from "@data/shapes/sphere";
import torusKnot from "@data/shapes/torusKnot";

export type { Data3D, Object3D } from "@data/types";

const data: Data3D = {
  sphere,
  cube,
  pyramid,
  cross,
  donut,
  torusKnot,
  menger,
  cuboctahedron,
  rhombicDodecahedron,
  kisRhombicDodecahedron,
};

export default data;
