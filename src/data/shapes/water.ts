import waterMolecule from "@data/molecules/water";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const water: Object3D = new MoleculeGenerator(waterMolecule).build();

export default water;
