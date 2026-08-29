import glucoseMolecule from "@data/molecules/glucose";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const glucose: Object3D = new MoleculeGenerator(glucoseMolecule).build();

export default glucose;
