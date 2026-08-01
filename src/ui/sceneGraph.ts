// The scene graph's rows, and the only place that knows what the frame is
// composed of.
//
// The rows are built here rather than written into index.html because only one
// of them is static: the mesh row's label follows the active primitive and its
// count follows the renderer, and the other three are a fixed table. A table
// plus one builder keeps the four rows impossible to drift apart.
//
// This module holds no state. Selection, per-row visibility and the drawn count
// all live in uiState, which is what lets the quick toggles and the inspector
// read the same booleans later without a second copy. Everything here is either
// derived from that store or pushed in by Main.

import { uiState } from "@ui/UiStateStore";
import { sceneObjectId } from "@ui/sceneObjectId";

// The mesh row is addressed by this constant everywhere — Main resets selection
// to it on every primitive change, and the render path asks whether it is
// hidden. A literal would be four copies of the same string.
export const MESH_ROW_ID = "mesh";

const PLACEHOLDER_NOTE =
  "Not backed by a real scene object yet: the sky, floor and vignette are drawn per-pixel by BackgroundRenderer and there is no lighting model (de-mock E5 / E7).";

interface SceneRow {
  /** Stable key. Never displayed. */
  id: string;
  kind: "MSH" | "PLN" | "ENV" | "LGT";
  /** Fixed label; the mesh row's comes from the active primitive instead. */
  label: string;
  /** null renders the em dash — the object contributes no geometry. */
  triangles: number | null;
  placeholder: boolean;
}

// Fixed order, and the only declaration of it.
const ROWS: readonly SceneRow[] = [
  { id: MESH_ROW_ID, kind: "MSH", label: "", triangles: null, placeholder: false },
  // 2 is nominal: the checker floor is drawn per-pixel, not as two triangles.
  { id: "floor", kind: "PLN", label: "FLOOR_01", triangles: 2, placeholder: true },
  { id: "sky", kind: "ENV", label: "SKY_DOME", triangles: null, placeholder: true },
  { id: "light", kind: "LGT", label: "KEY_LIGHT", triangles: null, placeholder: true },
];

const HINT_ID = "ph-scene-row";

uiState.registerSlice({
  sceneSelection: MESH_ROW_ID,
  sceneHidden: [],
  drawnTriangles: 0,
});

const isHidden = (id: string) => (uiState.getState().sceneHidden ?? []).includes(id);

const formatTriangles = (count: number | null) =>
  count === null ? "—" : `${count} △`;

// Assigning textContent replaces the text node even when the string is
// identical, and paint() runs on every store notification — eleven times a
// second once the drawn count starts publishing. The guard is what keeps three
// static rows from being rebuilt for a number only the fourth one reads.
// classList and setAttribute already no-op on an unchanged value.
const setText = (node: HTMLElement, value: string) => {
  if (node.textContent !== value) {
    node.textContent = value;
  }
};

export const createSceneGraph = () => {
  const card = document.querySelector<HTMLElement>(".sceneGraph");
  const body = card?.querySelector<HTMLElement>(".scene-graph__body");
  const note = card?.querySelector<HTMLElement>(".panel__note");
  if (!card || !body) {
    throw new Error("Scene graph card is missing.");
  }

  // The mesh row's label. Held here only because it is pushed in by Main and
  // read back when the row repaints; it is display state, not scene state.
  let meshId = "";

  const rowNodes = new Map<
    string,
    { row: HTMLElement; select: HTMLButtonElement; id: HTMLElement; tris: HTMLElement; vis: HTMLButtonElement }
  >();

  const labelFor = (row: SceneRow) => (row.id === MESH_ROW_ID ? meshId : row.label);

  ROWS.forEach((row) => {
    const el = document.createElement("div");
    el.className = "scene-row";

    // Two sibling buttons rather than a button inside a row-button. The design
    // nests them and cancels the bubble with stopPropagation; siblings make the
    // "toggling visibility must not select the row" rule structural instead of
    // something a future edit can undo by removing one call. It is also the
    // only arrangement that is valid HTML and gives both controls a real
    // accessible name and keyboard behaviour for free.
    const select = document.createElement("button");
    select.type = "button";
    select.className = "scene-row__select";

    const kind = document.createElement("span");
    kind.className = "scene-row__kind";
    kind.textContent = row.kind;

    const id = document.createElement("span");
    id.className = "scene-row__id";

    const tris = document.createElement("span");
    tris.className = "scene-row__tris";

    select.append(kind, id, tris);

    const vis = document.createElement("button");
    vis.type = "button";
    vis.className = "scene-row__vis tap-pad";

    if (row.placeholder) {
      // The row and its toggle both carry the attribute — the row because the
      // whole object is unbacked, the toggle because it is the control E7 will
      // wire first — and placeholder.css keeps the nesting from double-dimming
      // it. aria-describedby goes on the two buttons rather than the row: the
      // row is a plain div a screen reader never lands on.
      [el, vis].forEach((node) => {
        node.dataset.placeholder = "true";
        node.title = PLACEHOLDER_NOTE;
      });
      [select, vis].forEach((node) =>
        node.setAttribute("aria-describedby", HINT_ID),
      );
    }

    select.addEventListener("click", () => {
      uiState.setState({ sceneSelection: row.id });
    });

    vis.addEventListener("click", () => {
      const hidden = uiState.getState().sceneHidden ?? [];
      uiState.setState({
        sceneHidden: hidden.includes(row.id)
          ? hidden.filter((entry) => entry !== row.id)
          : [...hidden, row.id],
      });
    });

    el.append(select, vis);
    body.append(el);
    rowNodes.set(row.id, { row: el, select, id, tris, vis });
  });

  if (note) {
    note.textContent = `${ROWS.length} obj`;
  }

  const paint = () => {
    const state = uiState.getState();
    const selection = state.sceneSelection ?? MESH_ROW_ID;
    const drawn = state.drawnTriangles ?? 0;

    ROWS.forEach((row) => {
      const nodes = rowNodes.get(row.id);
      if (!nodes) {
        return;
      }

      const label = labelFor(row);
      const hidden = isHidden(row.id);

      nodes.row.classList.toggle("is-selected", selection === row.id);
      nodes.row.classList.toggle("is-hidden", hidden);
      nodes.select.setAttribute("aria-pressed", String(selection === row.id));

      setText(nodes.id, label);
      // The mesh row is the only one whose count moves, and it reads the drawn
      // count so it can never disagree with the toolbar. While the mesh is
      // hidden the renderer draws none of it and the count is genuinely 0 —
      // `0 △`, not the em dash, so it matches the toolbar readout on pause
      // (a deliberate reading of the two counter rules the ticket gives).
      setText(
        nodes.tris,
        formatTriangles(row.id === MESH_ROW_ID ? drawn : row.triangles),
      );

      setText(nodes.vis, hidden ? "○" : "●");
      nodes.vis.setAttribute("aria-pressed", String(!hidden));
      nodes.vis.setAttribute(
        "aria-label",
        `${hidden ? "Show" : "Hide"} ${label || row.kind}`,
      );
    });
  };

  uiState.subscribe(paint);
  paint();

  return {
    // Takes the primitive key, not a formatted string: sceneObjectId owns the
    // snake-case rule (D5) and this is one of its three callers.
    setMeshId: (primitive: string) => {
      meshId = sceneObjectId(primitive);
      paint();
    },
  };
};

export type SceneGraph = ReturnType<typeof createSceneGraph>;

export const isMeshHidden = () => isHidden(MESH_ROW_ID);

export default createSceneGraph;
