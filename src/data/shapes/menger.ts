import MengerSpongeGenerator from "@data/shapes/MengerSpongeGenerator";

import type { Object3D } from "@data/types";

const menger: Object3D = new MengerSpongeGenerator().build();

export default menger;
