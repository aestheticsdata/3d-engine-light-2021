// The composition root: it owns the collaborators, wires them to one another,
// and owns the render path they all feed.
//
// What is left here is what genuinely crosses widget boundaries. A shape change
// repaints four surfaces that must change together; a pipeline change writes
// three readouts that must agree; the frame publishes two numbers that must
// describe the same frame. Everything that belonged to one widget has gone to
// that widget.

import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import CameraController, { DEFAULT_ZOOM_SLIDER_VALUE } from "@app/CameraController";
import FPSMeter from "@app/FPSMeter";
import RenderLoop from "@app/RenderLoop";
import ShapeSwitcher from "@app/ShapeSwitcher";
import CameraRig from "@camera/CameraRig";
import data from "@data/data";
import shapeInfo from "@data/shapeInfo";
import PointerOrbit from "@input/PointerOrbit";
import MeshFactory from "@primitives/MeshFactory";
import RenderTarget from "@primitives/RenderTarget";
import Surface3D from "@primitives/Surface3D";
import { CLOCK_RESOLUTION_THRESHOLD_MS, probeClockResolutionMs } from "@rendering/clockResolution";
import RenderStats from "@rendering/RenderStats";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";
import TextureRegistry from "@textures/TextureRegistry";
import {
  DEFAULT_FLOOR,
  DEFAULT_FOG,
  DEFAULT_GRID,
  DEFAULT_GRID_STEP,
  DEFAULT_SHADOW,
  DEFAULT_SKY,
} from "@ui/inspector/EnvironmentSection";
import RenderTab from "@ui/inspector/RenderTab";
import ShapeTab from "@ui/inspector/ShapeTab";
import ShapeThumbnails from "@ui/inspector/ShapeThumbnails";
import { DEFAULT_PITCH_DEGREES, DEFAULT_ROLL_DEGREES, DEFAULT_YAW_DEGREES } from "@ui/inspector/TransformSection";
import WorldTab from "@ui/inspector/WorldTab";
import MaterialSummary from "@ui/MaterialSummary";
import { impliesWireframe } from "@ui/modeLabel";
import QuickToggles from "@ui/QuickToggles";
import RenderPipelinePanel from "@ui/RenderPipelinePanel";
import ShapeInfoPanel from "@ui/ShapeInfoPanel";
import ShapeStoryPanel from "@ui/ShapeStoryPanel";
import StatusBar from "@ui/StatusBar";
import SceneGraphPanel from "@ui/scene/SceneGraphPanel";
import { MESH_ROW_ID } from "@ui/scene/sceneRows";
import TransportBar from "@ui/TransportBar";
import CameraWidget from "@ui/telemetry/CameraWidget";
import FramerateWidget from "@ui/telemetry/FramerateWidget";
import FrameTimeWidget from "@ui/telemetry/FrameTimeWidget";
import GeometryWidget from "@ui/telemetry/GeometryWidget";
import SystemWidget from "@ui/telemetry/SystemWidget";
import ZBufferWidget from "@ui/telemetry/ZBufferWidget";
import UIStateStore from "@ui/UIStateStore";
import ViewportHUD from "@ui/ViewportHUD";

import type { BootContext } from "@app/Bootstrapper";
import type { RigAngles } from "@camera/CameraRig";
import type { ViewPresetKey } from "@camera/viewPresets";
import type { Data3D } from "@data/data";
import type { ProjectionMode } from "@primitives/Camera";
import type Mesh from "@primitives/Mesh";
import type { MeshRenderRequest } from "@primitives/Surface3D";
import type BackgroundRenderer from "@rendering/BackgroundRenderer";
import type FieldWriter from "@ui/FieldWriter";

const TRANSITION_DURATION_MS = 1250;
// The longest gap the rig is told about. A backgrounded tab can hand back a
// timestamp seconds later, and spinning the shape by the whole absence is a jump
// rather than the continuation it looks like from the user's side.
const MAX_FRAME_DELTA_MS = 100;
const MILLISECONDS_PER_SECOND = 1000;

