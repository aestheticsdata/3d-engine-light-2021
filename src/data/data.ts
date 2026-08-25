import cross from "@data/shapes/cross";
import cube from "@data/shapes/cube";
import cuboctahedron from "@data/shapes/cuboctahedron";
import donut from "@data/shapes/donut";
import icosidodecahedron from "@data/shapes/icosidodecahedron";
import kisRhombicDodecahedron from "@data/shapes/kisRhombicDodecahedron";
import kisRhombicTriacontahedron from "@data/shapes/kisRhombicTriacontahedron";
import menger from "@data/shapes/menger";
import mucuboctahedron from "@data/shapes/mucuboctahedron";
import murhombicuboctahedron from "@data/shapes/murhombicuboctahedron";
import pyramid from "@data/shapes/pyramid";
import rhombicDodecahedron from "@data/shapes/rhombicDodecahedron";
import rhombicTriacontahedron from "@data/shapes/rhombicTriacontahedron";
import sphere from "@data/shapes/sphere";
import torusKnot from "@data/shapes/torusKnot";
import torusKnot25 from "@data/shapes/torusKnot25";
import torusKnot27 from "@data/shapes/torusKnot27";
import torusKnot34 from "@data/shapes/torusKnot34";
import truncatedCuboctahedron from "@data/shapes/truncatedCuboctahedron";
import truncatedIcosidodecahedron from "@data/shapes/truncatedIcosidodecahedron";
import water from "@data/shapes/water";

import type { Data3D } from "@data/types";

export type { Data3D, Object3D } from "@data/types";

// `satisfies` rather than an annotation, so the key list survives into the type
// system: `keyof typeof data` is the twenty-one names, not `string`. That is
// what lets shapeInfo.ts be checked against this registry — a shape added here
// and left unclassified there is a compile error rather than a solid that
// quietly falls out of the picker. The shape of each entry is still enforced.
const data = {
  sphere,
  cube,
  pyramid,
  cross,
  donut,
  torusKnot,
  torusKnot25,
  torusKnot27,
  torusKnot34,
  menger,
  cuboctahedron,
  rhombicDodecahedron,
  kisRhombicDodecahedron,
  truncatedCuboctahedron,
  icosidodecahedron,
  rhombicTriacontahedron,
  kisRhombicTriacontahedron,
  truncatedIcosidodecahedron,
  mucuboctahedron,
  murhombicuboctahedron,
  water,
} satisfies Data3D;

export default data;
