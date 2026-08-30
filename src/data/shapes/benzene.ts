import benzeneMolecule from "@data/molecules/benzene";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const benzene: Object3D = new MoleculeGenerator(benzeneMolecule).build();

export default benzene;