class Main {
  // The console's only store, constructed here rather than exported beside its
  // class. A module-scope instance is one every future importer shares by
  // accident, and its slices are already registered before anything decides
  // they should be — which is what made the panel's registerSlice call an
  // import-time side effect until it moved into the panel's own constructor.
  private readonly uiState: UIStateStore;
  // FPS and the drawn-triangle count do not resolve a node here: both appear in
  // more than one place in the DOM (toolbar, mobile header, telemetry card), so
  // they go through the writer, which touches every [data-field] node at once.
  // boot() owns the instance because it writes the build labels before Main
  // exists.
  private readonly fields: FieldWriter;
  private readonly statusBar: StatusBar;
  private readonly viewportHud: ViewportHUD;
  private readonly sceneGraph: SceneGraphPanel;
  private readonly shapeInfo: ShapeInfoPanel;
  private readonly shapeStory: ShapeStoryPanel;
  private readonly pipeline: RenderPipelinePanel;
  private readonly renderTab: RenderTab;
  private readonly worldTab: WorldTab;
  private readonly quickToggles: QuickToggles;
  private readonly transport: TransportBar;
  private readonly shapeTab: ShapeTab;
  // Held as well as handed to Surface3D: the WORLD tab's SKY and FLOOR rows and
  // the viewport's quick toggles both switch layers on it at runtime, and this
  // class is the one place that reads the store and pushes the pair.
  private readonly background: BackgroundRenderer;
  private readonly framerate: FramerateWidget;
  private readonly frameTime: FrameTimeWidget;
  private readonly geometry: GeometryWidget;
  private readonly zBuffer: ZBufferWidget;
  private readonly cameraStats: CameraWidget;
  private readonly system: SystemWidget;
  private readonly fpsMeter: FPSMeter;
  private readonly loop: RenderLoop;
  private readonly objects3D: Data3D;
  private readonly stage: CanvasRenderingContext2D;
  private readonly surface3D: Surface3D;
  private readonly renderTarget: RenderTarget;
  // Constructed here rather than by Surface3D (E6/COS-239): Main has to call
  // beginFrame() before the rig's own matrix pass, which runs before
  // surface3D.render is ever reached, so the shared accumulator has to exist
  // before Surface3D's constructor sees it.
  private readonly renderStats: RenderStats;
  private readonly meshFactory: MeshFactory;
  private readonly textures: TextureRegistry;
  private readonly camera: CameraController;
  private readonly rig: CameraRig;
  private readonly pointerOrbit: PointerOrbit;
  private readonly shapes: ShapeSwitcher;
  private readonly unsubscribe: () => void;
  // A change detector, not a second copy of the state: this class publishes the
  // drawn count through the same store it subscribes to, so an unguarded
  // subscriber would re-enter renderPausedFrame on its own notification.
  private meshHidden: boolean;
  private renderedTriangles: number;
  // The frame clock, kept here because this is where the timestamp arrives. The
  // rig accumulates its spin against real elapsed time rather than per frame,
  // which is what makes a revolution take the same fifteen seconds uncapped as
  // it does under the RENDER tab's 30fps cap.
  private lastFrameTimestamp: number;

