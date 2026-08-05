// The scene behind the mesh: sky, atmosphere, checker floor, grid and vignette,
// in that order and only in that order.
//
// The clear at the top of render() is the frame's ONLY clear: Surface3D skips
// its own clearRect whenever a background renderer exists, so removing this one
// leaves every frame painted over the last.
//
// Two switches cover three of the five layers, and the pairing is not
// arbitrary. Sky and atmosphere go together because the atmosphere is the
// horizon haze belonging to the sky — dropping the photograph and keeping its
// glow leaves a bright band floating over a dark frame. The vignette has no
// switch at all: it is the lens, not the scene. Shadow has a switch and no
// renderer behind it yet — COS-247 (E5b) is what draws one.
//
// The floor and the grid share one GroundProjection, built fresh each call from
// whichever Camera and RenderTarget the caller hands in — the same shared
// projection every mesh vertex already goes through. Before COS-246 (E5a) the
// floor carried its own focal length, eye height and vanishing point; that is
// what let it disagree with the mesh the moment FOV or ORTHOGRAPHIC moved.

import GroundFloor from "@rendering/GroundFloor";
import GroundGrid from "@rendering/GroundGrid";
import GroundProjection from "@rendering/GroundProjection";
import { chartTokens } from "@ui/chartTokens";
// A @ui import from inside @rendering, which is the wrong direction and is the
// lesser evil: chartTokens is the one file sanctioned to hand-mirror colors.css
// for canvas painting, and the alternative is a second mirror here. See its
// header.

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

// How much of the frame the sky photograph covers, and how far above the top
// edge it starts.
const SKY_COVERAGE_RATIO = 0.62;
const SKY_OVERSCAN_RATIO = 0.04;
const SKY_ALPHA = 0.9;

interface BackgroundRendererOptions {
  width: number;
  height: number;
  skyImage?: HTMLImageElement | null;
}

// Which scenery layers are drawn. Settable after construction rather than
// passed in: the renderer is built once at boot from the canvas dimensions and
// the decoded sky image, long before the WORLD tab exists to have an opinion.
export interface BackgroundLayers {
  sky: boolean;
  floor: boolean;
  grid: boolean;
  shadow: boolean;
}

// Values a layer needs beyond an on/off switch. fog is stored, unread until
// COS-247 gives it a curve to drive; gridStepMetres is real today — it sizes
// both the grid's own spacing and, so the two agree, the floor's checker cell.
export interface WorldSettings {
  fog: number;
  gridStepMetres: number;
}

// Bundled rather than three positional args (R4): context is the one every
// other pass in this class already takes, camera and renderTarget are what
// COS-246 adds so the ground projection can be built from whichever pair the
// caller currently has, rather than the four ratios this renderer used to
// derive its own vanishing point from.
export interface BackgroundRenderRequest {
  context: CanvasRenderingContext2D;
  camera: Camera;
  renderTarget: RenderTarget;
}

class BackgroundRenderer {
  private readonly width: number;
  private readonly height: number;
  private readonly skyImage: HTMLImageElement | null;
  private skyEnabled: boolean;
  private floorEnabled: boolean;
  private gridEnabled: boolean;
  private shadowEnabled: boolean;
  private fog: number;
  private gridStepMetres: number;

  constructor(options: BackgroundRendererOptions) {
    this.width = options.width;
    this.height = options.height;
    this.skyImage = options.skyImage ?? null;
    // Sky and floor on, because both ran unconditionally before they were
    // switchable; grid and shadow off, fog and grid step at EnvironmentSection's
    // own registered defaults, restated as literals rather than imported —
    // Main's first syncWorldLayers() call (before the loop starts, before
    // anything is ever painted) overwrites every one of these from the store,
    // so nothing here is a value this renderer's own scene ever shows.
    this.skyEnabled = true;
    this.floorEnabled = true;
    this.gridEnabled = false;
    this.shadowEnabled = false;
    this.fog = 18;
    this.gridStepMetres = 4;
  }

  public get shadow(): boolean {
    return this.shadowEnabled;
  }

  public setLayers(layers: BackgroundLayers) {
    this.skyEnabled = layers.sky;
    this.floorEnabled = layers.floor;
    this.gridEnabled = layers.grid;
    this.shadowEnabled = layers.shadow;
  }

