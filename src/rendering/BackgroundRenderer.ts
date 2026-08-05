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

// A @ui import from inside @rendering, which is the wrong direction and is the
// lesser evil: chartTokens is the one file sanctioned to hand-mirror colors.css
// for canvas painting, and the alternative is a second mirror here. See its
// header.

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";
import type { GroundHorizon } from "@rendering/GroundProjection";

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
  // The camera's own matrix, with no turntable folded into it — the ground has
  // to answer to where the viewpoint is looking, and not at all to the spin
  // that turns the object in front of it.
  cameraTransform: number[][];
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
    const { context, camera, renderTarget, cameraTransform } = request;

    context.save();
    context.clearRect(0, 0, this.width, this.height);

    const ground = new GroundProjection({ renderTarget, camera, cameraTransform });
    // Where the ground actually vanishes, which is only the render target's
    // centre while the camera is level. Everything painted in bands — the haze,
    // the glow, the floor's dissolve — is drawn inside alignToHorizon() below,
    // so it keeps using this same centre and lands on the real line whatever
    // the camera is doing. Left as a constant, the sky's horizon and the
    // ground's separate by 172px at the resting pose alone.
    const horizon = ground.horizon();
    const horizonY = renderTarget.centerY;

    if (this.skyEnabled) {
      // The camera's forward direction in world space is row 2 of its own
      // matrix, so its azimuth is what the sky has to pan against.
      const azimuth = Math.atan2(cameraTransform[2][0], cameraTransform[2][2]);
      const focalPx = camera.focalLength * renderTarget.scale;

      this.alignToHorizon(context, renderTarget, horizon, () => {
        this.renderSky(context, azimuth, focalPx);
        this.renderAtmosphere(context, horizonY);
      });
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

    // Only while the eye is above the plane. From below, the floor is in front
    // of everything standing on it, so Surface3D paints it after the meshes
    // through renderGroundOverlay() instead — a background that is sometimes
    // foreground is exactly what a scene with no depth buffer has to do by
    // hand.
    if (!ground.isEyeBelowGround) {
      this.paintGround(context, ground, renderTarget, horizon, horizonY);
    }

    this.renderVignette(context);

    context.restore();
  }

  // The second half of the ground pass, for the frames where the camera has
  // dropped under the floor. Surface3D calls it after the mesh loop, so the
  // plane covers the solids it is genuinely in front of. Above the plane this
  // does nothing and the ground has already been painted behind them.
  public renderGroundOverlay(request: BackgroundRenderRequest) {
    const { context, camera, renderTarget, cameraTransform } = request;
    const ground = new GroundProjection({ renderTarget, camera, cameraTransform });

    if (!ground.isEyeBelowGround) {
      return;
    }

    context.save();
    this.paintGround(context, ground, renderTarget, ground.horizon(), renderTarget.centerY);
    context.restore();
  }

  private paintGround(
    context: CanvasRenderingContext2D,
    ground: GroundProjection,
    renderTarget: RenderTarget,
    horizon: GroundHorizon,
    horizonY: number,
  ) {
    if (this.floorEnabled) {
      const floor = new GroundFloor(ground, this.gridStepMetres);

      floor.drawCells(context);
      this.alignToHorizon(context, renderTarget, horizon, () => floor.drawFade(context, horizonY, this.height));
    }

    if (this.gridEnabled) {
      new GroundGrid(ground, this.gridStepMetres).draw(context);
    }
  }

  // Runs `paint` in a frame where the ground's vanishing line is horizontal and
  // sits exactly on the render target's centre. Deliberately no flip for which
  // side the eye is on: the layers painted here are symmetric about the line, so
  // they soften the ground/sky boundary from whichever side the ground is
  // currently on. Mirroring the frame instead sent the haze to the far edge of
  // the canvas the moment a vertical drag carried the eye under the plane, and
  // what was left was an unsoftened horizon reading as a hard grey slab. Every band-shaped layer is
  // written against that centre already, so this is what lets them all follow a
  // horizon that tips with roll and slides with pitch without any of them
  // re-deriving it.
  //
  // The fills inside are canvas-width rectangles, so the rotation would expose
  // bare corners; callers overscan against the render target's diagonal rather
  // than its width. Its own save/restore pair, because a leaked transform would
  // rotate the vignette too — and the vignette belongs to the screen, not to
  // the world.
  private alignToHorizon(
    context: CanvasRenderingContext2D,
    renderTarget: RenderTarget,
    horizon: GroundHorizon,
    paint: () => void,
  ) {
    context.save();
    context.translate(renderTarget.centerX, renderTarget.centerY);
    context.rotate(-horizon.tilt);
    context.translate(-renderTarget.centerX, -renderTarget.centerY + horizon.offset);
    paint();
    context.restore();
  }

  // Painted inside the horizon's own frame, so it rises and falls with pitch and
  // tilts with roll along with everything else anchored there. At a level camera
  // the frame is the identity and every constant below still describes exactly
  // the image this shipped with.
  //
  // `azimuth` pans it under yaw. A cylindrical panorama of focal f is 2*pi*f
  // wide, so one radian of turn is exactly f pixels of pan — no separate
  // calibration, and the sky tracks the ground's own vanishing directions.
  private renderSky(context: CanvasRenderingContext2D, azimuth: number, focalPx: number) {
    // The rotated frame exposes the canvas corners, so every fill here is
    // oversized against the diagonal rather than the width.
    const overscan = Math.hypot(this.width, this.height);
    const skyGradient = context.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, "#7db8ff");
    skyGradient.addColorStop(0.5, "#9bd3ff");
    skyGradient.addColorStop(0.82, "#f3d8e3");
    skyGradient.addColorStop(1, "#f1e8ee");
    context.fillStyle = skyGradient;
    context.fillRect(-overscan, -overscan, this.width + 2 * overscan, this.height + 2 * overscan);

    if (!this.skyImage) {
      return;
    }

    const targetHeight = this.height * SKY_COVERAGE_RATIO;
    const scale = Math.max(this.width / this.skyImage.width, targetHeight / this.skyImage.height);
    const drawWidth = this.skyImage.width * scale;
    const drawHeight = this.skyImage.height * scale;
    const drawY = -drawHeight * SKY_OVERSCAN_RATIO;
    const centred = (this.width - drawWidth) / 2;
    // Wrapped into one image width so the tile indices below stay small however
    // many turns the camera has made.
    const pan = (((-azimuth * focalPx - centred) % drawWidth) + drawWidth) % drawWidth;
    const first = -Math.ceil((overscan + pan) / drawWidth);
    const last = Math.ceil((this.width + overscan) / drawWidth);

    // Its own save/restore pair: the alpha is for the photograph alone, and the
    // atmosphere pass immediately after paints at full strength.
    context.save();
    context.globalAlpha = SKY_ALPHA;

    // Mirrored alternately rather than butted end to end. The asset is a single
    // square photograph, not a seamless 360° panorama, so repeating it plainly
    // would run a hard vertical join through the sky once a yaw drag brought the
    // join on screen; reflecting every other copy makes the tiling continuous by
    // construction, which a soft cloud field hides completely.
    for (let tile = first; tile <= last; tile += 1) {
      const x = tile * drawWidth - pan;

      context.save();

      if (((tile % 2) + 2) % 2 === 1) {
        context.translate(x + drawWidth, 0);
        context.scale(-1, 1);
        this.drawSkyTile(context, 0, drawY, drawWidth, drawHeight, overscan);
      } else {
        this.drawSkyTile(context, x, drawY, drawWidth, drawHeight, overscan);
      }

      context.restore();
    }

    context.restore();
  }

  // One tile of the sky, with its top and bottom rows stretched out past it.
  // The photograph is finite vertically, and once the horizon slides down its
  // upper edge comes into view — leaving a hard line with the bare gradient
  // showing above it, which reads as a second, wrong sky. Clamping the edge
  // pixels is the standard fix and is invisible here, because the rows being
  // stretched are the near-uniform blue at the top and the haze at the bottom.
  private drawSkyTile(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    overscan: number,
  ) {
    const image = this.skyImage;

    if (!image) {
      return;
    }

    context.drawImage(image, 0, 0, image.width, 1, x, y - overscan, width, overscan);
    context.drawImage(image, x, y, width, height);
    context.drawImage(image, 0, image.height - 1, image.width, 1, x, y + height, width, overscan);
  }

  private renderAtmosphere(context: CanvasRenderingContext2D, horizonY: number) {
    // Symmetric about the horizon, where it used to hang below it. Below was
    // the ground's side while the camera stayed level, and it stops being so
    // the moment the eye drops under the plane — a band that has to know which
    // side it is on is a band that gets it wrong at exactly one pitch.
    const reach = this.height;
    const haze = context.createLinearGradient(0, horizonY - reach, 0, horizonY + reach);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.39, "rgba(255,240,246,0.35)");
    haze.addColorStop(0.5, "rgba(255,235,245,0.58)");
    haze.addColorStop(0.61, "rgba(255,240,246,0.35)");
    haze.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = haze;
    context.fillRect(-this.width, horizonY - reach, 3 * this.width, 2 * reach);

    const horizonGlow = context.createLinearGradient(0, horizonY - 20, 0, horizonY + 20);
    horizonGlow.addColorStop(0, "rgba(255,255,255,0)");
    horizonGlow.addColorStop(0.5, "rgba(255,245,252,0.85)");
    horizonGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = horizonGlow;
    context.fillRect(-this.width, horizonY - 20, 3 * this.width, 40);
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
