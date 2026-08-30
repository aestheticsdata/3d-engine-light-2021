// The scene behind the mesh: sky, atmosphere, checker floor, grid and vignette,
// in that order and only in that order.
//
// The clear at the top of render() is the frame's ONLY clear: Surface3D skips
// its own clearRect whenever a background renderer exists, so removing this one
// leaves every frame painted over the last.
//
// Two switches cover three of the six layers, and the pairing is not
// arbitrary. Sky and atmosphere go together because the atmosphere is the
// horizon haze belonging to the sky — dropping the photograph and keeping its
// glow leaves a bright band floating over a dark frame. The vignette has no
// switch at all: it is the lens, not the scene. Shadow got its renderer with
// COS-247 (E5b), which is also where fog started multiplying into the two
// ground layers.
//
// The floor, the grid and the shadow share one GroundProjection, built fresh
// each call from whichever Camera and RenderTarget the caller hands in — the
// same shared projection every mesh vertex already goes through. Before COS-246
// (E5a) the floor carried its own focal length, eye height and vanishing point;
// that is what let it disagree with the mesh the moment FOV or ORTHOGRAPHIC
// moved.
//
// Every layer that paints adds one draw call (COS-247), where the whole pass
// used to add one between them. Deliberately per LAYER and not per canvas
// submission, unlike the mesh side's per-triangle count: the checker floor is
// 900 fills at the shipped grid step, and counting them would bury the subject
// of the frame under its scenery. What the card is worth reading for is that the
// number now moves when a switch does.
//
// FOR E3B (COS-242): the background snapshot this class was expected to allow is
// still viable, but not over the whole pass. Snapshot-able, because nothing in
// them depends on the mesh: sky, sky bitmap, atmosphere, floor, grid. Not
// snapshot-able, and to be drawn per frame after the meshes: the shadow, which
// reads the posed mesh bounds every frame, and the vignette, which sits on top
// of everything.

import { formatRgba, parseCssColor } from "@rendering/cssColor";
import { SKY_HORIZON } from "@rendering/fogCurve";
import GroundFloor from "@rendering/GroundFloor";
import GroundGrid from "@rendering/GroundGrid";
import GroundProjection from "@rendering/GroundProjection";
import GroundShadow from "@rendering/GroundShadow";
import ShadowCompositor from "@rendering/ShadowCompositor";
import { chartTokens } from "@ui/chartTokens";

// A @ui import from inside @rendering, which is the wrong direction and is the
// lesser evil: chartTokens is the one file sanctioned to hand-mirror colors.css
// for canvas painting, and the alternative is a second mirror here. See its
// header.

import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";
import type { RGBA } from "@rendering/cssColor";
import type Fog from "@rendering/Fog";
import type FrameBuffer from "@rendering/FrameBuffer";
import type { GroundHorizon } from "@rendering/GroundProjection";
import type RenderStats from "@rendering/RenderStats";
import type { ShadowBlob } from "@rendering/shadowEllipse";

// How much of the frame the sky photograph covers, and how far above the top
// edge it starts.
const SKY_COVERAGE_RATIO = 0.62;
const SKY_OVERSCAN_RATIO = 0.04;
const SKY_ALPHA = 0.9;

// The width of the sweep's soft edge (HAL-174), measured along its own axis —
// the top of the frame to the horizon line, so 0.5 is half that span. It is also
// what staggers the two ends: the boundary starts one band above the frame and
// finishes one band below the horizon, which is why the zenith is gone long
// before the horizon band is and why the horizon reaches full cover at exactly
// the reveal the flat fill takes over.
const SKY_SWEEP_BAND = 0.5;

