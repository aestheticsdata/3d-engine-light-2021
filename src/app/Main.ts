// The composition root: it owns the collaborators, wires them to one another,
// and owns the render path they all feed.
//
// What is left here is what genuinely crosses widget boundaries. A shape change
// repaints four surfaces that must change together; a pipeline change writes
// three readouts that must agree; the frame publishes two numbers that must
// describe the same frame. Everything that belonged to one widget has gone to
// that widget.

import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import CameraController from "@app/CameraController";
import FPSMeter from "@app/FPSMeter";
import RenderLoop from "@app/RenderLoop";
import ShapeSwitcher from "@app/ShapeSwitcher";
import data from "@data/data";
import shapeInfo from "@data/shapeInfo";
import MeshFactory from "@primitives/MeshFactory";
import Surface3D from "@primitives/Surface3D";
import Viewport from "@primitives/Viewport";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";
import TextureRegistry from "@textures/TextureRegistry";
import RenderTab from "@ui/inspector/RenderTab";
import ShapeTab from "@ui/inspector/ShapeTab";
import ShapeThumbnails from "@ui/inspector/ShapeThumbnails";
import MaterialSummary from "@ui/MaterialSummary";
import { impliesWireframe } from "@ui/modeLabel";
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
import type { Data3D } from "@data/data";
import type Mesh from "@primitives/Mesh";
import type { MeshRenderRequest } from "@primitives/Surface3D";
import type FieldWriter from "@ui/FieldWriter";

