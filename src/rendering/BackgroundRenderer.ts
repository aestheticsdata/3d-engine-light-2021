// The scene behind the mesh: sky, atmosphere, checker floor and vignette, in
// that order and only in that order.
//
// The clear at the top of render() is the frame's ONLY clear: Surface3D skips
// its own clearRect whenever a background renderer exists, so removing this one
// leaves every frame painted over the last.
//
// Two switches cover three of the four layers, and the pairing is not arbitrary.
// Sky and atmosphere go together because the atmosphere is the horizon haze
// belonging to the sky — dropping the photograph and keeping its glow leaves a
// bright band floating over a dark frame. The vignette has no switch at all: it
// is the lens, not the scene.

import GroundProjection from "@rendering/GroundProjection";
// A @ui import from inside @rendering, which is the wrong direction and is the
// lesser evil: chartTokens is the one file sanctioned to hand-mirror colors.css
// for canvas painting, and the alternative is a second mirror here. See its
// header.
import { chartTokens } from "@ui/chartTokens";

// How much of the frame the sky photograph covers, and how far above the top
// edge it starts.
const SKY_COVERAGE_RATIO = 0.62;
const SKY_OVERSCAN_RATIO = 0.04;
const SKY_ALPHA = 0.9;

// The two horizons differ by 0.01 and stay that way. The haze band sits one
// percent of the frame height above the geometric horizon the floor is drawn
// from, which is what keeps the glow reading as air in front of the floor rather
// than as a seam along its far edge. Unifying them is a visual change, not a
// tidy-up.
const ATMOSPHERE_HORIZON_RATIO = 0.56;
const FLOOR_HORIZON_RATIO = 0.57;

// The floor's own camera, which is not the mesh camera: the checker grid is
// scenery painted straight into the frame and never goes through Point3D, so it
// carries its own vanishing point, focal length and eye height.
const FLOOR_CENTER_RATIO = 0.6;
const FLOOR_FOCAL_RATIO = 0.95;
const CAMERA_HEIGHT = 1.75;
const NEAR_Z_RATIO = 0.72;
const FAR_Z = 240;

// One checker cell, and how far the grid reaches sideways.
const CELL_WIDTH = 3.4;
const CELL_DEPTH = 4.2;
const HALF_COLUMNS = 72;

const FLOOR_LIGHT_CELL = "rgba(244, 243, 238, 1)";
const FLOOR_DARK_CELL = "rgba(122, 124, 128, 1)";

interface BackgroundRendererOptions {
  width: number;
  height: number;
  skyImage?: HTMLImageElement | null;
}

// Which scenery layers are drawn. Settable after construction rather than passed
// in: the renderer is built once at boot from the canvas dimensions and the
// decoded sky image, long before the WORLD tab exists to have an opinion.
export interface BackgroundLayers {
  sky: boolean;
  floor: boolean;
}

class BackgroundRenderer {
  private readonly width: number;
  private readonly height: number;
  private readonly skyImage: HTMLImageElement | null;
  // Derived from the two dimensions, so they are settled once here rather than
  // recomputed on every frame inside the floor painter.
  private readonly atmosphereHorizonY: number;
  private readonly floorHorizonY: number;
  private readonly floorCenterX: number;
  private readonly floorFocal: number;
  private readonly floorNearZ: number;
  private skyEnabled: boolean;
  private floorEnabled: boolean;

  constructor(options: BackgroundRendererOptions) {
    this.width = options.width;
    this.height = options.height;
    this.skyImage = options.skyImage ?? null;
    // Both on, because both ran unconditionally before they were switchable.
    // The console's defaults mirror what the renderer actually draws, never the
    // mockup's — the design ships sky, floor and grid all true, and this engine
    // has no grid at all.
    this.skyEnabled = true;
    this.floorEnabled = true;
    this.atmosphereHorizonY = this.height * ATMOSPHERE_HORIZON_RATIO;
    this.floorHorizonY = this.height * FLOOR_HORIZON_RATIO;
    this.floorCenterX = this.width * FLOOR_CENTER_RATIO;
    this.floorFocal = this.width * FLOOR_FOCAL_RATIO;
    this.floorNearZ =
      ((CAMERA_HEIGHT * this.floorFocal) / Math.max(1, this.height - this.floorHorizonY)) * NEAR_Z_RATIO;
  }

  public setLayers(layers: BackgroundLayers) {
    this.skyEnabled = layers.sky;
    this.floorEnabled = layers.floor;
  }