  // The canvas arrives resolved. Main used to repeat the Bootstrapper's own
  // querySelector and instanceof guard, so a missing canvas threw from whichever
  // of the two ran first.
  constructor(context: BootContext) {
    const { canvas, backgroundRenderer, fields } = context;

    const stage = canvas.getContext("2d");
    if (!stage) {
      throw new Error("2D canvas context is not available.");
    }

    // First, and in the constructor body rather than a field initialiser:
    // `useDefineForClassFields` runs initialisers before this body, so anything
    // built here that subscribes would be reaching for a store that does not
    // exist yet.
    this.uiState = new UIStateStore();
    this.fields = fields;
    this.statusBar = new StatusBar(this.fields);
    this.viewportHud = new ViewportHUD(canvas, this.fields);
    this.sceneGraph = new SceneGraphPanel(this.uiState);
    this.meshHidden = this.sceneGraph.isMeshHidden();
    this.stage = stage;
    this.background = backgroundRenderer;
    this.camera = new CameraController(canvas);
    // The render target, resolved once from the canvas the Bootstrapper already
    // handed over, and the camera record the controller owns — both shared by
    // every point of every mesh built here. Every mesh in the console therefore
    // projects through one render target and one camera, and the sliders write
    // to the camera rather than to the vertices. Moved ahead of Surface3D
    // (COS-246): the background renderer's ground projection needs both, and
    // Surface3D is what carries them to it on every frame.
    this.renderTarget = new RenderTarget({ width: canvas.width, height: canvas.height });
    this.assertSeedFraming();
    this.renderStats = new RenderStats();
    this.surface3D = new Surface3D({
      container: this.stage,
      camera: this.camera.projection,
      renderTarget: this.renderTarget,
      backgroundRenderer,
      stats: this.renderStats,
    });
    // Before every widget that reads it. The SHAPE tab's sliders and the WORLD
    // tab's presets write to it, the CAMERA card and the HUD read from it, and
    // the render path applies its matrix — so it is one of the few collaborators
    // whose construction order is load-bearing rather than incidental.
    this.rig = new CameraRig();
    this.lastFrameTimestamp = performance.now();
    this.meshFactory = new MeshFactory(this.renderTarget, this.camera.projection);
    this.textures = new TextureRegistry();
    this.objects3D = data;
    this.renderedTriangles = 0;
    this.shapeInfo = new ShapeInfoPanel();
    this.shapeStory = new ShapeStoryPanel();
    // Before the pipeline panel, and that order is load-bearing: this tab
    // creates #opacitySlider, and RenderPipelinePanel resolves it in its own
    // constructor to own the disabled state and the tooltip.
    this.shapeTab = new ShapeTab({
      objects3D: this.objects3D,
      store: this.uiState,
      // Lit from the click, not from the transition: a pick made while one is
      // animating is parked in the switcher's queue and does not reach
      // onTransitionStart for up to 1250ms, which would leave the chip the user
      // just pressed dark for the whole animation.
      onPick: (primitive) => {
        this.shapeTab.setActivePrimitive(primitive);
        this.shapes.request(primitive);
      },
      onPitch: (degrees) => this.changeRig({ pitch: degrees }),
      onYaw: (degrees) => this.changeRig({ yaw: degrees }),
      onRoll: (degrees) => this.changeRig({ roll: degrees }),
      onSpin: (degreesPerSecond) => this.changeRig({ spinRate: degreesPerSecond }),
      onOpacity: (value) => this.pipeline.setOpacityFromSlider(value),
    });
    this.pipeline = new RenderPipelinePanel();
    this.renderTab = new RenderTab({
      store: this.uiState,
      wireframe: this.pipeline.wireframe,
      cullBackfaces: this.pipeline.cullBackfaces,
      onShadingSelect: (mode) => this.pipeline.setWireframe(impliesWireframe(mode)),
      onWireframeToggle: (next) => this.pipeline.setWireframe(next),
      onCullToggle: (next) => this.pipeline.setCullBackfaces(next),
      onFrameRateCap: (fps) => this.applyFrameRateCap(fps),
    });
    this.worldTab = new WorldTab({
      store: this.uiState,
      onFov: (degrees) => this.changeFov(degrees),
      onZoom: (value) => this.changeZoom(value),
      onProjection: (mode) => this.changeProjection(mode),
      onViewPreset: (key) => this.applyViewPreset(key),
      onLayersChange: () => this.syncWorldLayers(),
    });
    // After the WORLD tab because that is the order they read in, not because
    // the store forces it: the pills fall back to the same exported defaults
    // EnvironmentSection registers, so an empty store still paints them right.
    // What genuinely has to follow is syncPipelineReadouts() below — that call
    // is the only thing that seeds the WIRE and CULL pills.
    this.quickToggles = new QuickToggles({
      mounts: [".quick-toggle-band", ".quick-toggles"],
      store: this.uiState,
      wireframe: this.pipeline.wireframe,
      cullBackfaces: this.pipeline.cullBackfaces,
      onLayersChange: () => this.syncWorldLayers(),
      onWireframeToggle: (next) => this.pipeline.setWireframe(next),
      onCullToggle: (next) => this.pipeline.setCullBackfaces(next),
    });
    this.transport = new TransportBar();
    this.pointerOrbit = new PointerOrbit({
      canvas,
      getAngles: () => this.rig.angles(),
      getZoom: () => this.uiState.getState().zoom ?? DEFAULT_ZOOM_SLIDER_VALUE,
      onOrbit: (pitch, yaw) => this.applyPointerOrbit(pitch, yaw),
      onZoom: (value) => this.applyPointerZoom(value),
      onReset: () => this.applyPointerReset(),
    });
    this.shapes = new ShapeSwitcher({
      objects3D: this.objects3D,
      transitionMachine: new ShapeTransitionMachine({
        width: this.stage.canvas.width,
        height: this.stage.canvas.height,
        duration: TRANSITION_DURATION_MS,
      }),
      buildMesh: (primitive) => this.buildMesh(primitive),
      onTransitionStart: (primitive) => {
        // Selection returns to the mesh row on every shape change (D11):
        // otherwise picking a new primitive leaves KEY_LIGHT highlighted while
        // the object the row describes changes underneath it.
        this.uiState.setState({ sceneSelection: MESH_ROW_ID });
        this.shapeTab.setActivePrimitive(primitive);
        this.animateShapeInfoPanel(primitive);
      },
    });
    this.framerate = new FramerateWidget();
    // Probed once, at boot: whether this page's performance.now() can
    // actually resolve the four-stage split FRAME TIME draws (E6/COS-239).
    // Reprobing per frame would be the exact per-frame cost the sampling gate
    // elsewhere in this ticket exists to avoid, for an answer that only
    // changes if cross-origin isolation itself changes mid-session, which it
    // does not.
    const hasFineClockResolution = probeClockResolutionMs() < CLOCK_RESOLUTION_THRESHOLD_MS;
    this.frameTime = new FrameTimeWidget(this.fields, hasFineClockResolution);
    this.geometry = new GeometryWidget(this.fields);
    this.zBuffer = new ZBufferWidget();
    this.cameraStats = new CameraWidget({ fields: this.fields, camera: this.camera, rig: this.rig });
    this.system = new SystemWidget(this.fields, canvas);
    this.fpsMeter = new FPSMeter(() => performance.now());
    this.loop = new RenderLoop({
      onFrame: (timestamp) => {
        this.renderFrame(timestamp);
        this.publishFrameStats();
      },
      // Both clocks rebase on resume, off one reading so they cannot disagree
      // about when the pause ended. The transition clock is what stops a shape
      // change paused mid-flight from jumping; the frame clock is what stops the
      // rig from spinning the shape by the entire paused duration.
      onStart: () => {
        const now = performance.now();

        this.shapes.syncClock(now);
        this.lastFrameTimestamp = now;
      },
      onStop: () => {
        this.fpsMeter.reset();
        this.renderedTriangles = 0;
        this.fields.write("fps", 0);
        this.publishDrawnTriangles(0);
        // The frame-time ticket's own zeroing (E6/COS-239): a paused console
        // must show no stale stage split, fill rate or draw-call count.
        this.renderStats.zero();
        this.frameTime.reset();
        this.frameTime.render();
        this.geometry.zeroDrawCalls();
        this.geometry.render();
      },
    });

    this.pipeline.bind(this.syncPipelineReadouts);
    this.transport.bindToggle(this.togglePause);
    this.transport.bindReset(this.resetControls);
    this.syncPipelineReadouts();

    // Hiding the mesh has to repaint immediately when the loop is not
    // running; while it is, the next frame already picks it up.
    this.unsubscribe = this.uiState.subscribe(() => {
      const hidden = this.sceneGraph.isMeshHidden();
      if (hidden === this.meshHidden) {
        return;
      }
      this.meshHidden = hidden;
      this.renderPausedFrame();
    });
  }

