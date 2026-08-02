import KisRhombicDodecahedronGenerator from "@data/shapes/KisRhombicDodecahedronGenerator";
import type { Object3D } from "@data/types";

const kisRhombicDodecahedron: Object3D =
  new KisRhombicDodecahedronGenerator().build();

export default kisRhombicDodecahedron;