  public render(context: CanvasRenderingContext2D) {
    context.save();
    context.clearRect(0, 0, this.width, this.height);

    if (this.skyEnabled) {
      this.renderSky(context);
      this.renderAtmosphere(context);
    } else {
      // A flat fill rather than leaving the cleared canvas transparent, so the
      // frame is a dark image and not a hole. On screen the two are
      // indistinguishable — what shows through is --color-bg-app, the same
      // colour this paints — but the canvas is an exportable artefact and a
      // transparent PNG is not the same thing as a black one.
      //
      // It does not survive everywhere: renderFloor's destination-out fade
      // punches back through it around the horizon, exactly as it already does
      // to the sky. Backing the frame after the fact with destination-over would
      // close that, and would also change the sky-on frame, which is not this
      // ticket's to change.
      context.fillStyle = chartTokens.bgApp;
      context.fillRect(0, 0, this.width, this.height);
    }

    if (this.floorEnabled) {
      this.renderFloor(context);
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

  private renderAtmosphere(context: CanvasRenderingContext2D) {
    const horizonY = this.atmosphereHorizonY;

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

  // The floor does not follow the camera, and after COS-236 that is visible
  // rather than merely true. Its vanishing point, its focal length and its eye
  // height are the constants at the top of this file; the mesh goes through the
  // shared Camera record, which now has a field of view and an orthographic
  // branch. So in ORTHOGRAPHIC the solid's edges go parallel while the checker
  // keeps converging, and at 15° or 120° the two perspectives visibly disagree.
  //
  // Not fixable here. The floor would have to be projected in scene space
  // through the same camera, which is COS-246 (E5a) — the ground grid and world
  // units. Until then the mismatch is the honest cost of having a second
  // projection at all, and it must not be papered over by faking a matching
  // vanishing point from `fl`: that would leave two cameras agreeing by
  // coincidence rather than one camera drawing both.
  private renderFloor(context: CanvasRenderingContext2D) {
    const horizonY = this.floorHorizonY;
    const nearZ = this.floorNearZ;
    const ground = new GroundProjection({
      centerX: this.floorCenterX,
      horizonY,
      focal: this.floorFocal,
      cameraHeight: CAMERA_HEIGHT,
    });

    const rowCount = Math.ceil((FAR_Z - nearZ) / CELL_DEPTH);

    for (let row = rowCount - 1; row >= 0; row -= 1) {
      const zTop = nearZ + row * CELL_DEPTH;
      const zBottom = zTop + CELL_DEPTH;

      for (let col = -HALF_COLUMNS; col < HALF_COLUMNS; col += 1) {
        const xLeft = col * CELL_WIDTH;
        const xRight = (col + 1) * CELL_WIDTH;
        const topLeft = ground.project(xLeft, zTop);
        const topRight = ground.project(xRight, zTop);
        const bottomRight = ground.project(xRight, zBottom);
        const bottomLeft = ground.project(xLeft, zBottom);

        context.fillStyle = (row + col) % 2 === 0 ? FLOOR_LIGHT_CELL : FLOOR_DARK_CELL;
        context.beginPath();
        context.moveTo(topLeft.x, topLeft.y);
        context.lineTo(topRight.x, topRight.y);
        context.lineTo(bottomRight.x, bottomRight.y);
        context.lineTo(bottomLeft.x, bottomLeft.y);
        context.closePath();
        context.fill();
      }
    }

    const fadeStartY = horizonY + (this.height - horizonY) * 0.5;
    const transparencyMask = context.createLinearGradient(0, horizonY, 0, fadeStartY);
    transparencyMask.addColorStop(0, "rgba(0, 0, 0, 1)");
    transparencyMask.addColorStop(1, "rgba(0, 0, 0, 0)");
    // The composite mode is scoped to this one fill and nothing else. Left set,
    // the vignette that follows would erase the frame instead of darkening it.
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = transparencyMask;
    context.fillRect(0, horizonY, this.width, fadeStartY - horizonY);
    context.restore();

    const floorFade = context.createLinearGradient(0, horizonY, 0, this.height);
    floorFade.addColorStop(0, "rgba(255, 225, 238, 0.22)");
    floorFade.addColorStop(0.18, "rgba(255, 255, 255, 0.06)");
    floorFade.addColorStop(1, "rgba(0, 0, 0, 0.02)");
    context.fillStyle = floorFade;
    context.fillRect(0, horizonY, this.width, this.height - horizonY + 4);
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
