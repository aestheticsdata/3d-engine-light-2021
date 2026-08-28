import carbonDioxideMolecule from "@data/molecules/carbonDioxide";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const carbonDioxide: Object3D = new MoleculeGenerator(carbonDioxideMolecule).build();

export default carbonDioxide;
