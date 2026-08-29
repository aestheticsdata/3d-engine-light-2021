import aspirinMolecule from "@data/molecules/aspirin";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const aspirin: Object3D = new MoleculeGenerator(aspirinMolecule).build();

export default aspirin;
