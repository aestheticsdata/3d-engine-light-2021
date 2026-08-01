// The scene graph panel: the only place that knows what the frame is composed of.
//
// The panel holds no scene state. Selection, per-row visibility and the drawn
// count all live in UiStateStore, which is what lets the quick toggles and the
// inspector read the same booleans later without a second copy. Everything here
// is either derived from that store or pushed in by Main.

import DomScope from "@ui/DomScope";
import ROWS, { MESH_ROW_ID } from "@ui/scene/sceneRows";
import SceneRowView from "@ui/scene/SceneRowView";
import UiStateStore from "@ui/UiStateStore";
import { sceneObjectId } from "@ui/sceneObjectId";

class SceneGraphPanel {
  private readonly store: UiStateStore;
  private readonly body: HTMLElement;
  private readonly note: HTMLElement | null;
  private readonly rowViews: Map<string, SceneRowView>;
  // The mesh row's label. Held here only because it is pushed in by Main and
  // read back when the row repaints; it is display state, not scene state.
  private meshId: string;

  constructor(store: UiStateStore) {
    const card = new DomScope(document).require<HTMLElement>(
      ".sceneGraph",
      "Scene graph card is missing.",
    );
    const scope = new DomScope(card);

    this.store = store;
    this.body = scope.require<HTMLElement>(
      ".scene-graph__body",
      "Scene graph body is missing.",
    );
    this.note = scope.find<HTMLElement>(".panel__note");
    this.rowViews = new Map();
    this.meshId = "";

    // Registered here rather than at import time, so the slice and its RESET
    // defaults arrive with the panel that owns them. Main reads isMeshHidden()
    // on the line after this constructor returns, which is the ordering this
    // has to stay ahead of.
    this.store.registerSlice({
      sceneSelection: MESH_ROW_ID,
      sceneHidden: [],
      drawnTriangles: 0,
    });

    this.buildRows();

    if (this.note) {
      this.note.textContent = `${ROWS.length} obj`;
    }

    this.store.subscribe(this.paint);
    this.paint();
  }

  // Takes the primitive key, not a formatted string: sceneObjectId owns the
  // snake-case rule (D5) and this is one of its callers.
  public setMeshId(primitive: string) {
    this.meshId = sceneObjectId(primitive);
    this.paint();
  }

  public isMeshHidden(): boolean {
    return this.isHidden(MESH_ROW_ID);
  }

  // An arrow property because it is handed to store.subscribe as a value. A
  // regular method here loses its `this` on the first notification and throws —
  // R9's one sanctioned use.
  private paint = () => {
    const state = this.store.getState();
    const selection = state.sceneSelection ?? MESH_ROW_ID;
    const drawn = state.drawnTriangles ?? 0;

    ROWS.forEach((row) => {
      const view = this.rowViews.get(row.id);

      if (!view) {
        return;
      }

      view.paint({
        label: this.labelFor(row.id),
        selected: selection === row.id,
        hidden: this.isHidden(row.id),
        // The mesh row is the only one whose count moves, and it reads the drawn
        // count so it can never disagree with the toolbar. While the mesh is
        // hidden the renderer draws none of it and the count is genuinely 0 —
        // `0 △`, not the em dash, so it matches the toolbar readout on pause
        // (a deliberate reading of the two counter rules the ticket gives).
        triangles: row.id === MESH_ROW_ID ? drawn : row.triangles,
      });
    });
  };

  private buildRows() {
    ROWS.forEach((row) => {
      const view = new SceneRowView(row, this.store);
      this.body.append(view.element);
      this.rowViews.set(row.id, view);
    });
  }

  private labelFor(id: string): string {
    if (id === MESH_ROW_ID) {
      return this.meshId;
    }

    return ROWS.find((row) => row.id === id)?.label ?? "";
  }

  private isHidden(id: string): boolean {
    return (this.store.getState().sceneHidden ?? []).includes(id);
  }
}

export default SceneGraphPanel;