  public setWorld(settings: WorldSettings) {
    this.fog = settings.fog;
    // Floored at 1: GroundFloor divides the ground's depth span by this value,
    // and 0 would make that division infinite and its row loop never
    // terminate. GRID STEP's own slider floors at 1 already, but setWorld is
    // public and a caller that reaches it without going through that slider
    // — a test, a restored session — carries none of its guarantees.
    this.gridStepMetres = Math.max(1, settings.gridStepMetres);
  }

  // camera and renderTarget arrive on the request rather than as fields: this
  // renderer is constructed in Bootstrapper before either exists (Main is what
  // builds them), and re-ordering that boot sequence is not this ticket's to
  // do. A GroundProjection built fresh from whichever pair the caller hands in
  // is exactly what the old per-frame `new GroundProjection(...)` inside the
  // checker floor's own painter already did — the object is new, the pattern
  // is not.
  public render(request: BackgroundRenderRequest) {
    const { context, camera, renderTarget } = request;

    context.save();
    context.clearRect(0, 0, this.width, this.height);

    // The one horizon every layer now agrees on: the render target's own
    // centre, which is where s -> 0 puts the vanishing point for both the mesh
    // and the ground. The pre-COS-246 floor sat at 0.57h against the
    // atmosphere's 0.56h, a 1% gap kept deliberately so the two would not read
    // as one seam — that reasoning no longer applies once both are the same
    // camera's own horizon.
    const horizonY = renderTarget.centerY;

    if (this.skyEnabled) {
      this.renderSky(context);
      this.renderAtmosphere(context, horizonY);
    } else {
      // A flat fill rather than leaving the cleared canvas transparent, so the
      // frame is a dark image and not a hole. On screen the two are
      // indistinguishable — what shows through is --color-bg-app, the same
      // colour this paints — but the canvas is an exportable artefact and a
      // transparent PNG is not the same thing as a black one.
      //
      // It does not survive everywhere: GroundFloor's destination-out fade
      // punches back through it around the horizon, exactly as it already does
      // to the sky.
      context.fillStyle = chartTokens.bgApp;
      context.fillRect(0, 0, this.width, this.height);
    }

    const ground = new GroundProjection(renderTarget, camera);

    if (this.floorEnabled) {
      new GroundFloor(ground, this.gridStepMetres).draw(context, horizonY);
    }

    if (this.gridEnabled) {
      new GroundGrid(ground, this.gridStepMetres).draw(context);
    }

    this.renderVignette(context);

    context.restore();
  }

  private renderSky(context: CanvasRenderingContext2D) {
    const skyGradient = context.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, "#7db8ff");
    skyGradient.addColorStop(0.5, "#9bd3ff");
    skyGradient.addColorStop(0.82, "#f3d8e3");
    skyGradient.addColorStop(1, "#f1e8ee");
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, this.width, this.height);

    if (!this.skyImage) {
      return;
    }

    const targetHeight = this.height * SKY_COVERAGE_RATIO;
    const scale = Math.max(this.width / this.skyImage.width, targetHeight / this.skyImage.height);
    const drawWidth = this.skyImage.width * scale;
    const drawHeight = this.skyImage.height * scale;
    const drawX = (this.width - drawWidth) / 2;
    const drawY = -drawHeight * SKY_OVERSCAN_RATIO;

    // Its own save/restore pair: the alpha is for the photograph alone, and the
    // atmosphere pass immediately after paints at full strength.
    context.save();
    context.globalAlpha = SKY_ALPHA;
    context.drawImage(this.skyImage, drawX, drawY, drawWidth, drawHeight);
    context.restore();
  }

  private renderAtmosphere(context: CanvasRenderingContext2D, horizonY: number) {
    const haze = context.createLinearGradient(0, horizonY - 40, 0, this.height);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.22, "rgba(255,235,245,0.58)");
    haze.addColorStop(0.5, "rgba(255,240,246,0.35)");
    haze.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = haze;
    context.fillRect(0, horizonY - 50, this.width, this.height - horizonY + 50);

    const horizonGlow = context.createLinearGradient(0, horizonY - 20, 0, horizonY + 20);
    horizonGlow.addColorStop(0, "rgba(255,255,255,0)");
    horizonGlow.addColorStop(0.5, "rgba(255,245,252,0.85)");
    horizonGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = horizonGlow;
    context.fillRect(0, horizonY - 20, this.width, 40);
  }

  private renderVignette(context: CanvasRenderingContext2D) {
    const vignette = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.42,
      this.width * 0.25,
      this.width * 0.5,
      this.height * 0.42,
      this.width * 0.9,
    );
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.18)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
  }
}

export default BackgroundRenderer;