  // The boot primitive is a defaulted parameter rather than a constant: the
  // registry's first key is the shape the console opens on, and the entry module
  // has no business knowing which one that is.
  public async init(primitive: string = this.shapes.names[0]) {
    await this.textures.load({
      dog: dogUrl,
      galaxy: galaxyUrl,
    });

    // Resolution is written once; it is the only thing left in the HUD that
    // never changes while the console is open. FOV left this list in COS-231 and
    // the three camera readouts left it with the rig. The histogram's 28 bars
    // are the same kind of write — built once, then only their heights change.
    this.viewportHud.seed();
    this.zBuffer.mount();
    this.cameraStats.seed();
    this.system.seed();
    // After the textures resolve: the option thumbnails go through the real
    // rasteriser, so the cube needs its galaxy face to exist first.
    this.shapeTab.paintPrimitiveOptions(new ShapeThumbnails(this.objects3D, this.textures));
    this.shapeTab.syncFromStore();
    // The camera already opens at these values — CameraController seeds itself
    // through the same two mappings — so this is not what puts the first frame
    // at 94°. What it buys is the readouts: the HUD's fov, zoom and dist are
    // written by the push, and nothing else writes them before the first drag.
    this.worldTab.syncFromStore();
    this.syncWorldLayers();
    // Once, before the loop starts. The camera readouts ride a 90ms gate from
    // here on, and without this the HUD and the CAMERA card would open on an em
    // dash for the first tenth of a second.
    this.publishCameraReadouts();
    this.repaintForPrimitive(primitive);
    // Pushed explicitly rather than relying on the markup's seed, so the bar and
    // the transport have one source of truth from the first paint.
    this.syncRunState();
    this.pipeline.syncOpacityAvailability();
    this.shapes.request(primitive);
    this.loop.start();
  }

  // Nothing calls this today — there is one Main per page load and the page
  // outlives it. It exists because a subscription with no teardown is a leak the
  // moment anything reconstructs collaborators, and the handle has to be kept
  // for the teardown to be possible at all.
  public dispose() {
    this.unsubscribe();
    // The one collaborator holding a timer and a media-query listener: every
    // other widget is pure DOM writes and has nothing to release.
    this.system.dispose();
    this.pointerOrbit.dispose();
  }

  // The whole point of this class existing: at the seed 1024x640 canvas, scale
  // is exactly 1 and the centre is exactly what Viewport always gave — so
  // introducing a render target moves nothing today, it only gives a later
  // resize somewhere to land. Thrown rather than logged, because a silent
  // drift here would move every vertex on screen and the console would look
  // wrong without printing why.
  private assertSeedFraming() {
    const { scale, centerX, centerY } = this.renderTarget;

    if (scale !== 1 || centerX !== 512 || centerY !== 320) {
      throw new Error(`RenderTarget seed framing drifted: scale=${scale} centerX=${centerX} centerY=${centerY}.`);
    }
  }

