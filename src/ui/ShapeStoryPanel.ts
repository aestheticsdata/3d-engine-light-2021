// SHAPE STORY: the prose card under the inspector.
//
// It owns no state and reads nothing — the catalogue entry is pushed in on every
// shape change, together with the primitive key it belongs to.

import DomScope from "@ui/DomScope";
import { primitiveLabel } from "@ui/primitiveLabel";
import { ShapeReference, ShapeInfo } from "@data/shapeInfo";

class ShapeStoryPanel {
  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly feature: HTMLElement;
  private readonly density: HTMLElement;
  private readonly generator: HTMLElement;
  private readonly references: HTMLElement;

  constructor() {
    const scope = new DomScope(document);
    const missing = "SHAPE STORY node is missing.";

    this.title = scope.require<HTMLElement>("#shapeStoryTitle", missing);
    this.description = scope.require<HTMLElement>(
      "#shapeStoryDescription",
      missing,
    );
    this.feature = scope.require<HTMLElement>("#shapeStoryFeature", missing);
    this.density = scope.require<HTMLElement>("#shapeStoryDensity", missing);
    this.generator = scope.require<HTMLElement>("#shapeStoryGenerator", missing);
    this.references = scope.require<HTMLElement>(
      "#shapeStoryReferences",
      missing,
    );
  }

  public show(primitive: string, info: ShapeInfo | undefined) {
    // Unreachable today — every primitive in data.ts has a shapeInfo entry — and
    // kept for the one that eventually lands without a write-up. The generator
    // row falls back to an em dash rather than an empty slot, so the label never
    // stands over nothing.
    if (!info) {
      this.title.textContent = primitiveLabel(primitive);
      this.description.textContent = "";
      this.feature.textContent = "";
      this.density.textContent = "";
      this.generator.textContent = "—";
      this.syncReferences();
      return;
    }

    this.title.textContent = info.title;
    this.description.textContent = info.description;
    this.feature.textContent = info.geometricFeature;
    this.density.textContent = info.densityLabel;
    this.generator.textContent = info.generator;
    this.syncReferences(info.references);
  }

  // Opened in a new tab so the running animation is never torn down; noopener
  // keeps the opened page from reaching back through window.opener.
  private syncReferences(references: ShapeReference[] = []) {
    this.references.replaceChildren();

    references.forEach((reference) => {
      const link = document.createElement("a");
      link.className = "shape-story__link";
      link.href = reference.url;
      link.textContent = reference.label;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      this.references.appendChild(link);
    });
  }
}

export default ShapeStoryPanel;
