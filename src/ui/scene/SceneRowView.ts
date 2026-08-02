// One row of the scene graph: its five nodes, its two controls, its repaint.
//
// This entity had no name before — it lived as an anonymous object type inside a
// Map generic, with its construction spread across a sixty-line loop and its
// repaint in a second loop somewhere else. Naming it is the reason the panel
// splits, not the line count.

import { HINT_ID, PLACEHOLDER_NOTE } from "@ui/scene/sceneRows";

import type { SceneRow } from "@ui/scene/sceneRows";
import type UIStateStore from "@ui/UIStateStore";

export interface SceneRowState {
  label: string;
  selected: boolean;
  hidden: boolean;
  triangles: number | null;
}

const formatTriangles = (count: number | null) => (count === null ? "—" : `${count} △`);

class SceneRowView {
  private readonly definition: SceneRow;
  private readonly store: UIStateStore;
  private readonly root: HTMLElement;
  private readonly selectButton: HTMLButtonElement;
  private readonly idNode: HTMLElement;
  private readonly trisNode: HTMLElement;
  private readonly visButton: HTMLButtonElement;

  constructor(definition: SceneRow, store: UIStateStore) {
    this.definition = definition;
    this.store = store;

    this.root = document.createElement("div");
    this.root.className = "scene-row";

    // Two sibling buttons rather than a button inside a row-button. The design
    // nests them and cancels the bubble with stopPropagation; siblings make the
    // "toggling visibility must not select the row" rule structural instead of
    // something a future edit can undo by removing one call. It is also the
    // only arrangement that is valid HTML and gives both controls a real
    // accessible name and keyboard behaviour for free.
    this.selectButton = document.createElement("button");
    this.selectButton.type = "button";
    this.selectButton.className = "scene-row__select";

    const kind = document.createElement("span");
    kind.className = "scene-row__kind";
    kind.textContent = definition.kind;

    this.idNode = document.createElement("span");
    this.idNode.className = "scene-row__id";

    this.trisNode = document.createElement("span");
    this.trisNode.className = "scene-row__tris";

    this.selectButton.append(kind, this.idNode, this.trisNode);

    this.visButton = document.createElement("button");
    this.visButton.type = "button";
    this.visButton.className = "scene-row__vis tap-pad";

    if (definition.placeholder) {
      // The row and its toggle both carry the attribute — the row because the
      // whole object is unbacked, the toggle because it is the control E7 will
      // wire first — and placeholder.css keeps the nesting from double-dimming
      // it. aria-describedby goes on the two buttons rather than the row: the
      // row is a plain div a screen reader never lands on.
      [this.root, this.visButton].forEach((node) => {
        node.dataset.placeholder = "true";
        node.title = PLACEHOLDER_NOTE;
      });
      [this.selectButton, this.visButton].forEach((node) => node.setAttribute("aria-describedby", HINT_ID));
    }

    this.selectButton.addEventListener("click", () => {
      this.store.setState({ sceneSelection: this.definition.id });
    });

    this.visButton.addEventListener("click", () => {
      const hidden = this.store.getState().sceneHidden ?? [];

      this.store.setState({
        sceneHidden: hidden.includes(this.definition.id)
          ? hidden.filter((entry) => entry !== this.definition.id)
          : [...hidden, this.definition.id],
      });
    });

    this.root.append(this.selectButton, this.visButton);
  }

  public get element(): HTMLElement {
    return this.root;
  }

  public paint(state: SceneRowState) {
    this.root.classList.toggle("is-selected", state.selected);
    this.root.classList.toggle("is-hidden", state.hidden);
    this.selectButton.setAttribute("aria-pressed", String(state.selected));

    this.setText(this.idNode, state.label);
    this.setText(this.trisNode, formatTriangles(state.triangles));
    this.setText(this.visButton, state.hidden ? "○" : "●");

    this.visButton.setAttribute("aria-pressed", String(!state.hidden));
    this.visButton.setAttribute(
      "aria-label",
      `${state.hidden ? "Show" : "Hide"} ${state.label || this.definition.kind}`,
    );
  }

  // Assigning textContent replaces the text node even when the string is
  // identical, and paint() runs on every store notification — eleven times a
  // second once the drawn count starts publishing. The guard is what keeps three
  // static rows from being rebuilt for a number only the fourth one reads.
  // classList and setAttribute already no-op on an unchanged value.
  private setText(node: HTMLElement, value: string) {
    if (node.textContent !== value) {
      node.textContent = value;
    }
  }
}

export default SceneRowView;