  // The HUD's `dist` is the camera distance, which is fl/k: positive at every
  // reachable combination of the two sliders, and the same number the rig turns
  // into an eye position.
  //
  // Nothing is pushed into the meshes. The projection is one record every vertex
  // already holds, so the write above IS the change — all that is left is the
  // repaint a stopped loop would not otherwise do.
  //
  // A plain method, not an arrow property: nothing hands it to a listener, and
  // R9 spends the bound-this form only where something does.
  private changeZoom(sliderValue: number) {
    this.camera.setZoomFromSlider(sliderValue);
    this.viewportHud.setZoom(sliderValue, this.camera.distance);
    this.renderPausedFrame();
  }

  // Mirrors changeZoom, and has to: the eye distance is fl/k, so a focal change
  // moves the distance readout exactly as a zoom change does — which is why the
  // zoom readout is rewritten here from the slice rather than left to go stale
  // against a distance that just moved under it.
  //
  // What does NOT move is the shape's size at its own centre plane: the
  // magnification is left alone, so this is a dolly zoom rather than a second
  // zoom control.
  private changeFov(degrees: number) {
    this.camera.setFovDegrees(degrees);
    this.viewportHud.setFov(this.camera.fieldOfViewDegrees);
    this.viewportHud.setZoom(this.uiState.getState().zoom ?? DEFAULT_ZOOM_SLIDER_VALUE, this.camera.distance);
    this.renderPausedFrame();
  }

  // Three surfaces print the mode — the HUD chip, the status bar and the CAMERA
  // card's header note — and all three are one FieldWriter write, exactly as the
  // shading label is. What is pushed is the camera's own mode rather than the
  // chip that was clicked, so the console cannot end up describing a projection
  // the renderer is not using.
  private changeProjection(mode: ProjectionMode) {
    this.camera.setProjection(mode);
    this.statusBar.setProjection(this.camera.projectionMode);
    this.renderPausedFrame();
  }

  // The tail every TRANSFORM row shares. A patch rather than four methods,
  // because a slider moves exactly one of the rig's four numbers and the other
  // three must be left alone rather than restated at each call site.
  private changeRig(angles: Partial<RigAngles>) {
    this.rig.setAngles(angles);
    this.renderPausedFrame();
  }

  // Mirrors changeRig, but a drag has no SliderRow of its own already showing
  // the new angle the way a TRANSFORM input does — the rows have to be pushed
  // the numbers PointerOrbit computed, the same way applyViewPreset pushes them
  // mid-ease.
  private applyPointerOrbit(pitch: number, yaw: number) {
    this.rig.setAngles({ pitch, yaw });
    this.shapeTab.setTransformUi(this.rig.angles());
    this.renderPausedFrame();
  }

  // changeZoom alone leaves the ZOOM row and the store exactly where a slider
  // drag would have moved them first — CameraSection.setZoomUi (via WorldTab)
  // is the write-back half a pointer gesture has to supply for itself.
  private applyPointerZoom(sliderValue: number) {
    this.changeZoom(sliderValue);
    this.worldTab.setZoomUi(sliderValue);
  }

  // A camera gesture, so it moves the camera and nothing else. It deliberately
  // leaves the turntable running: rig.reset() would snap the object's attitude
  // too, which reads as the shape jerking for a gesture the user aimed at the
  // viewpoint. Zoom goes through applyPointerZoom rather than changeZoom so its
  // own row follows. Deliberately not resetControls() either: a stray
  // double-tap must not touch shading, materials or toggles — the toolbar RESET
  // stays the only path that restores those.
  private applyPointerReset() {
    // The shared defaults rather than three literal zeros: the toolbar RESET
    // restores them through the store, and a double-tap that landed somewhere
    // else would be the one path in the console disagreeing about where home is.
    this.rig.setAngles({
      pitch: DEFAULT_PITCH_DEGREES,
      yaw: DEFAULT_YAW_DEGREES,
      roll: DEFAULT_ROLL_DEGREES,
    });
    this.shapeTab.setTransformUi(this.rig.angles());
    this.applyPointerZoom(DEFAULT_ZOOM_SLIDER_VALUE);
  }

