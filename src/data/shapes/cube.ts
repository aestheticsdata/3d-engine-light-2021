import CubeGenerator from "@data/shapes/CubeGenerator";
import type { Object3D } from "@data/types";

const cube: Object3D = new CubeGenerator().build();

export default cube;
