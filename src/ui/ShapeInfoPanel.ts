// SHAPE INFO: the seven-row card, and the cross-fade every shape change runs
// through.
//
// The fade lives here because this panel owns the element the animation classes
// go on. It does NOT own what gets repainted: the same 180ms callback also
// refreshes SHAPE STORY, the scene-graph mesh row and the status bar, and all of
// them have to change inside one callback invocation or they visibly disagree
// for the length of the fade on every shape change.
//
// So the panel takes a single repaint callback rather than holding the other
// panels as collaborators. Both shapes were on the table; this one is chosen
// because the set of surfaces that repaint on a shape change keeps growing and
// belongs to whoever owns them, while the choreography — clear the pending
// timeout, fade out, repaint once, fade in — belongs here.

import DOMScope from "@ui/DOMScope";
import type MaterialSummary from "@ui/MaterialSummary";
import type { ShadingMode } from "@ui/modeLabel";
import { primitiveLabel } from "@ui/primitiveLabel";
import type { Object3D } from "@data/types";

// Twinned with `animation: panelFadeOut 180ms` in
// src/styles/components/shape-info.css:56. Change one and the repaint either
// lands before the card has finished fading or after it has started fading
// back in — there is no way for either side to notice on its own.
const FADE_DURATION_MS = 180;

class ShapeInfoPanel {
  private readonly content: HTMLElement;
  private readonly nameNode: HTMLElement;
  private readonly pointsNode: HTMLElement;
  private readonly trianglesNode: HTMLElement;
  private readonly texturesNode: HTMLElement;
  private readonly opacityNode: HTMLElement;
  private readonly shadingNode: HTMLElement;
  private readonly materialNode: HTMLElement;
  private fadeTimeoutId: number | null;

  constructor() {
    const scope = new DOMScope(document);
    const missing = "SHAPE INFO node is missing.";

    this.content = scope.require<HTMLElement>("#shapeInfoPanelContent", missing);
    this.nameNode = scope.require<HTMLElement>("#shapeInfoName", missing);
    this.pointsNode = scope.require<HTMLElement>("#shapeInfoPoints", missing);
    this.trianglesNode = scope.require<HTMLElement>(
      "#shapeInfoTriangles",
      missing,
    );
    this.texturesNode = scope.require<HTMLElement>(
      "#shapeInfoTextures",
      missing,
    );
    this.opacityNode = scope.require<HTMLElement>("#shapeInfoOpacity", missing);
    this.shadingNode = scope.require<HTMLElement>("#shapeInfoShading", missing);
    this.materialNode = scope.require<HTMLElement>(
      "#shapeInfoMaterial",
      missing,
    );
    this.fadeTimeoutId = null;
  }

  public show(primitive: string, object3D: Object3D, material: MaterialSummary) {
    const textureKeys = material.textureKeys;

    this.setValue(this.nameNode, primitiveLabel(primitive));
    this.setValue(this.pointsNode, String(object3D.points.length));
    // The registry count, not the drawn one: this row states what the shape is
    // made of, and it must not move when culling hides half of it. The scene
    // graph's mesh row is the one that follows the renderer.
    this.setValue(this.trianglesNode, String(object3D.triangles.length));
    this.setValue(
      this.texturesNode,
      textureKeys.length > 0 ? textureKeys.join(", ") : "none",
    );
    this.setValue(this.materialNode, material.label);
  }

  // First paint: there is nothing on screen to fade out of, so the repaint runs
  // synchronously and both animation classes are stripped.
  public showImmediately(repaint: () => void) {
    this.clearPendingFade();
    this.content.classList.remove("panelFadeOut", "panelFadeIn");
    repaint();
  }

  public crossFade(repaint: () => void) {
    this.clearPendingFade();
    this.content.classList.remove("panelFadeIn");
    // Restart the fade-out animation if changes happen quickly.
    void this.content.offsetWidth;
    this.content.classList.add("panelFadeOut");

    this.fadeTimeoutId = window.setTimeout(() => {
      repaint();
      this.content.classList.remove("panelFadeOut");
      void this.content.offsetWidth;
      this.content.classList.add("panelFadeIn");
      this.fadeTimeoutId = null;
    }, FADE_DURATION_MS);
  }

  public setOpacity(fraction: number) {
    this.setValue(this.opacityNode, `${Math.round(fraction * 100)}%`);
  }

  public setShading(mode: ShadingMode) {
    this.setValue(this.shadingNode, mode);
  }

  private clearPendingFade() {
    if (this.fadeTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.fadeTimeoutId);
    this.fadeTimeoutId = null;
  }

  // Every value in the panel is clamped to a single line, so the full string has
  // to stay reachable somewhere; title is that somewhere. Written together with
  // the text so a truncated value and its tooltip can never disagree.
  private setValue(node: HTMLElement, value: string) {
    node.textContent = value;
    node.title = value;
  }
}

export default ShapeInfoPanel;
