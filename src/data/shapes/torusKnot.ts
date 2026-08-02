import TorusKnotGenerator from "@data/shapes/TorusKnotGenerator";

import type { Object3D } from "@data/types";

const torusKnot: Object3D = new TorusKnotGenerator().build();

export default torusKnot;
