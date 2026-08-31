import MutetrahedronGenerator from "@data/shapes/MutetrahedronGenerator";

import type { Object3D } from "@data/types";

const mutetrahedron: Object3D = new MutetrahedronGenerator().build();

export default mutetrahedron;
