// The RENDER tab: wireframe, backface culling, and the opacity the second of
// them gates.
//
// These three values were fields on Main and were spelled into an identical
// `{ wireframe, cullBackfaces, opacity }` literal twice — once on the animated
// render path and once on the paused one — from two methods that had no reason
// to know about each other. `getRenderOptions()` is that literal, once. The
// caller merges the texture registry into it, which is the only render option
// this panel does not own.
//
// Opacity lives here rather than with the other five sliders because it is a
// render option, not a camera one, and because backface culling decides whether
// it is adjustable at all — the two have to agree about which of them is in
// charge. The slider ELEMENT is shared with the slider bank, which owns its
// value and its listener while this class owns `disabled` and the tooltip.
//
// `setWireframe` / `setCullBackfaces` replace what used to be two private click
// handlers bound to two static buttons this class resolved itself. COS-230
// moved both buttons into `PipelineSection`, which builds them dynamically
// alongside three placeholder rows — so this class no longer owns any DOM for
// them, only the two booleans and the side effect flipping culling on carries.
// Their visual state is synced back by Main, the same way opacity's `disabled`
// state already was.

import DOMScope from "@ui/DOMScope";
import { OPACITY_SLIDER } from "@ui/inspector/MaterialSection";
import FollowCursorTooltip from "@ui/tooltip";

const OPACITY_SLIDER_MIN = 0;
const OPACITY_SLIDER_MAX = 100;

// Exported because the slider bank's opacity binding needs the same number this
// class writes back when culling is switched on.
export const DEFAULT_OPACITY_SLIDER_VALUE = 100;
export const DEFAULT_WIREFRAME = false;
export const DEFAULT_CULL_BACKFACES = true;

export interface RenderPipelineOptions {
  wireframe: boolean;
  cullBackfaces: boolean;
  opacity: number;
}

class RenderPipelinePanel {
  private readonly opacitySlider: HTMLInputElement;
  private readonly opacityDisabledTooltip: FollowCursorTooltip;
  private notifyChange: () => void;
  private wireframeEnabled: boolean;
  private backfaceCullingEnabled: boolean;
  private opacityFraction: number;

  constructor() {
    const scope = new DOMScope(document);

    this.opacitySlider = scope.require<HTMLInputElement>(OPACITY_SLIDER, "RENDER control is missing.");
    this.opacityDisabledTooltip = new FollowCursorTooltip({
      target: this.opacitySlider,
      message: "Turn backface culling off to adjust opacity.",
      shouldShow: () => this.opacitySlider.disabled,
    });
    // A no-op until bind() runs. There is no toggle DOM left for this class to
    // guard — what can now reach this before the owner has wired its repaint is
    // setWireframe and setCullBackfaces themselves, called directly by whatever
    // owns the buttons, which makes this guard more relevant than before, not
    // less.
    this.notifyChange = () => {};
    this.wireframeEnabled = DEFAULT_WIREFRAME;
    this.backfaceCullingEnabled = DEFAULT_CULL_BACKFACES;
    this.opacityFraction = 1;
  }

  public get wireframe(): boolean {
    return this.wireframeEnabled;
  }

  public get cullBackfaces(): boolean {
    return this.backfaceCullingEnabled;
  }

  public get opacity(): number {
    return this.opacityFraction;
  }

  public bind(onChange: () => void) {
    this.notifyChange = onChange;
  }

  public getRenderOptions(): RenderPipelineOptions {
    return {
      wireframe: this.wireframeEnabled,
      cullBackfaces: this.backfaceCullingEnabled,
      opacity: this.opacityFraction,
    };
  }

  // An arrow property: this is the slider bank's `apply` for the opacity binding
  // and is handed over as a value.
  public setOpacityFromSlider = (sliderValue: number) => {
    const raw = (sliderValue - OPACITY_SLIDER_MIN) / (OPACITY_SLIDER_MAX - OPACITY_SLIDER_MIN);
    this.opacityFraction = Math.min(1, Math.max(0, raw));
    this.notifyChange();
  };

  public setWireframe(next: boolean) {
    this.wireframeEnabled = next;
    this.notifyChange();
  }

  public setCullBackfaces(next: boolean) {
    this.backfaceCullingEnabled = next;

    // Switching culling back on returns opacity to fully opaque before the slider
    // is disabled, so the frame can never be left half-transparent with no control
    // to fix it. The value is written straight onto the element: a programmatic
    // write fires no event, so the fraction has to be pushed by hand as well.
    if (this.backfaceCullingEnabled) {
      this.opacitySlider.value = String(DEFAULT_OPACITY_SLIDER_VALUE);
      this.setOpacityFromSlider(DEFAULT_OPACITY_SLIDER_VALUE);
    }

    this.syncOpacityAvailability();
    this.notifyChange();
  }

  // Mirrors the constructor's defaults, opacity included: culling gates the
  // slider, so leaving the fraction stale here would reopen the disabled
  // control with no way left to move it off 40%, say. Main.resetControls()
  // pushes the corrected values out afterward via syncOpacityAvailability()
  // and syncPipelineReadouts(), the same way it already does for the other two.
  public reset() {
    this.wireframeEnabled = DEFAULT_WIREFRAME;
    this.backfaceCullingEnabled = DEFAULT_CULL_BACKFACES;
    this.opacityFraction = 1;
  }

  public syncOpacityAvailability() {
    this.opacitySlider.disabled = this.backfaceCullingEnabled;
    this.opacityDisabledTooltip.hide();
  }
}

export default RenderPipelinePanel;
