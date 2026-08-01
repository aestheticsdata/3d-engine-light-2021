import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import data, { Data3D } from "@data/data";
import shapeInfo from "@data/shapeInfo";
import Mesh from "@primitives/Mesh";
import MeshFactory from "@primitives/MeshFactory";
import Surface3D from "@primitives/Surface3D";
import TextureRegistry from "@textures/TextureRegistry";
import Bootstrapper, { BootContext } from "@app/Bootstrapper";
import FpsMeter from "@app/FpsMeter";
import RenderLoop from "@app/RenderLoop";
import ShapeSwitcher from "@app/ShapeSwitcher";
import CameraController, {
  DEFAULT_PITCH,
  DEFAULT_ROLL,
  DEFAULT_ROTATION_SPEED,
  DEFAULT_YAW,
  DEFAULT_ZOOM_SLIDER_VALUE,
  ROTATION_SPEED_SLIDER_MAX,
} from "@app/CameraController";
import FollowCursorTooltip from "@ui/tooltip";
import FieldWriter from "@ui/FieldWriter";
import { uiState } from "@ui/UiStateStore";
import StatusBar from "@ui/StatusBar";
import ViewportHud from "@ui/ViewportHud";
import ShapeInfoPanel from "@ui/ShapeInfoPanel";
import ShapeStoryPanel from "@ui/ShapeStoryPanel";
import SceneGraphPanel from "@ui/scene/SceneGraphPanel";
import { MESH_ROW_ID } from "@ui/scene/sceneRows";
import MaterialSummary from "@ui/MaterialSummary";
import { modeLabel } from "@ui/modeLabel";
import Controls from "./controls";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";

const TRANSITION_DURATION_MS = 1250;
const OPACITY_SLIDER_MIN = 0;
const OPACITY_SLIDER_MAX = 100;
const DEFAULT_OPACITY_SLIDER_VALUE = 100;

const sliderProgress = (value: number, min: number, max: number): number =>
  (value - min) / (max - min);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

class Main {
  // FPS and the drawn-triangle count no longer resolve a node here: both appear
  // in more than one place in the DOM (toolbar, mobile header, telemetry card),
  // so they go through the writer, which touches every [data-field] node at
  // once. boot() owns the instance because it writes the build labels before
  // Main exists.
  private readonly fields: FieldWriter;
  // Writers only — the bar holds no state of its own. Built in the constructor
  // body rather than here: it needs `fields`, a constructor parameter, and a
  // field initializer runs before the constructor body under
  // useDefineForClassFields, so it would read undefined.
  private readonly statusBar: StatusBar;
  // Needs the canvas, so it is built in the constructor rather than here.
  private readonly viewportHud: ViewportHud;
  private readonly sceneGraph: SceneGraphPanel;
  // A change detector, not a second copy of the state: sceneGraph publishes
  // the drawn count through the same store, so an unguarded subscriber would
  // re-enter renderPausedFrame on its own notification.
  private meshHidden: boolean;
  private readonly pauseBtn: HTMLElement;
  private readonly wireframeBtn: HTMLElement;
  private readonly backfaceCullingBtn: HTMLElement;
  private readonly resetBtn: HTMLElement;
  private readonly opacitySlider: HTMLInputElement;
  private readonly opacityDisabledTooltip: FollowCursorTooltip;
  private readonly shapeInfo: ShapeInfoPanel;
  private readonly shapeStory: ShapeStoryPanel;
  private readonly fpsMeter: FpsMeter;
  private readonly loop: RenderLoop;
  private readonly objects3D: Data3D;
  private readonly stage: CanvasRenderingContext2D;
  private readonly surface3D: Surface3D;
  private readonly meshFactory: MeshFactory;
  private readonly textures: TextureRegistry;
  private readonly camera: CameraController;
  private readonly controls: Controls;
  private readonly shapes: ShapeSwitcher;
  private opacity: number;
  private wireframeEnabled: boolean;
  private backfaceCullingEnabled: boolean;
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

    const pauseBtn = document.getElementById("playPause");
    const wireframeBtn = document.getElementById("toggleWireframe");
    const backfaceCullingBtn = document.getElementById("toggleBackfaceCulling");
    const resetBtn = document.getElementById("resetControls");
    const opacitySlider = document.getElementById("opacitySlider");
    if (
      !pauseBtn ||
      !wireframeBtn ||
      !backfaceCullingBtn ||
      !resetBtn ||
      !(opacitySlider instanceof HTMLInputElement)
    ) {
      throw new Error("UI controls are missing.");
    }