// bgApp as channels, so the sweep can lay the same colour down at a per-stop
// alpha. Parsed once here rather than per frame: chartTokens is frozen, and the
// fallback keeps the parse a fact rather than an assumption, the way Fog's own
// does. Black is the right one to fall back to — it is what a frame with no sky
// is already meant to be.
const BG_APP: RGBA = parseCssColor(chartTokens.bgApp) ?? [0, 0, 0, 1];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

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
  // How much of each of the two withdrawing layers is still standing, 1 as they
  // ship and 0 once gone (HAL-174). They ride here beside the switches rather
  // than arriving through a call of their own because they are the same
  // decision seen twice: the boolean is what the user asked for, the reveal is
  // how far the picture has got round to agreeing. A molecule flips the switch
  // at once and takes the shape transition's own 1250ms to empty the reveal, so
  // a layer whose switch reads off is still painted until its reveal is 0.
  skyReveal: number;
  floorReveal: number;
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
  // On the request for the same reason camera and renderTarget are: this
  // renderer is constructed in Bootstrapper, before Main exists to have built
  // either. It is the SAME instance the render options carry to Triangle, which
  // is what makes a shape and the floor under it fog by one curve rather than
  // by two that agree by hand.
  fog: Fog;
  // One per posed mesh, folded by Surface3D and empty whenever GROUND SHADOW is
  // off. Two of them mid-transition, each with its own screen offset.
  blobs: readonly ShadowBlob[];
  stats: RenderStats;
}

// The depth-buffered backend's own request (E3e): the same scene inputs as
// above with the frame buffer in place of the canvas context, derived from it
// rather than restated so a field added to one cannot go missing from the
// other.
export type BufferCompositeRequest = Omit<BackgroundRenderRequest, "context"> & { buffer: FrameBuffer };

// Values a layer needs beyond an on/off switch. It sizes both the grid's own
// spacing and, so the two agree, the floor's checker cell. FOG left this record
// with COS-247 and went to the Fog above — it stopped being a number this class
// stores and became a curve three layers evaluate.
export interface WorldSettings {
  gridStepMetres: number;
}

// The frame's request plus the three things both entry points derive from it
// before handing it on. Not exported: the ground pass is this class's internal
// seam, and it exists as a record only because the alternative is seven
// positional arguments.
interface GroundPass {
  request: BackgroundRenderRequest;
  ground: GroundProjection;
  horizon: GroundHorizon;
  horizonY: number;
}

class BackgroundRenderer {
  private width: number;
  private height: number;
  private readonly skyImage: HTMLImageElement | null;
  private skyEnabled: boolean;
  private floorEnabled: boolean;
  private gridEnabled: boolean;
  private shadowEnabled: boolean;
  private skyReveal: number;
  private floorReveal: number;
  private gridStepMetres: number;
  // Bumped by setLayers/setWorld (E3b/COS-242) — the two calls that can move
  // anything Surface3D's background snapshot depends on. resize() is not
  // counted here: Surface3D already detects a resize itself, off the same
  // renderTarget dimensions FrameBuffer.setSize reads.
  private layersChangeCount: number;

  constructor(options: BackgroundRendererOptions) {
    this.width = options.width;
    this.height = options.height;
    this.skyImage = options.skyImage ?? null;
    // Sky and floor on, because both ran unconditionally before they were
    // switchable; grid and shadow off, grid step at EnvironmentSection's own
    // registered default, restated as a literal rather than imported — Main's
    // first syncWorldLayers() call (before the loop starts, before anything is
    // ever painted) overwrites every one of these from the store, so nothing
    // here is a value this renderer's own scene ever shows.
    this.skyEnabled = true;
    this.floorEnabled = true;
    this.gridEnabled = false;
    this.shadowEnabled = false;
    this.skyReveal = 1;
    this.floorReveal = 1;
    this.gridStepMetres = 4;
    this.layersChangeCount = 0;
  }

  public get shadow(): boolean {
    return this.shadowEnabled;
  }

  public get layersVersion(): number {
    return this.layersChangeCount;
  }

  public setLayers(layers: BackgroundLayers) {
    this.skyEnabled = layers.sky;
    this.floorEnabled = layers.floor;
    this.gridEnabled = layers.grid;
    this.shadowEnabled = layers.shadow;
    this.skyReveal = layers.skyReveal;
    this.floorReveal = layers.floorReveal;
    this.layersChangeCount += 1;
  }

  public setWorld(settings: WorldSettings) {
    // Floored at 1: GroundFloor divides the ground's depth span by this value,
    // and 0 would make that division infinite and its row loop never
    // terminate. GRID STEP's own slider floors at 1 already, but setWorld is
    // public and a caller that reaches it without going through that slider
    // — a test, a restored session — carries none of its guarantees.
    this.gridStepMetres = Math.max(1, settings.gridStepMetres);
    this.layersChangeCount += 1;
  }

