import nicotineMolecule from "@data/molecules/nicotine";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const nicotine: Object3D = new MoleculeGenerator(nicotineMolecule).build();

export default nicotine;
