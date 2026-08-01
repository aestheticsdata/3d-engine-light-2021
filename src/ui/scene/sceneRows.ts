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

export const PLACEHOLDER_NOTE =
  "Not backed by a real scene object yet: the sky, floor and vignette are drawn per-pixel by BackgroundRenderer and there is no lighting model (de-mock E5 / E7).";

export const HINT_ID = "ph-scene-row";

// Fixed order, and the only declaration of it.
const ROWS: readonly SceneRow[] = [
  { id: MESH_ROW_ID, kind: "MSH", label: "", triangles: null, placeholder: false },
  // 2 is nominal: the checker floor is drawn per-pixel, not as two triangles.
  { id: "floor", kind: "PLN", label: "FLOOR_01", triangles: 2, placeholder: true },
  { id: "sky", kind: "ENV", label: "SKY_DOME", triangles: null, placeholder: true },
  { id: "light", kind: "LGT", label: "KEY_LIGHT", triangles: null, placeholder: true },
];

export default ROWS;