  // Every layer below derives its geometry from width/height at draw time
  // rather than caching anything from them, so writing the two fields is the
  // whole of it (E9b/COS-250) — there is no snapshot to invalidate here yet
  // (see the FOR E3B note above).
  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // camera and renderTarget arrive on the request rather than as fields: this
  // renderer is constructed in Bootstrapper before either exists (Main is what
  // builds them), and re-ordering that boot sequence is not this ticket's to
  // do. A GroundProjection built fresh from whichever pair the caller hands in
  // is exactly what the old per-frame `new GroundProjection(...)` inside the
  // checker floor's own painter already did — the object is new, the pattern
  // is not.
  public render(request: BackgroundRenderRequest) {
    const { context, camera, renderTarget, cameraTransform, stats } = request;

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

    this.paintSky({ request, ground, horizon, horizonY });

    // Only while the eye is above the plane. From below, the floor is in front
    // of everything standing on it, so Surface3D paints it after the meshes
    // through renderGroundOverlay() instead — a background that is sometimes
    // foreground is exactly what a scene with no depth buffer has to do by
    // hand.
    if (!ground.isEyeBelowGround) {
      this.paintGround({ request, ground, horizon, horizonY });
    }

    this.renderVignette(context);
    stats.addDrawCall();

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
    this.paintGround({ request, ground, horizon: ground.horizon(), horizonY: renderTarget.centerY });
    context.restore();
  }

  // The snapshot-able half of render() above (E3b/COS-242): sky, atmosphere,
  // floor, grid — nothing that depends on the posed mesh. Surface3D calls
  // this only on the frame its background-snapshot cache is invalid, via
  // getImageData, and reuses the captured bytes on every frame after until
  // something bumps layersVersion, the camera, or the render target size.
  // Deliberately excludes the shadow (COS-247 made it depend on the mesh's
  // own bounds every frame) and the vignette (paired with the shadow in
  // renderPostMeshLayers below, since both blend over the mesh, not under
  // it).
  public renderSnapshotLayers(request: BackgroundRenderRequest) {
    const { context, camera, renderTarget, cameraTransform } = request;

    context.save();
    context.clearRect(0, 0, this.width, this.height);

    const ground = new GroundProjection({ renderTarget, camera, cameraTransform });
    const horizon = ground.horizon();
    const horizonY = renderTarget.centerY;

    this.paintSky({ request, ground, horizon, horizonY });

    if (!ground.isEyeBelowGround) {
      this.paintFloorAndGrid({ request, ground, horizon, horizonY });
    }

    context.restore();
  }

  // The ground shadow, blended into the frame buffer BEFORE the mesh loop
  // rather than painted onto the canvas after it (E3e/3DE-115).
  //
  // The move is a correctness fix, not a speed one. This pass and the vignette
  // used to be a single post-mesh canvas call, which put the shadow on top of
  // the mesh — so a shape standing on the plane was darkened by its own
  // shadow. The painter path never had that: there the whole background,
  // shadow included, goes down before a single triangle is filled. The two
  // backends now agree, and the buffer is what makes it expressible, because
  // the shadow can be written under mesh pixels that do not exist yet.
  //
  // Runs regardless of eye-above/below-ground, unlike render() and
  // renderGroundOverlay()'s own split of that case across two methods — a shadow
  // on a plane the eye has dropped under is a painter-path problem, and this
  // backend's depth buffer answers it without help.
  public compositeShadow(request: BufferCompositeRequest) {
    if (!this.shadowEnabled) {
      return;
    }

    const { buffer, camera, renderTarget, cameraTransform, fog, blobs, stats } = request;
    const ground = new GroundProjection({ renderTarget, camera, cameraTransform });

    new ShadowCompositor(ground, fog).composite(buffer, blobs, stats);
  }