  // A preset while paused has to repaint, or the chip appears to do nothing —
  // renderPausedFrame is that repaint, and it already returns early while the
  // loop is running, where the next frame picks the change up anyway. The run
  // state goes to the rig as well, which is what decides whether there are
  // frames for the 350ms ease to happen across.
  private applyViewPreset(key: ViewPresetKey) {
    this.rig.applyPreset(key, this.loop.isPlaying);
    // The paused case, where the rig lands immediately and there is no frame to
    // carry the write-back. While the loop runs, renderFrame pushes the rows
    // through the whole ease instead, so the thumbs travel with the shape.
    this.shapeTab.setTransformUi(this.rig.angles());
    this.renderPausedFrame();
  }

  // SKY, FLOOR and GRID are single booleans with two surfaces — this tab's rows
  // and the viewport's quick toggles — so neither surface applies anything
  // itself. Both write the store and raise this, which re-reads the store once
  // and pushes the result to the renderer and back out to both. That is what
  // makes a flip from either end land on the other in the same frame.
  //
  // GRID STEP raises the same callback (COS-246) even though it has no second
  // surface to reconcile: it still has to reach setWorld, and one sync path
  // reading the whole store is simpler than a second one for a single slider.
  private syncWorldLayers() {
    const state = this.uiState.getState();

    this.background.setLayers({
      sky: state.sky ?? DEFAULT_SKY,
      floor: state.floor ?? DEFAULT_FLOOR,
      grid: state.grid ?? DEFAULT_GRID,
      shadow: state.shadow ?? DEFAULT_SHADOW,
    });
    this.background.setWorld({
      fog: state.fog ?? DEFAULT_FOG,
      gridStepMetres: state.gridStep ?? DEFAULT_GRID_STEP,
    });
    this.worldTab.syncEnvironmentUi();
    this.quickToggles.syncFromStore();
    this.renderPausedFrame();
  }

  // Every pipeline change lands on the same three readouts and the same repaint,
  // so one handler replaces the three near-identical tails the two toggles and
  // the opacity slider each carried. The writes are idempotent — a wireframe
  // toggle rewrites the opacity row with the value it already had.
  private syncPipelineReadouts = () => {
    // One modeLabel() behind all three readouts: the status bar writes the word,
    // the HUD writes the data-shading-mode attribute (it drives no styling today
    // — it is the seam de-mock E3 will key real shading off), and SHAPE INFO's
    // SHADING row prints it. Passing the boolean to the first two is interim and
    // is the whole reason the mapping is a shared function — de-mock E3 publishes
    // a shadingMode slice and the argument goes away, without the label table
    // ever having existed twice.
    this.statusBar.setMode(this.pipeline.wireframe);
    this.viewportHud.setMode(this.pipeline.wireframe);
    this.shapeInfo.setShading(this.pipeline.shadingMode);
    this.shapeInfo.setOpacity(this.pipeline.opacity);
    // The pipeline owns the opacity value and its availability — culling being
    // switched on resets it to fully opaque and disables the control — so the
    // row follows it rather than holding a second copy.
    this.shapeTab.setOpacityUi(Math.round(this.pipeline.opacity * 100));
    this.shapeTab.setOpacityDisabled(this.pipeline.getRenderOptions().cullBackfaces);
    // Same reasoning as opacity above, for the RENDER tab's own two real
    // controls: RenderPipelinePanel owns the booleans, this is the one place
    // that pushes them out to whichever surface needs to agree with them.
    this.renderTab.syncPipeline(this.pipeline.wireframe, this.pipeline.cullBackfaces);
    // The viewport's WIRE and CULL pills are the second surface on those same
    // two booleans, so they are pushed from here rather than reading the panel
    // themselves — a flip from either end lands on the other in this frame.
    this.quickToggles.syncPipeline(this.pipeline.wireframe, this.pipeline.cullBackfaces);
    this.renderPausedFrame();
  };

  // Everything a shape change repaints, in one callback. SHAPE INFO's fade
  // wraps this, so the two cards, the scene-graph row and the status bar all
  // change inside the same 180ms boundary rather than 180ms apart.
  private repaintForPrimitive(primitive: string) {
    const object3D = this.objects3D[primitive];
    // Derived once, here — the panel needs the key list, the MATERIAL row and
    // the status bar need the two-value label, and the three must not disagree.
    // Built on primitive change, never on the render path.
    const material = new MaterialSummary(object3D);

    this.sceneGraph.setMeshId(primitive);
    this.statusBar.setSelected(primitive);
    this.statusBar.setTexture(material);
    this.shapeInfo.show(primitive, object3D, material);
    this.shapeInfo.setOpacity(this.pipeline.opacity);
    this.shapeStory.show(primitive, shapeInfo[primitive]);
  }

  private animateShapeInfoPanel(primitive: string) {
    const repaint = () => this.repaintForPrimitive(primitive);

    if (!this.shapes.current) {
      this.shapeInfo.showImmediately(repaint);
      return;
    }

    this.shapeInfo.crossFade(repaint);
  }