const TRANSITION_DURATION_MS = 1250;

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
  private readonly transport: TransportBar;
  private readonly shapeTab: ShapeTab;
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
  private readonly meshFactory: MeshFactory;
  private readonly textures: TextureRegistry;
  private readonly camera: CameraController;
  private readonly shapes: ShapeSwitcher;
  private readonly unsubscribe: () => void;
  // A change detector, not a second copy of the state: this class publishes the
  // drawn count through the same store it subscribes to, so an unguarded
  // subscriber would re-enter renderPausedFrame on its own notification.
  private meshHidden: boolean;
  private renderedTriangles: number;

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
    this.surface3D = new Surface3D(this.stage, backgroundRenderer);
    this.camera = new CameraController(canvas);
    // The projection centre, resolved once from the canvas the Bootstrapper
    // already handed over, and shared by every point of every mesh built here.
    this.meshFactory = new MeshFactory(new Viewport(canvas));
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
      onPitch: (value) => this.camera.setPitch(value),
      onYaw: (value) => this.camera.setYaw(value),
      onRoll: (value) => this.camera.setRoll(value),
      onSpin: (value) => this.camera.setRotationSpeed(value),
      onZoom: (value) => this.changeZoom(value),
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
    });
    this.transport = new TransportBar();
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
    this.frameTime = new FrameTimeWidget(this.fields);
    this.geometry = new GeometryWidget(this.fields);
    this.zBuffer = new ZBufferWidget();
    this.cameraStats = new CameraWidget(this.fields, this.camera, canvas);
    this.system = new SystemWidget(this.fields, canvas);
    this.fpsMeter = new FPSMeter(() => performance.now());
    this.loop = new RenderLoop({
      onFrame: (timestamp) => {
        this.renderFrame(timestamp);
        this.publishFrameStats();
      },
      // Re-syncing the transition clock on resume is what stops a shape change
      // paused mid-flight from jumping when the loop restarts.
      onStart: () => this.shapes.syncClock(performance.now()),
      onStop: () => {
        this.fpsMeter.reset();
        this.renderedTriangles = 0;
        this.fields.write("fps", 0);
        this.publishDrawnTriangles(0);
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

    // Resolution and the four camera placeholders are written once: none of
    // them changes while the console is open. The histogram's 28 bars are the
    // same kind of write — built once, then only their heights change.
    this.viewportHud.seed();
    this.zBuffer.mount();
    this.cameraStats.seed();
    this.system.seed();
    // After the textures resolve: the option thumbnails go through the real
    // rasteriser, so the cube needs its galaxy face to exist first.
    this.shapeTab.paintPrimitiveOptions(new ShapeThumbnails(this.objects3D, this.textures));
    this.shapeTab.syncFromStore();
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
  }

  // The HUD's `dist` is the camera distance, not the raw offset: the offset
  // alone runs 260 -> -220 across the slider and would print a negative
  // distance. Focal plus offset stays positive throughout (560 -> 80).
  private changeZoom = (sliderValue: number) => {
    this.camera.setZoomFromSlider(sliderValue);
    this.viewportHud.setZoom(sliderValue, this.camera.distance);
    this.shapes.getActiveMeshes().forEach((mesh) => {
      this.camera.applyTo(mesh);
    });
    this.renderPausedFrame();
  };

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
    this.cameraStats.render();
    this.system.render();
    this.publishDrawnTriangles(this.renderedTriangles);
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
    this.camera.applyTo(mesh);

    return mesh;
  }

  private renderFrame(timestamp: number) {
    if (!this.loop.isPlaying) {
      return;
    }

    this.shapes.update(timestamp);
    this.shapes.syncQueue(timestamp);

    const renderables = this.shapes.getRenderables();
    // Rotated even while hidden, so showing the mesh again resumes the spin
    // where it would have been rather than where it was hidden.
    //
    // Timed here rather than inside CameraController: the phase the FRAME TIME
    // card calls TRANSFORM is this whole loop over the active meshes, and only
    // the caller of the loop knows where it begins and ends.
    const transformStartedAt = performance.now();
    renderables.forEach((renderable) => {
      this.camera.rotate(renderable.mesh);
    });
    this.paint(renderables, performance.now() - transformStartedAt);
  }

  private renderPausedFrame() {
    if (this.loop.isPlaying) {
      return;
    }

    // Zero transform, and that is the truth rather than a gap: a paused repaint
    // re-paints the frame, it does not re-rotate it.
    this.paint(this.shapes.getRenderables(), 0);
    this.frameTime.render();
    this.geometry.render();
    this.zBuffer.render();
    this.cameraStats.render();
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  // Surface3D draws the background before it walks the renderables, so an empty
  // array keeps the sky, floor and vignette and drops only the mesh — and the
  // returned count correctly falls to zero.
  //
  // The registry is merged in here rather than held by the panel: it is the one
  // render option that is not a control, and it is required rather than optional
  // so a missing hand-off is a compile error instead of "dog" painted as a CSS
  // colour.
  private paint(renderables: MeshRenderRequest[], transformMs: number) {
    // The submitted list and the render options are both named rather than
    // inlined because the GEOMETRY card needs them below: it counts what was
    // actually handed to the renderer — a hidden mesh submits nothing — and it
    // reads culling off the same options object the frame was drawn with, so
    // the card cannot describe a different frame than the one on screen.
    const submitted = this.sceneGraph.isMeshHidden() ? [] : renderables;
    const options = { ...this.pipeline.getRenderOptions(), textures: this.textures };

    const stats = this.surface3D.render(submitted, options);

    this.renderedTriangles = stats.triangles;
    // The three phases describe one frame because they come from one frame: the
    // transform this class timed, and the two passes Surface3D timed around its
    // own boundary.
    this.frameTime.pushSample({
      transformMs,
      backgroundMs: stats.backgroundMs,
      rasterMs: stats.rasterMs,
    });
    this.geometry.pushFrame(submitted, this.renderedTriangles, options.cullBackfaces);
    this.zBuffer.pushFrame(submitted);
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
    this.uiState.resetAll();
    // After resetAll, so the rows read the restored defaults — and it re-applies
    // them to the camera, which is what the slider bank's read-back used to do.
    this.shapeTab.syncFromStore();
    this.renderTab.syncFromStore();
    this.pipeline.syncOpacityAvailability();
    this.syncPipelineReadouts();
    this.framerate.reset();
  };
}

export default Main;
