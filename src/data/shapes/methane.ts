import methaneMolecule from "@data/molecules/methane";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const methane: Object3D = new MoleculeGenerator(methaneMolecule).build();

export default methane;