  // The one layer that still paints onto the canvas after FrameBuffer.present()
  // — and the reason present() uploads the whole buffer, which its header
  // spells out.
  //
  // It stays on the canvas deliberately. E3e measured the alternative: a
  // full-frame radial gradient evaluated per pixel in JS costs 5.7ms at
  // 1615x991, against a fraction of that for the CanvasGradient fill below.
  // Moving it into the buffer to unlock a partial upload spends far more than
  // the upload was ever worth.
  public renderVignetteOverlay(context: CanvasRenderingContext2D, stats: RenderStats) {
    context.save();
    this.renderVignette(context);
    stats.addDrawCall();
    context.restore();
  }

  // The ground's three layers, in the order they stack: cells, then lines over
  // them, then the shadow over both. The shadow lives here rather than beside
  // the mesh loop precisely so it follows the ground — including the pass above,
  // where the eye has dropped under the plane and all three are painted over the
  // solids instead of behind them.
  //
  // Split into two calls (E3b/COS-242) rather than kept as one: renderSnapshotLayers
  // above wants the first without the second, and renderPostMeshLayers wants
  // the second without the first. render()/renderGroundOverlay() compose them
  // back into exactly the same order they always drew, so this split changes
  // nothing either one paints.
  private paintGround(pass: GroundPass) {
    this.paintFloorAndGrid(pass);
    this.paintShadowLayer(pass.request, pass.ground);
  }

  private paintFloorAndGrid(pass: GroundPass) {
    const { request, ground, horizon, horizonY } = pass;
    const { context, renderTarget, fog, stats } = request;

    // The switch is no longer the whole answer (HAL-174): a molecule flips it off
    // in the frame it is picked, and the disc has the shape transition's own
    // 1250ms to finish shrinking. What decides whether there is anything left to
    // paint is the reveal, and the switch only decides where the reveal is
    // heading.
    if (this.floorEnabled || this.floorReveal > 0) {
      const floor = new GroundFloor({ ground, stepMetres: this.gridStepMetres, fog, reveal: this.floorReveal });

      floor.drawCells(context);
      this.alignToHorizon(context, renderTarget, horizon, () => floor.drawFade(context, horizonY, this.height));
      stats.addDrawCall();
    }

    if (this.gridEnabled) {
      new GroundGrid({ ground, stepMetres: this.gridStepMetres, fog }).draw(context);
      stats.addDrawCall();
    }
  }

  private paintShadowLayer(request: BackgroundRenderRequest, ground: GroundProjection) {
    if (!this.shadowEnabled) {
      return;
    }

    const { context, fog, blobs, stats } = request;

    // The one background layer whose draw-call count depends on the scene
    // rather than on a switch — two mid-transition, none while the near plane
    // has rejected them — so it is the one that counts its own.
    new GroundShadow(ground, fog).draw(context, blobs, stats);
  }

  // Sky, photograph and haze under one switch — and, since HAL-174, under one
  // reveal beside it. One method behind render() and renderSnapshotLayers()
  // alike, where the two carried the same block twice: the sweep below has to
  // land in both, and a mask only half the frames paint is a mask the snapshot
  // cache would flicker.
  private paintSky(pass: GroundPass) {
    const { request, horizon, horizonY } = pass;
    const { context, camera, renderTarget, cameraTransform, stats } = request;

    if (!this.skyEnabled && this.skyReveal <= 0) {
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
      stats.addDrawCall();
      return;
    }

    // The camera's forward direction in world space is row 2 of its own
    // matrix, so its azimuth is what the sky has to pan against.
    const azimuth = Math.atan2(cameraTransform[2][0], cameraTransform[2][2]);
    const focalPx = camera.focalLength * renderTarget.scale;

    this.alignToHorizon(context, renderTarget, horizon, () => {
      this.renderSky(context, azimuth, focalPx);
      this.renderAtmosphere(context, horizonY);
      this.maskSky(context, horizonY);
    });
    // Gradient, photograph and haze: three layers under one switch, counted
    // separately because they really are three passes over the frame. The
    // photograph is one whatever the yaw makes its tile count, which is the
    // per-layer rule this class counts by.
    stats.addDrawCall();
    stats.addDrawCall();

    if (this.skyImage) {
      stats.addDrawCall();
    }

    // The withdrawal's own pass over the frame, counted by the same rule and
    // only on the frames that actually pay for it — at a full reveal maskSky
    // returns before its fill.
    if (this.skyReveal < 1) {
      stats.addDrawCall();
    }
  }

