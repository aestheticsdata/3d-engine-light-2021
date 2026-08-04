// PRIMITIVE: the dropdown that chooses which solid is on screen.
//
// Generated from the registry, never from a list. The design hardcodes eight
// shapes that are not this engine's (SPHERE CUBE TORUS ICOSA CYLIND CONE TEAPOT
// TERRA, L1123–L1148); this repo ships fourteen and COS-201 adds more. So the
// options walk Object.keys(data) and the header count is that length — adding a
// shape to the registry adds an option with no edit here.
//
// The active option follows the click, not the transition. A pick made while
// one is animating is parked in the switcher's queue and does not reach
// onTransitionStart for up to 1250ms, so reading the engine first would leave
// the option the user just chose unmarked for the whole animation.

import DOMScope from "@ui/DOMScope";
import ShapePicker from "@ui/inspector/ShapePicker";
import { primitiveChipLabel } from "@ui/primitiveChipLabel";

import type { Data3D } from "@data/types";
import type ShapeThumbnails from "@ui/inspector/ShapeThumbnails";

export interface PrimitiveSectionOptions {
  pickerSelector: string;
  countSelector: string;
  objects3D: Data3D;
  onPick: (primitive: string) => void;
}

class PrimitiveSection {
  private readonly picker: ShapePicker;
  private readonly objects3D: Data3D;
  private readonly keys: string[];

  constructor(options: PrimitiveSectionOptions) {
    const scope = new DOMScope(document);

    this.objects3D = options.objects3D;
    this.keys = Object.keys(options.objects3D);
    this.picker = new ShapePicker({ selector: options.pickerSelector, onPick: options.onPick });

    scope.require<HTMLElement>(options.countSelector, "PRIMITIVE node is missing.").textContent = String(
      this.keys.length,
    );
  }

  // Deferred until the textures resolve: the thumbnails go through the real
  // rasteriser, and the cube's faces are texture keys that resolve to nothing
  // before the registry has loaded.
  public paintOptions(thumbnails: ShapeThumbnails) {
    this.picker.setOptions(
      this.keys.map((key) => ({
        id: key,
        label: primitiveChipLabel(key),
        // Spelled out rather than the scene graph's bare △ glyph. That mark
        // works in a row already captioned by the panel it sits in; here the
        // number stands alone beside a shape name, where a raw 240 reads as
        // anything. The toolbar uses the same word ("tris drawn").
        //
        // The registry count, not the drawn one: it says what the shape is made
        // of, and must not move while culling hides half of it.
        count: `${this.objects3D[key].triangles.length} tris`,
        thumbnail: thumbnails.paint(key),
      })),
    );
  }

  public setActive(primitive: string | null) {
    this.picker.setActive(primitive);
  }
}

export default PrimitiveSection;