    this.fields = fields;
    this.statusBar = new StatusBar(this.fields);
    this.controls = new Controls();
    this.viewportHud = new ViewportHud(canvas, this.fields);
    this.sceneGraph = new SceneGraphPanel(uiState);
    this.meshHidden = this.sceneGraph.isMeshHidden();
    this.stage = stage;
    this.surface3D = new Surface3D(this.stage, backgroundRenderer);
    this.camera = new CameraController(canvas);
    this.meshFactory = new MeshFactory();
    this.textures = new TextureRegistry();
    this.objects3D = data;
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
        uiState.setState({ sceneSelection: MESH_ROW_ID });
        this.animateShapeInfoPanel(primitive);
      },
    });
    this.opacity = 1;
    this.wireframeEnabled = false;
    this.backfaceCullingEnabled = true;
    this.renderedTriangles = 0;
    this.pauseBtn = pauseBtn;
    this.wireframeBtn = wireframeBtn;
    this.backfaceCullingBtn = backfaceCullingBtn;
    this.resetBtn = resetBtn;
    this.opacitySlider = opacitySlider;
    this.opacityDisabledTooltip = new FollowCursorTooltip({
      target: this.opacitySlider,
      message: "Turn backface culling off to adjust opacity.",
      shouldShow: () => this.opacitySlider.disabled,
    });
    this.shapeInfo = new ShapeInfoPanel();
    this.shapeStory = new ShapeStoryPanel();
    this.fpsMeter = new FpsMeter(() => performance.now());
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

    // Transport and RESET each have two mounts — the desktop strip and the
    // mobile header / RESET SCENE bar — because there is one DOM tree and
    // neither control can be in two parents at once. Binding by attribute keeps
    // it one handler and no second code path.
    document
      .querySelectorAll<HTMLElement>("[data-transport='toggle']")
      .forEach((node) => node.addEventListener("click", this.togglePause));
    document
      .querySelectorAll<HTMLElement>("[data-action='reset']")
      .forEach((node) => node.addEventListener("click", this.resetControls));
    this.wireframeBtn.addEventListener("click", this.toggleWireframe);
    this.backfaceCullingBtn.addEventListener(
      "click",
      this.toggleBackfaceCulling,
    );
    this.syncToggleButtons();

    // Hiding the mesh has to repaint immediately when the loop is not
    // running; while it is, the next frame already picks it up.
    uiState.subscribe(() => {
      const hidden = this.sceneGraph.isMeshHidden();
      if (hidden === this.meshHidden) {
        return;
      }
      this.meshHidden = hidden;
      this.renderPausedFrame();
    });
  }

  // The HUD's `dist` is the camera distance, not the raw offset: the offset
  // alone runs 260 -> -220 across the slider and would print a negative
  // distance. Focal plus offset stays positive throughout (560 -> 80).
  private changeZoom = (sliderValue: number) => {
    this.camera.setZoomFromSlider(sliderValue);
    this.viewportHud.setZoom(sliderValue, this.camera.distance);
    this.applyCameraSettingsToActiveMeshes();
    this.renderPausedFrame();
  };

  private changePitch = (pitch: number) => {
    this.camera.setPitch(pitch);
  };

  private changeYaw = (yaw: number) => {
    this.camera.setYaw(yaw);
  };

  private changeRoll = (roll: number) => {
    this.camera.setRoll(roll);
  };

  private changeRotationSpeed = (rotationSpeed: number) => {
    this.camera.setRotationSpeed(rotationSpeed);
  };
  private changeOpacity = (sliderValue: number) => {
    const progress = clamp(
      sliderProgress(sliderValue, OPACITY_SLIDER_MIN, OPACITY_SLIDER_MAX),
      0,
      1,
    );
    this.opacity = progress;
    this.shapeInfo.setOpacity(this.opacity);
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
    this.shapeInfo.setOpacity(this.opacity);
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
  private publishFrameStats() {
    const rate = this.fpsMeter.sample();

    if (rate === null) {
      return;
    }

    this.fields.write("fps", rate);
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  // The drawn count reaches the readouts, the telemetry card and the scene
  // graph row through here and nowhere else, so the three cannot disagree.
  private publishDrawnTriangles(count: number) {
    this.fields.write("trisDrawn", count);
    uiState.setState({ drawnTriangles: count });
  }

  private applyCameraSettings(mesh: Mesh) {
    this.camera.applyTo(mesh);
  }

  private applyCameraSettingsToActiveMeshes() {
    this.shapes
      .getActiveMeshes()
      .forEach((mesh) => this.applyCameraSettings(mesh));
  }

  private buildMesh(primitive: string): Mesh {
    const object3D = this.objects3D[primitive];
    if (!object3D) {
      throw new Error(`Unknown primitive: ${primitive}`);
    }

    const mesh = this.meshFactory.build(object3D);
    this.applyCameraSettings(mesh);

    return mesh;
  }

  private rotateMesh(mesh: Mesh) {
    this.camera.rotate(mesh);
  }




  private renderFrame(timestamp: number) {
    if (!this.loop.isPlaying) {
      return;
    }

    this.shapes.update(timestamp);
    this.shapes.syncQueue(timestamp);

    const renderables = this.getCurrentRenderables();
    // Rotated even while hidden, so showing the mesh again resumes the spin
    // where it would have been rather than where it was hidden.
    renderables.forEach((renderable) => this.rotateMesh(renderable.mesh));
    // Surface3D draws the background before it walks the renderables, so an
    // empty array keeps the sky, floor and vignette and drops only the mesh —
    // and the returned count correctly falls to zero.
    this.renderedTriangles = this.surface3D.render(
      this.visibleRenderables(renderables),
      {
        textures: this.textures,
        wireframe: this.wireframeEnabled,
        cullBackfaces: this.backfaceCullingEnabled,
        opacity: this.opacity,
      },
    );
  }

  private renderPausedFrame() {
    if (this.loop.isPlaying) {
      return;
    }

    this.renderedTriangles = this.surface3D.render(
      this.visibleRenderables(this.getCurrentRenderables()),
      {
        textures: this.textures,
        wireframe: this.wireframeEnabled,
        cullBackfaces: this.backfaceCullingEnabled,
        opacity: this.opacity,
      },
    );
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  private togglePause = () => {
    this.loop.toggle();
    this.syncTransportMounts();
  };

  private syncTransportMounts() {
    this.statusBar.setRunState(this.loop.isPlaying);
    const label = this.loop.isPlaying ? "PAUSE" : "RESUME";
    document
      .querySelectorAll<HTMLElement>("[data-transport='toggle']")
      .forEach((node) => {
        node.textContent = label;
      });

    // The REC dot claims a running render loop; freeze and dim it when there
    // isn't one.
    document
      .querySelectorAll<HTMLElement>(".readout__dot")
      .forEach((node) => node.classList.toggle("is-paused", !this.loop.isPlaying));
  }

  private syncToggleButtons() {
    // One modeLabel() behind all three readouts: the status bar writes the word,
    // the HUD writes the attribute that keys the canvas filter, and SHAPE INFO's
    // SHADING row prints it. Passing the boolean is interim and is the whole
    // reason the mapping is a shared function — the RENDER tab ticket publishes
    // a shadingMode slice and the argument goes away, without the label table
    // ever having existed twice.
    this.statusBar.setMode(this.wireframeEnabled);
    this.viewportHud.setMode(this.wireframeEnabled);
    this.shapeInfo.setShading(modeLabel(this.wireframeEnabled));
    // The segmented control paints both halves at all times and .is-on decides
    // which one lights, so the flag is the whole binding: no word to write, and
    // nothing for the row or the label to do. The old text wrote the action
    // rather than the state, which is why the two disagreed at every default.
    this.wireframeBtn.classList.toggle("is-on", this.wireframeEnabled);
    this.backfaceCullingBtn.classList.toggle(
      "is-on",
      this.backfaceCullingEnabled,
    );
  }

  private toggleWireframe = () => {
    this.wireframeEnabled = !this.wireframeEnabled;
    this.syncToggleButtons();
    this.renderPausedFrame();
  };

  private toggleBackfaceCulling = () => {
    this.backfaceCullingEnabled = !this.backfaceCullingEnabled;
    this.syncToggleButtons();
    if (this.backfaceCullingEnabled) {
      this.controls.setNumericValue(
        "#opacitySlider",
        DEFAULT_OPACITY_SLIDER_VALUE,
      );
      this.changeOpacity(DEFAULT_OPACITY_SLIDER_VALUE);
    }
    this.syncOpacitySliderAvailability();
    this.renderPausedFrame();
  };


  private visibleRenderables(renderables: ReturnType<Main["getCurrentRenderables"]>) {
    return this.sceneGraph.isMeshHidden() ? [] : renderables;
  }

  private getCurrentRenderables() {
    return this.shapes.getRenderables();
  }

  private attachControlListeners() {
    this.controls.attachListener("#zoomSlider", this.changeZoom);
    this.controls.attachListener("#pitchSlider", this.changePitch);
    this.controls.attachListener("#yawSlider", this.changeYaw);
    this.controls.attachListener("#rollSlider", this.changeRoll);
    this.controls.attachListener("#opacitySlider", this.changeOpacity);
    this.controls.attachListener(
      "#rotationSpeedSlider",
      this.changeRotationSpeed,
    );
  }

  private applyDefaultControlValues() {
    this.controls.setNumericValue("#zoomSlider", DEFAULT_ZOOM_SLIDER_VALUE);
    this.controls.setNumericValue("#pitchSlider", DEFAULT_PITCH);
    this.controls.setNumericValue("#yawSlider", DEFAULT_YAW);
    this.controls.setNumericValue("#rollSlider", DEFAULT_ROLL);
    this.controls.setNumericValue(
      "#opacitySlider",
      DEFAULT_OPACITY_SLIDER_VALUE,
    );
    this.controls.setNumericValue(
      "#rotationSpeedSlider",
      clamp(DEFAULT_ROTATION_SPEED, 0, ROTATION_SPEED_SLIDER_MAX),
    );
  }

  private syncSettingsFromControls() {
    this.changeZoom(
      this.controls.getNumericValue("#zoomSlider") ??
        DEFAULT_ZOOM_SLIDER_VALUE,
    );
    this.camera.setPitch(this.controls.getNumericValue("#pitchSlider"));
    this.camera.setYaw(this.controls.getNumericValue("#yawSlider"));
    this.camera.setRoll(this.controls.getNumericValue("#rollSlider"));
    this.changeOpacity(
      this.controls.getNumericValue("#opacitySlider") ??
        DEFAULT_OPACITY_SLIDER_VALUE,
    );
    this.camera.setRotationSpeed(
      this.controls.getNumericValue("#rotationSpeedSlider"),
    );
  }

  // One handler behind both RESET mounts.
  //
  // Deliberate departure from the design, whose reset() also sets paused:false
  // (L1306): the transport is a session control, not a scene control, and RESET
  // must not restart a loop the user stopped on purpose.
  //
  // resetAll() restores every slice registered in uiState. That is what makes
  // RESET coverage automatic — a later ticket registers its slice with its
  // defaults and is restored here without this function being edited.
  private resetControls = () => {
    this.wireframeEnabled = false;
    this.backfaceCullingEnabled = true;
    this.syncToggleButtons();
    this.applyDefaultControlValues();
    this.syncSettingsFromControls();
    this.syncOpacitySliderAvailability();
    uiState.resetAll();
    this.renderPausedFrame();
  };

  private syncOpacitySliderAvailability() {
    this.opacitySlider.disabled = this.backfaceCullingEnabled;
    this.opacityDisabledTooltip.hide();
  }

  public async init(primitive: string) {
    await this.textures.load({
      dog: dogUrl,
      galaxy: galaxyUrl,
    });

    this.controls.createSelectButton(
      this.shapes.names,
      this.shapes.request,
    );
    // Resolution and the four camera placeholders are written once: none of
    // them changes while the console is open.
    this.viewportHud.seed();
    this.applyDefaultControlValues();
    this.attachControlListeners();
    this.syncSettingsFromControls();
    this.repaintForPrimitive(primitive);
    // Pushed explicitly rather than relying on the markup's seed, so the bar has
    // one source of truth from the first paint.
    this.statusBar.setRunState(this.loop.isPlaying);
    this.syncOpacitySliderAvailability();
    this.shapes.request(primitive);
    this.loop.start();
  }
}

new Bootstrapper()
  .run()
  .then((context) => new Main(context).init(Object.keys(data)[0]));