  // The sky's withdrawal (HAL-174). A globalAlpha ramp over the whole layer
  // would be a dimmer switch; what this lays down is a boundary that travels —
  // bgApp behind it, untouched sky ahead of it — sweeping from the top of the
  // frame down to the horizon as the reveal runs 1 → 0. The sky drains from the
  // zenith and the horizon band is the last of it to go, which is the same
  // reading as the floor's shrinking disc.
  //
  // Painted inside alignToHorizon along with everything else band-shaped here,
  // so the sweep tilts with roll and slides with pitch for free rather than
  // deriving the horizon a second time.
  //
  // Toward bgApp rather than toward transparency, for the reason the flat fill
  // above exists: the canvas is an exportable artefact and a transparent PNG is
  // not a black one. The two meet exactly. The gradient's far stop reaches full
  // opacity as the reveal reaches 0 — and beyond the horizon a CanvasGradient
  // holds its last stop, so the ground's half of the frame goes with it — which
  // makes the endpoint of this sweep the existing off-state rather than a new
  // one that approximates it.
  //
  // No destination-out: a punch-through composite would eat the fill under the
  // sky as well, and avoiding that would need an offscreen buffer this does not.
  private maskSky(context: CanvasRenderingContext2D, horizonY: number) {
    if (this.skyReveal >= 1) {
      return;
    }

    // Offsets along the gradient's own axis, where 0 is the top of the frame and
    // 1 the horizon. `foot` is where the boundary has reached and `head` is
    // where it is already fully opaque behind; both run past their end of the
    // axis, which is what staggers the zenith and the horizon.
    const swept = 1 - this.skyReveal;
    const foot = swept * (1 + SKY_SWEEP_BAND);
    const head = foot - SKY_SWEEP_BAND;
    const alphaAt = (offset: number): number => clamp01((foot - offset) / SKY_SWEEP_BAND);
    const mask = context.createLinearGradient(0, 0, 0, horizonY);
    // The two ends are always stops; the two kinks only while they fall inside
    // the axis, since a CanvasGradient takes no offset outside 0..1. They are
    // already in order — head precedes foot by one band's width.
    const offsets = [0, ...[head, foot].filter((offset) => offset > 0 && offset < 1), 1];

    offsets.forEach((offset) => {
      mask.addColorStop(offset, formatRgba([BG_APP[0], BG_APP[1], BG_APP[2], alphaAt(offset)]));
    });

    // Oversized against the diagonal like every other fill in this frame: the
    // rotation the horizon applies would otherwise leave the canvas corners bare.
    const overscan = Math.hypot(this.width, this.height);

    context.fillStyle = mask;
    context.fillRect(-overscan, -overscan, this.width + 2 * overscan, this.height + 2 * overscan);
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
  //
  // Unnegated, because the rig's eye looks down +z (viewPresets.ts): row 2 of
  // cameraTransform gives azimuth = -yaw, so panning by +azimuth already turns
  // the photograph the same way a yaw drag turns the ground under
  // GroundProjection.project() — negating it here sent the sky one way while
  // the ground went the other.
  private renderSky(context: CanvasRenderingContext2D, azimuth: number, focalPx: number) {
    // The rotated frame exposes the canvas corners, so every fill here is
    // oversized against the diagonal rather than the width.
    const overscan = Math.hypot(this.width, this.height);
    const skyGradient = context.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, "#7db8ff");
    skyGradient.addColorStop(0.5, "#9bd3ff");
    skyGradient.addColorStop(0.82, "#f3d8e3");
    // The one stop of the four that is shared, and shared with the fog: what the
    // scene fades into at the horizon has to be what fog fades a surface toward,
    // or the haze reads as a grey film over the frame. fogCurve owns the constant
    // because it is the side that cannot be wrong about it.
    skyGradient.addColorStop(1, SKY_HORIZON);
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
    const pan = (((azimuth * focalPx - centred) % drawWidth) + drawWidth) % drawWidth;
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
