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

import DomScope from "@ui/DomScope";
import FollowCursorTooltip from "@ui/tooltip";
import { OPACITY_SLIDER } from "@ui/SliderBank";
import { ShadingMode, modeLabel } from "@ui/modeLabel";

const OPACITY_SLIDER_MIN = 0;
const OPACITY_SLIDER_MAX = 100;

// Exported because the slider bank's opacity binding needs the same number this
// class writes back when culling is switched on.
export const DEFAULT_OPACITY_SLIDER_VALUE = 100;

export interface RenderPipelineOptions {
  wireframe: boolean;
  cullBackfaces: boolean;
  opacity: number;
}

class RenderPipelinePanel {
  private readonly wireframeBtn: HTMLElement;
  private readonly backfaceCullingBtn: HTMLElement;
  private readonly opacitySlider: HTMLInputElement;
  private readonly opacityDisabledTooltip: FollowCursorTooltip;
  private notifyChange: () => void;
  private wireframeEnabled: boolean;
  private backfaceCullingEnabled: boolean;
  private opacityFraction: number;

  constructor() {
    const scope = new DomScope(document);
    const missing = "RENDER control is missing.";

    this.wireframeBtn = scope.require<HTMLElement>("#toggleWireframe", missing);
    this.backfaceCullingBtn = scope.require<HTMLElement>(
      "#toggleBackfaceCulling",
      missing,
    );
    this.opacitySlider = scope.require<HTMLInputElement>(
      OPACITY_SLIDER,
      missing,
    );
    this.opacityDisabledTooltip = new FollowCursorTooltip({
      target: this.opacitySlider,
      message: "Turn backface culling off to adjust opacity.",
      shouldShow: () => this.opacitySlider.disabled,
    });
    // A no-op until bind() runs, so the toggles are inert rather than fatal if
    // anything reaches them before the owner has wired its repaint.
    this.notifyChange = () => {};
    this.wireframeEnabled = false;
    this.backfaceCullingEnabled = true;
    this.opacityFraction = 1;
  }

  public get wireframe(): boolean {
    return this.wireframeEnabled;
  }

  public get shadingMode(): ShadingMode {
    return modeLabel(this.wireframeEnabled);
  }

  public get opacity(): number {
    return this.opacityFraction;
  }

  public bind(onChange: () => void) {
    this.notifyChange = onChange;
    this.wireframeBtn.addEventListener("click", this.toggleWireframe);
    this.backfaceCullingBtn.addEventListener(
      "click",
      this.toggleBackfaceCulling,
    );
    this.syncToggleButtons();
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
    const raw =
      (sliderValue - OPACITY_SLIDER_MIN) /
      (OPACITY_SLIDER_MAX - OPACITY_SLIDER_MIN);

    this.opacityFraction = Math.min(1, Math.max(0, raw));
    this.notifyChange();
  };

  // Only the two flags. Opacity is restored by the slider bank writing its
  // default and the read-back pushing it here, which is the same path a RESET
  // takes for the other five sliders.
  public reset() {
    this.wireframeEnabled = false;
    this.backfaceCullingEnabled = true;
    this.syncToggleButtons();
  }

  public syncOpacityAvailability() {
    this.opacitySlider.disabled = this.backfaceCullingEnabled;
    this.opacityDisabledTooltip.hide();
  }

  // The segmented control paints both halves at all times and .is-on decides
  // which one lights, so the flag is the whole binding: no word to write, and
  // nothing for the row or the label to do. The old text wrote the action
  // rather than the state, which is why the two disagreed at every default.
  private syncToggleButtons() {
    this.wireframeBtn.classList.toggle("is-on", this.wireframeEnabled);
    this.backfaceCullingBtn.classList.toggle(
      "is-on",
      this.backfaceCullingEnabled,
    );
  }

  private toggleWireframe = () => {
    this.wireframeEnabled = !this.wireframeEnabled;
    this.syncToggleButtons();
    this.notifyChange();
  };

  // Switching culling back on returns opacity to fully opaque before the slider
  // is disabled, so the frame can never be left half-transparent with no control
  // to fix it. The value is written straight onto the element: a programmatic
  // write fires no event, so the fraction has to be pushed by hand as well.
  private toggleBackfaceCulling = () => {
    this.backfaceCullingEnabled = !this.backfaceCullingEnabled;
    this.syncToggleButtons();

    if (this.backfaceCullingEnabled) {
      this.opacitySlider.value = String(DEFAULT_OPACITY_SLIDER_VALUE);
      this.setOpacityFromSlider(DEFAULT_OPACITY_SLIDER_VALUE);
    }

    this.syncOpacityAvailability();
    this.notifyChange();
  };
}

export default RenderPipelinePanel;