  // The rate and the drawn count publish on the same tick, so the two numbers
  // on screen always describe the same frame.
  //
  // The framerate widget's history push is unconditional and runs every call:
  // its 90-sample buffer is 90 rendered frames, not 90 publishes, which is
  // what keeps the header's "90 frames" literal true. Its render() — the DOM
  // writes and the canvas repaint — rides the same throttle as fps below.
  private publishFrameStats() {
    const rate = this.fpsMeter.sample();
    this.framerate.pushSample(this.fpsMeter.rawFps);

    if (rate === null) {
      return;
    }

    this.fields.write("fps", rate);
    this.framerate.render();
    this.frameTime.render();
    this.geometry.render();
    this.zBuffer.render();
    this.publishCameraReadouts();
    this.system.render();
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  // The cap reaches the loop and the framerate card on the same call. The card's
  // DROPPED threshold is a ratio of the target, so a cap the card did not know
  // about would have it counting every frame under the old absolute 40fps floor
  // as dropped — which at a 30fps cap is all of them.
  //
  // Safe to reach this.loop from a RenderTab callback even though the tab is
  // constructed first: nothing calls it until a chip is clicked, and both fields
  // are assigned by the time the constructor returns.
  private applyFrameRateCap(fps: number | null) {
    this.loop.setFrameRateCap(fps);
    this.framerate.setTargetFps(fps);
  }

  // The drawn count reaches the readouts, the telemetry card and the scene
  // graph row through here and nowhere else, so the three cannot disagree.
  private publishDrawnTriangles(count: number) {
    this.fields.write("trisDrawn", count);
    this.uiState.setState({ drawnTriangles: count });
  }

  private buildMesh(primitive: string): Mesh {
    const object3D = this.objects3D[primitive];
    if (!object3D) {
      throw new Error(`Unknown primitive: ${primitive}`);
    }

    const mesh = this.meshFactory.build(object3D);
    // Posed before it is ever drawn. A mesh built mid-transition starts at its
    // authored rest pose, and startTransition runs outside the render path — so
    // without this the incoming shape holds a different attitude from the
    // outgoing one for the first frame of every switch.
    mesh.setTransform(this.rig.meshMatrix());

    return mesh;
  }

  private renderFrame(timestamp: number) {
    if (!this.loop.isPlaying) {
      return;
    }

    // Once per rendered frame, before anything this frame times — the rig's
    // own matrix pass below included (E6/COS-239).
    const timed = this.renderStats.beginFrame();

    this.shapes.update(timestamp);
    this.shapes.syncQueue(timestamp);

    // Read before advance, not after: advance is what clears a finished ease, so
    // a check made afterwards would skip the one frame carrying the angles the
    // preset actually landed on and leave the rows a fraction of a degree short.
    const easingPreset = this.rig.isEasingPreset;

    this.rig.advance(this.elapsedSeconds(timestamp));

    if (easingPreset) {
      this.shapeTab.setTransformUi(this.rig.angles());
    }

    // Posed even while hidden, so showing the mesh again resumes the turn where
    // it would have been rather than where it was hidden.
    this.applyRigToActiveMeshes(timed);

    this.paint(this.shapes.getRenderables(), timed);
    // Every frame, not on the 90ms gate the numeric readouts ride: the gizmo is
    // a picture rather than a number, and E1b makes the viewport draggable.
    this.viewportHud.setGizmo(this.rig.axisScreenDirections());
  }

  private renderPausedFrame() {
    if (this.loop.isPlaying) {
      return;
    }

    const timed = this.renderStats.beginFrame();

    // A paused repaint really does re-pose the mesh now, which is what lets a
    // preset or a slider move the shape while the loop is stopped.
    this.applyRigToActiveMeshes(timed);

    this.paint(this.shapes.getRenderables(), timed);
    this.frameTime.render();
    this.geometry.render();
    this.zBuffer.render();
    this.publishCameraReadouts();
    // The gizmo has no clock of its own while the loop is stopped, so a preset
    // or a slider would leave it pointing at the attitude the shape had before.
    this.viewportHud.setGizmo(this.rig.axisScreenDirections());
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  // getActiveMeshes rather than getRenderables, and the difference matters: the
  // renderables list can hold one mesh twice mid-transition, which the old
  // incremental path would have rotated twice. An absolute matrix makes the call
  // idempotent, so that whole class of bug goes away with the de-duplication.
  //
  // Feeds RenderStats.transformMs directly (E6/COS-239) rather than returning
  // a number for the caller to thread through: TRANSFORM is this loop's own
  // cost plus Mesh.renderMesh's projection pass, and the accumulator is the
  // one place both halves can sum without paint() knowing either exists. timed
  // comes from the same beginFrame() call the whole frame answers to — an
  // unsampled frame must make zero performance.now() calls, this one included.
  private applyRigToActiveMeshes(timed: boolean) {
    const startedAt = timed ? performance.now() : 0;
    const matrix = this.rig.meshMatrix();

    this.shapes.getActiveMeshes().forEach((mesh) => {
      mesh.setTransform(matrix);
    });

    if (timed) {
      this.renderStats.addTransformMs(performance.now() - startedAt);
    }
  }

  // Clamped, so a tab that was in the background for a minute resumes rather
  // than jumping a minute's worth of rotation. rAF hands out timestamps on the
  // same clock as performance.now(), which is what lets the loop's onStart
  // rebase this with a reading of its own.
  private elapsedSeconds(timestamp: number): number {
    const elapsedMs = Math.min(MAX_FRAME_DELTA_MS, timestamp - this.lastFrameTimestamp);

    this.lastFrameTimestamp = timestamp;

    return elapsedMs / MILLISECONDS_PER_SECOND;
  }

  // The HUD's three camera rows and the CAMERA card read one rig through one
  // pair of formatters, so the overlay and the telemetry panel cannot print two
  // different cameras.
  private publishCameraReadouts() {
    this.viewportHud.setCamera(this.rig.eyePosition(this.camera.distance), this.rig.angles(), this.rig.target);
    this.cameraStats.render();
  }

  // Surface3D draws the background before it walks the renderables, so an empty
  // array keeps the sky, floor and vignette and drops only the mesh — and the
  // returned count correctly falls to zero.
  //
  // The registry is merged in here rather than held by the panel: it is the one
  // render option that is not a control, and it is required rather than optional
  // so a missing hand-off is a compile error instead of "dog" painted as a CSS
  // colour.
  private paint(renderables: MeshRenderRequest[], timed: boolean) {
    // The submitted list and the render options are both named rather than
    // inlined because the GEOMETRY card needs them below: it counts what was
    // actually handed to the renderer — a hidden mesh submits nothing — and it
    // reads culling off the same options object the frame was drawn with, so
    // the card cannot describe a different frame than the one on screen.
    const submitted = this.sceneGraph.isMeshHidden() ? [] : renderables;
    const options = { ...this.pipeline.getRenderOptions(), textures: this.textures };

    const stats = this.surface3D.render({
      renderables: submitted,
      options,
      timed,
      cameraTransform: this.rig.viewMatrix(),
    });

    this.renderedTriangles = stats.drawn;
    // Four phases describing one frame because they come from one shared
    // accumulator: applyRigToActiveMeshes' own contribution to transformMs,
    // and everything Surface3D and Mesh added to the other three while
    // walking submitted (E6/COS-239).
    this.frameTime.pushSample({
      transformMs: stats.transformMs,
      clipCullMs: stats.clipCullMs,
      rasterMs: stats.rasterMs,
      presentMs: stats.presentMs,
      fillPx: stats.fillPx,
    });
    this.geometry.pushFrame({
      renderables: submitted,
      submitted: stats.submitted,
      drawn: stats.drawn,
      drawCalls: stats.drawCalls,
      cullBackfaces: options.cullBackfaces,
    });
    this.zBuffer.pushFrame(stats.depthBins, stats.depthNear, stats.depthFar);
  }

  private togglePause = () => {
    this.loop.toggle();
    this.syncRunState();
  };

  private syncRunState() {
    this.statusBar.setRunState(this.loop.isPlaying);
    this.transport.setRunState(this.loop.isPlaying);
  }

  // One handler behind both RESET mounts.
  //
  // Deliberate departure from the design, whose reset() also sets paused:false
  // (L1306): the transport is a session control, not a scene control, and RESET
  // must not restart a loop the user stopped on purpose.
  //
  // resetAll() restores every slice registered in the store. That is what makes
  // RESET coverage automatic — a later ticket registers its slice with its
  // defaults and is restored here without this function being edited.
  private resetControls = () => {
    this.pipeline.reset();
    // The two rig values with no slice of their own: the spin the turntable has
    // wound up, and any preset ease still in flight. The three angles and the
    // spin rate come back through the store below, which is what makes RESET
    // return the shape to the pose it opened on rather than to the same three
    // numbers at a random heading.
    this.rig.reset();
    this.uiState.resetAll();
    // After resetAll, so the rows read the restored defaults — and it re-applies
    // them to the camera, which is what the slider bank's read-back used to do.
    this.shapeTab.syncFromStore();
    this.renderTab.syncFromStore();
    this.worldTab.syncFromStore();
    this.syncWorldLayers();
    this.pipeline.syncOpacityAvailability();
    this.syncPipelineReadouts();
    this.framerate.reset();
  };
}

export default Main;
