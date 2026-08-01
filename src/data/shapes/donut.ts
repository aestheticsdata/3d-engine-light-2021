import TorusGenerator from "@data/shapes/TorusGenerator";
import { Object3D } from "@data/types";

const donut: Object3D = new TorusGenerator().build();

export default donut;
