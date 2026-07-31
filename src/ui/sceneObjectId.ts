// The scene-graph identity string for a primitive key, derived in exactly one
// place. The viewport HUD, the scene graph and the status bar all import this;
// none of them may re-derive it, or the three will drift apart the first time
// a shape key gains a word.
//
//   torusKnot                 -> TORUS_KNOT_01
//   kisRhombicDodecahedron    -> KIS_RHOMBIC_DODECAHEDRON_01
//   cube                      -> CUBE_01

export const sceneObjectId = (key: string) =>
  `${key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_01`;

export default sceneObjectId;
