import caffeineMolecule from "@data/molecules/caffeine";
import MoleculeGenerator from "@data/shapes/MoleculeGenerator";

import type { Object3D } from "@data/types";

const caffeine: Object3D = new MoleculeGenerator(caffeineMolecule).build();

export default caffeine;
