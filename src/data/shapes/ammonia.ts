import ammoniaMolecule from "@data/molecules/ammonia";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const ammonia: Object3D = new MoleculeGenerator(ammoniaMolecule).build();

export default ammonia;
