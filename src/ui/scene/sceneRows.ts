// What the frame is composed of, as data.
//
// Only one of the four rows is dynamic: the mesh row's label follows the active
// primitive and its count follows the renderer. The other three are fixed. A
// table plus one view class keeps them impossible to drift apart.
//
// Inert data with no behaviour, so it stays a table rather than becoming a class
// (decisions.md D1a).

export interface SceneRow {
  /** Stable key. Never displayed. */
  id: string;
  kind: "MSH" | "PLN" | "ENV" | "LGT";
  /** Fixed label; the mesh row's comes from the active primitive instead. */
  label: string;
  /** null renders the em dash — the object contributes no geometry. */
  triangles: number | null;
  placeholder: boolean;
}

// The mesh row is addressed by this constant everywhere — Main resets selection
// to it on every primitive change, and the render path asks whether it is
// hidden. A literal would be four copies of the same string.
export const MESH_ROW_ID = "mesh";

// The light row is addressed by this constant for the same reason (E3a): Main
// asks whether it is hidden on the render path and the row declares itself here,
// so a literal would be two spellings of one id.
export const LIGHT_ROW_ID = "light";

export const PLACEHOLDER_NOTE =
  "Not backed by a real scene object yet: the sky, floor and vignette are drawn per-pixel by BackgroundRenderer (de-mock E5 / E7).";

export const HINT_ID = "ph-scene-row";

// Fixed order, and the only declaration of it.
const ROWS: readonly SceneRow[] = [
  { id: MESH_ROW_ID, kind: "MSH", label: "", triangles: null, placeholder: false },
  // 2 is nominal: the checker floor is drawn per-pixel, not as two triangles.
  { id: "floor", kind: "PLN", label: "FLOOR_01", triangles: 2, placeholder: true },
  { id: "sky", kind: "ENV", label: "SKY_DOME", triangles: null, placeholder: true },
  // Backed by a real light since E3a: hiding this row drops the diffuse and
  // specular terms off every face, which is a visible change to the frame rather
  // than a dimmed label. It contributes no geometry, so the em dash stays.
  { id: LIGHT_ROW_ID, kind: "LGT", label: "KEY_LIGHT", triangles: null, placeholder: false },
];

export default ROWS;
