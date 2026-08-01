import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import data, { Data3D } from "@data/data";
import shapeInfo, { ShapeReference } from "@data/shapeInfo";
import Matrix3D from "@primitives/Matrix3D";
import Mesh from "@primitives/Mesh";
import Point3D from "@primitives/Point3D";
import Surface3D from "@primitives/Surface3D";
import Triangle from "@primitives/Triangle";
import { loadTextures } from "@textures/textures";
import BackgroundRenderer from "@rendering/BackgroundRenderer";
import FollowCursorTooltip from "@ui/tooltip";
import { setField } from "@ui/fields";
import { createTabGroup } from "@ui/tabs";
import { resetAll, setState, subscribe } from "@ui/uiState";
import { BUILD_LABEL_DESKTOP, BUILD_LABEL_MOBILE } from "@ui/buildInfo";
import { createStatusBar } from "@ui/statusBar";
import { createViewportHud, ViewportHud } from "@ui/viewportHud";
import {
  createSceneGraph,
  isMeshHidden,
  MESH_ROW_ID,
  SceneGraph,
} from "@ui/sceneGraph";
import { textureKeys } from "@ui/texLabel";
import Controls from "./controls";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";
import skyUrl from "./img/sky.avif";

const TRANSITION_DURATION_MS = 1250;
const PITCH_YAW_ROTATION_DIVISOR = 110;
const ROLL_ROTATION_DIVISOR = 500;
const DEFAULT_FOCAL_LENGTH = 300;
const ZOOM_SLIDER_MIN = 0;
const ZOOM_SLIDER_MAX = 100;
const DEFAULT_ZOOM_SLIDER_VALUE = 50;
const ZOOM_ZOFFSET_FAR = 260;
const ZOOM_ZOFFSET_NEAR = -220;
const DEFAULT_PITCH = 400;
const DEFAULT_YAW = 400;
const DEFAULT_ROLL = 200;
const DEFAULT_ROTATION_SPEED = 200;
const ROTATION_SPEED_SLIDER_MAX = 2000;
const OPACITY_SLIDER_MIN = 0;
const OPACITY_SLIDER_MAX = 100;
const DEFAULT_OPACITY_SLIDER_VALUE = 100;
const FPS_DISPLAY_UPDATE_INTERVAL_MS = 90;
const FPS_SMOOTHING_FACTOR = 0.2;
const SHAPE_INFO_PANEL_FADE_DURATION_MS = 180;

const sliderProgress = (value: number, min: number, max: number): number =>
  (value - min) / (max - min);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const sliderToZoomOffset = (sliderValue: number): number => {
  const progress = clamp(
    sliderProgress(sliderValue, ZOOM_SLIDER_MIN, ZOOM_SLIDER_MAX),
    0,
    1,
  );

  return lerp(ZOOM_ZOFFSET_FAR, ZOOM_ZOFFSET_NEAR, progress);
};

const loadImageAsset = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image asset: ${src}`));
    image.src = src;
  });

class Main {
  private readonly times: number[];
  private fps: number;
  // FPS and the drawn-triangle count no longer resolve a node here: both appear
  // in more than one place in the DOM (toolbar, mobile header, telemetry card),
  // so they go through setField, which writes every [data-field] node at once.
  // Writers only — the bar holds no state of its own.
  private readonly statusBar = createStatusBar();
  // Needs the canvas, so it is built in the constructor rather than here.
  private readonly viewportHud: ViewportHud;
  private readonly sceneGraph: SceneGraph;
  // A change detector, not a second copy of the state: sceneGraph publishes
  // the drawn count through the same store, so an unguarded subscriber would
  // re-enter renderPausedFrame on its own notification.
  private meshHidden: boolean;
  private readonly pauseBtn: HTMLElement;
  private readonly shapeInfoPanelContent: HTMLElement;
  private readonly shapeInfoNameNode: HTMLElement;
  private readonly shapeInfoPointsNode: HTMLElement;
  private readonly shapeInfoTrianglesNode: HTMLElement;
  private readonly shapeInfoTexturesNode: HTMLElement;
  private readonly shapeInfoOpacityNode: HTMLElement;
  private readonly shapeStoryTitleNode: HTMLElement;
  private readonly shapeStoryDescriptionNode: HTMLElement;
  private readonly shapeStoryFeatureNode: HTMLElement;
  private readonly shapeStoryDensityNode: HTMLElement;
  private readonly shapeStoryReferencesNode: HTMLElement;
  private readonly wireframeBtn: HTMLElement;
  private readonly backfaceCullingBtn: HTMLElement;
  private readonly resetBtn: HTMLElement;
  private readonly opacitySlider: HTMLInputElement;
  private readonly opacityDisabledTooltip: FollowCursorTooltip;
  private shapeInfoPanelFadeTimeoutId: number | null;
  private requestAnimationID: number;
  private isPlaying: boolean;
  private readonly objects3D: Data3D;
  private readonly primitivesName: string[];
  private readonly stage: CanvasRenderingContext2D;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly surface3D: Surface3D;
  private readonly matrix3D: Matrix3D;
  private readonly controls: Controls;
  private readonly transitionMachine: ShapeTransitionMachine;
  private focal: number;
  private zOffset: number;
  private pitch: number;
  private yaw: number;
  private roll: number;
  private rotationSpeed: number;
  private opacity: number;
  private wireframeEnabled: boolean;
  private backfaceCullingEnabled: boolean;
  private renderedTriangles: number;
  private smoothedFps: number;
  private lastFpsDisplayUpdateAt: number;
  private currentPrimitiveName: string | null;
  private targetPrimitiveName: string | null;
  private queuedPrimitiveName: string | null;

  constructor(backgroundRenderer: BackgroundRenderer | null) {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas element not found.");
    }

    const stage = canvas.getContext("2d");
    if (!stage) {
      throw new Error("2D canvas context is not available.");
    }

    const pauseBtn = document.getElementById("playPause");
    const shapeInfoPanelContent = document.getElementById("shapeInfoPanelContent");
    const shapeInfoNameNode = document.getElementById("shapeInfoName");
    const shapeInfoPointsNode = document.getElementById("shapeInfoPoints");
    const shapeInfoTrianglesNode = document.getElementById("shapeInfoTriangles");
    const shapeInfoTexturesNode = document.getElementById("shapeInfoTextures");
    const shapeInfoOpacityNode = document.getElementById("shapeInfoOpacity");
    const shapeStoryTitleNode = document.getElementById("shapeStoryTitle");
    const shapeStoryDescriptionNode = document.getElementById("shapeStoryDescription");
    const shapeStoryFeatureNode = document.getElementById("shapeStoryFeature");
    const shapeStoryDensityNode = document.getElementById("shapeStoryDensity");
    const shapeStoryReferencesNode = document.getElementById("shapeStoryReferences");
    const wireframeBtn = document.getElementById("toggleWireframe");
    const backfaceCullingBtn = document.getElementById("toggleBackfaceCulling");
    const resetBtn = document.getElementById("resetControls");
    const opacitySlider = document.getElementById("opacitySlider");
    if (
      !pauseBtn ||
      !shapeInfoPanelContent ||
      !shapeInfoNameNode ||
      !shapeInfoPointsNode ||
      !shapeInfoTrianglesNode ||
      !shapeInfoTexturesNode ||
      !shapeInfoOpacityNode ||
      !shapeStoryTitleNode ||
      !shapeStoryDescriptionNode ||
      !shapeStoryFeatureNode ||
      !shapeStoryDensityNode ||
      !shapeStoryReferencesNode ||
      !wireframeBtn ||
      !backfaceCullingBtn ||
      !resetBtn ||
      !(opacitySlider instanceof HTMLInputElement)
    ) {
      throw new Error("UI controls are missing.");
    }

    this.controls = new Controls();
    this.viewportHud = createViewportHud(canvas);
    this.sceneGraph = createSceneGraph();
    this.meshHidden = isMeshHidden();
    this.stage = stage;
    this.centerX = this.stage.canvas.width >> 1;
    this.centerY = this.stage.canvas.height >> 1;
    this.surface3D = new Surface3D(this.stage, backgroundRenderer);
    this.matrix3D = new Matrix3D();
    this.transitionMachine = new ShapeTransitionMachine({
      width: this.stage.canvas.width,
      height: this.stage.canvas.height,
      duration: TRANSITION_DURATION_MS,
    });
    this.objects3D = data;
    this.primitivesName = Object.keys(this.objects3D);
    this.pitch = DEFAULT_PITCH;
    this.yaw = DEFAULT_YAW;
    this.roll = DEFAULT_ROLL;
    this.rotationSpeed = DEFAULT_ROTATION_SPEED;
    this.opacity = 1;
    this.wireframeEnabled = false;
    this.backfaceCullingEnabled = true;
    this.renderedTriangles = 0;
    this.focal = DEFAULT_FOCAL_LENGTH;
    this.zOffset = sliderToZoomOffset(DEFAULT_ZOOM_SLIDER_VALUE);
    this.times = [];
    this.fps = 0;
    this.smoothedFps = 0;
    this.lastFpsDisplayUpdateAt = 0;
    this.pauseBtn = pauseBtn;
    this.shapeInfoPanelContent = shapeInfoPanelContent;
    this.shapeInfoNameNode = shapeInfoNameNode;
    this.shapeInfoPointsNode = shapeInfoPointsNode;
    this.shapeInfoTrianglesNode = shapeInfoTrianglesNode;
    this.shapeInfoTexturesNode = shapeInfoTexturesNode;
    this.shapeInfoOpacityNode = shapeInfoOpacityNode;
    this.shapeStoryTitleNode = shapeStoryTitleNode;
    this.shapeStoryDescriptionNode = shapeStoryDescriptionNode;
    this.shapeStoryFeatureNode = shapeStoryFeatureNode;
    this.shapeStoryDensityNode = shapeStoryDensityNode;
    this.shapeStoryReferencesNode = shapeStoryReferencesNode;
    this.wireframeBtn = wireframeBtn;
    this.backfaceCullingBtn = backfaceCullingBtn;
    this.resetBtn = resetBtn;
    this.opacitySlider = opacitySlider;
    this.opacityDisabledTooltip = new FollowCursorTooltip({
      target: this.opacitySlider,
      message: "Turn backface culling off to adjust opacity.",
      shouldShow: () => this.opacitySlider.disabled,
    });
    this.shapeInfoPanelFadeTimeoutId = null;
    this.requestAnimationID = 0;
    this.isPlaying = true;
    this.currentPrimitiveName = null;
    this.targetPrimitiveName = null;
    this.queuedPrimitiveName = null;

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
    subscribe(() => {
      const hidden = isMeshHidden();
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
    this.zOffset = sliderToZoomOffset(sliderValue);
    this.viewportHud.setZoom(sliderValue, this.focal + this.zOffset);
    this.applyCameraSettingsToActiveMeshes();
    this.renderPausedFrame();
  };

  private changePitch = (pitch: number) => (this.pitch = pitch);
  private changeYaw = (yaw: number) => (this.yaw = yaw);
  private changeRoll = (roll: number) => (this.roll = roll);
  private changeRotationSpeed = (rotationSpeed: number) =>
    (this.rotationSpeed = rotationSpeed);
  private changeOpacity = (sliderValue: number) => {
    const progress = clamp(
      sliderProgress(sliderValue, OPACITY_SLIDER_MIN, OPACITY_SLIDER_MAX),
      0,
      1,
    );
    this.opacity = progress;
    this.syncShapeInfoOpacity();
    this.renderPausedFrame();
  };

  private formatPrimitiveName(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private syncShapeInfoOpacity() {
    this.shapeInfoOpacityNode.textContent = `${Math.round(this.opacity * 100)}%`;
  }

  private syncShapeInfoPanel(primitive: string) {
    const object3D = this.objects3D[primitive];
    const info = shapeInfo[primitive];
    // Derived once, in @ui/texLabel — the panel needs the key list and the
    // status bar needs the two-value label, and they must not disagree.
    const texturedMaterials = textureKeys(object3D);

    this.sceneGraph.setMeshId(primitive);
    this.statusBar.setSelected(primitive);
    this.statusBar.setTexture(object3D);

    this.shapeInfoNameNode.textContent = this.formatPrimitiveName(primitive);
    this.shapeInfoPointsNode.textContent = String(object3D.points.length);
    this.shapeInfoTrianglesNode.textContent = String(object3D.triangles.length);
    this.shapeInfoTexturesNode.textContent =
      texturedMaterials.length > 0 ? texturedMaterials.join(", ") : "none";
    this.syncShapeInfoOpacity();

    if (!info) {
      this.shapeStoryTitleNode.textContent = this.formatPrimitiveName(primitive);
      this.shapeStoryDescriptionNode.textContent = "";
      this.shapeStoryFeatureNode.textContent = "";
      this.shapeStoryDensityNode.textContent = "";
      this.syncShapeReferences();
      return;
    }

    this.shapeStoryTitleNode.textContent = info.title;
    this.shapeStoryDescriptionNode.textContent = info.description;
    this.shapeStoryFeatureNode.textContent = info.geometricFeature;
    this.shapeStoryDensityNode.textContent = info.densityLabel;
    this.syncShapeReferences(info.references);
  }

  // Opened in a new tab so the running animation is never torn down; noopener
  // keeps the opened page from reaching back through window.opener.
  private syncShapeReferences(references: ShapeReference[] = []) {
    this.shapeStoryReferencesNode.replaceChildren();

    references.forEach((reference) => {
      const link = document.createElement("a");
      link.className = "storyLink";
      link.href = reference.url;
      link.textContent = reference.label;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      this.shapeStoryReferencesNode.appendChild(link);
    });
  }

  private animateShapeInfoPanel(primitive: string) {
    if (this.shapeInfoPanelFadeTimeoutId !== null) {
      window.clearTimeout(this.shapeInfoPanelFadeTimeoutId);
      this.shapeInfoPanelFadeTimeoutId = null;
    }

    if (!this.currentPrimitiveName) {
      this.shapeInfoPanelContent.classList.remove("panelFadeOut", "panelFadeIn");
      this.syncShapeInfoPanel(primitive);
      return;
    }

    this.shapeInfoPanelContent.classList.remove("panelFadeIn");
    // Restart the fade-out animation if changes happen quickly.
    void this.shapeInfoPanelContent.offsetWidth;
    this.shapeInfoPanelContent.classList.add("panelFadeOut");

    this.shapeInfoPanelFadeTimeoutId = window.setTimeout(() => {
      this.syncShapeInfoPanel(primitive);
      this.shapeInfoPanelContent.classList.remove("panelFadeOut");
      void this.shapeInfoPanelContent.offsetWidth;
      this.shapeInfoPanelContent.classList.add("panelFadeIn");
      this.shapeInfoPanelFadeTimeoutId = null;
    }, SHAPE_INFO_PANEL_FADE_DURATION_MS);
  }

  private fpsCounter() {
    const now = performance.now();
    while (this.times.length > 0 && this.times[0] <= now - 1000) {
      this.times.shift();
    }

    this.times.push(now);
    this.fps = this.times.length;
    this.smoothedFps =
      this.smoothedFps === 0
        ? this.fps
        : this.smoothedFps +
          (this.fps - this.smoothedFps) * FPS_SMOOTHING_FACTOR;

    if (now - this.lastFpsDisplayUpdateAt < FPS_DISPLAY_UPDATE_INTERVAL_MS) {
      return;
    }

    this.lastFpsDisplayUpdateAt = now;
    setField("fps", Math.round(this.smoothedFps));
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  // The drawn count reaches the readouts, the telemetry card and the scene
  // graph row through here and nowhere else, so the three cannot disagree.
  private publishDrawnTriangles(count: number) {
    setField("trisDrawn", count);
    setState({ drawnTriangles: count });
  }

  private applyCameraSettings(mesh: Mesh) {
    mesh.changeFocal(this.focal);
    mesh.changeOffsetZ(this.zOffset);
  }

  private applyCameraSettingsToActiveMeshes() {
    this.transitionMachine
      .getActiveMeshes()
      .forEach((mesh) => this.applyCameraSettings(mesh));
  }

  private buildMesh(primitive: string): Mesh {
    const object3D = this.objects3D[primitive];
    if (!object3D) {
      throw new Error(`Unknown primitive: ${primitive}`);
    }

    const points = object3D.points.map(
      (point) => new Point3D(point[0], point[1], point[2]),
    );

    const triangles = object3D.triangles.map(
      (triangle) =>
        new Triangle(
          points[triangle[0]],
          points[triangle[1]],
          points[triangle[2]],
          triangle[3],
          triangle.length > 4 ? (triangle[4] as [number, number]) : undefined,
          triangle.length > 5 ? (triangle[5] as [number, number]) : undefined,
          triangle.length > 6 ? (triangle[6] as [number, number]) : undefined,
        ),
    );

    const mesh = new Mesh(points, triangles);
    this.applyCameraSettings(mesh);

    return mesh;
  }

  private rotateMesh(mesh: Mesh) {
    const speedFactor = this.rotationSpeed / 100;

    this.matrix3D.setAngle(
      ((this.pitch - this.centerY) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor,
    );
    mesh.transformMesh(this.matrix3D.pitch);

    this.matrix3D.setAngle(
      (-(this.yaw - this.centerX) / PITCH_YAW_ROTATION_DIVISOR) * speedFactor,
    );
    mesh.transformMesh(this.matrix3D.yaw);

    this.matrix3D.setAngle(
      (this.roll / ROLL_ROTATION_DIVISOR) * speedFactor,
    );
    mesh.transformMesh(this.matrix3D.roll);
  }

  private startTransitionToPrimitive(primitive: string, now: number) {
    // Selection returns to the mesh row on every shape change (D11):
    // otherwise picking a new primitive leaves KEY_LIGHT highlighted while
    // the object the row describes changes underneath it.
    setState({ sceneSelection: MESH_ROW_ID });
    const mesh = this.buildMesh(primitive);
    this.animateShapeInfoPanel(primitive);

    if (!this.currentPrimitiveName && !this.transitionMachine.getActiveMeshes().length) {
      this.transitionMachine.playInitialEntrance(mesh, now);
    } else {
      this.transitionMachine.switchTo(mesh, now);
    }

    this.targetPrimitiveName = primitive;
  }

  private requestPrimitiveChange = (primitive: string) => {
    if (primitive === this.targetPrimitiveName) {
      return;
    }

    if (this.transitionMachine.isAnimating()) {
      this.queuedPrimitiveName = primitive;
      return;
    }

    this.startTransitionToPrimitive(primitive, performance.now());
  };

  private syncTransitionQueue(now: number) {
    if (this.transitionMachine.isAnimating()) {
      return;
    }

    if (this.targetPrimitiveName) {
      this.currentPrimitiveName = this.targetPrimitiveName;
    }

    if (
      this.queuedPrimitiveName &&
      this.queuedPrimitiveName !== this.currentPrimitiveName
    ) {
      const nextPrimitive = this.queuedPrimitiveName;
      this.queuedPrimitiveName = null;
      this.startTransitionToPrimitive(nextPrimitive, now);
      return;
    }

    this.queuedPrimitiveName = null;
  }

  private renderFrame(timestamp: number) {
    if (!this.isPlaying) {
      return;
    }

    this.transitionMachine.update(timestamp);
    this.syncTransitionQueue(timestamp);

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
        wireframe: this.wireframeEnabled,
        cullBackfaces: this.backfaceCullingEnabled,
        opacity: this.opacity,
      },
    );
  }

  private renderPausedFrame() {
    if (this.isPlaying) {
      return;
    }

    this.renderedTriangles = this.surface3D.render(
      this.visibleRenderables(this.getCurrentRenderables()),
      {
        wireframe: this.wireframeEnabled,
        cullBackfaces: this.backfaceCullingEnabled,
        opacity: this.opacity,
      },
    );
    this.publishDrawnTriangles(this.renderedTriangles);
  }

  private togglePause = () => {
    this.isPlaying ? this.stop() : this.start();
    this.isPlaying = !this.isPlaying;
    this.syncTransportMounts();
  };

  private syncTransportMounts() {
    this.statusBar.setRunState(this.isPlaying);
    const label = this.isPlaying ? "PAUSE" : "RESUME";
    document
      .querySelectorAll<HTMLElement>("[data-transport='toggle']")
      .forEach((node) => {
        node.textContent = label;
      });

    // The REC dot claims a running render loop; freeze and dim it when there
    // isn't one.
    document
      .querySelectorAll<HTMLElement>(".readout__dot")
      .forEach((node) => node.classList.toggle("is-paused", !this.isPlaying));
  }

  private syncToggleButtons() {
    this.statusBar.setMode(this.wireframeEnabled);
    // Same modeLabel() behind both: the bar writes the word, the HUD writes the
    // attribute that keys the canvas filter.
    this.viewportHud.setMode(this.wireframeEnabled);
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

  private step = (timestamp: number) => {
    this.renderFrame(timestamp);
    this.fpsCounter();
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };

  private start = () => {
    this.transitionMachine.syncClock(performance.now());
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };

  private stop = () => {
    cancelAnimationFrame(this.requestAnimationID);
    this.lastFpsDisplayUpdateAt = 0;
    this.smoothedFps = 0;
    this.renderedTriangles = 0;
    setField("fps", 0);
    this.publishDrawnTriangles(0);
  };

  private visibleRenderables(renderables: ReturnType<Main["getCurrentRenderables"]>) {
    return isMeshHidden() ? [] : renderables;
  }

  private getCurrentRenderables() {
    return this.transitionMachine.getRenderables();
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
    this.changePitch(this.controls.getNumericValue("#pitchSlider") ?? this.pitch);
    this.changeYaw(this.controls.getNumericValue("#yawSlider") ?? this.yaw);
    this.changeRoll(this.controls.getNumericValue("#rollSlider") ?? this.roll);
    this.changeOpacity(
      this.controls.getNumericValue("#opacitySlider") ??
        DEFAULT_OPACITY_SLIDER_VALUE,
    );
    this.changeRotationSpeed(
      this.controls.getNumericValue("#rotationSpeedSlider") ??
        this.rotationSpeed,
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
    resetAll();
    this.renderPausedFrame();
  };

  private syncOpacitySliderAvailability() {
    this.opacitySlider.disabled = this.backfaceCullingEnabled;
    this.opacityDisabledTooltip.hide();
  }

  public async init(primitive: string) {
    await loadTextures({
      dog: dogUrl,
      galaxy: galaxyUrl,
    });

    this.controls.createSelectButton(
      this.primitivesName,
      this.requestPrimitiveChange,
    );
    // Resolution and the four camera placeholders are written once: none of
    // them changes while the console is open.
    this.viewportHud.seed();
    this.applyDefaultControlValues();
    this.attachControlListeners();
    this.syncSettingsFromControls();
    this.syncShapeInfoPanel(primitive);
    // Pushed explicitly rather than relying on the markup's seed, so the bar has
    // one source of truth from the first paint.
    this.statusBar.setRunState(this.isPlaying);
    this.syncOpacitySliderAvailability();
    this.startTransitionToPrimitive(primitive, performance.now());
    this.start();
  }
}

// The desktop inspector and the mobile tab bar are two independent groups over
// one DOM tree: each writes its own attribute on #app and CSS does the rest, so
// crossing the breakpoint never re-renders or re-binds anything.
const setupTabGroups = () => {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const inspectorTabs = document.getElementById("inspectorTabs");
  if (inspectorTabs) {
    createTabGroup({
      tablist: inspectorTabs,
      root: app,
      attribute: "data-tab",
      initial: "shape",
    });
  }

  const mobileTabs = document.getElementById("mobileTabs");
  if (mobileTabs) {
    createTabGroup({
      tablist: mobileTabs,
      root: app,
      attribute: "data-mtab",
      initial: "shape",
    });
  }
};

const boot = async () => {
  setupTabGroups();
  // Written from one source rather than typed into both branches' markup.
  setField("buildDesktop", BUILD_LABEL_DESKTOP);
  setField("buildMobile", BUILD_LABEL_MOBILE);

  const skyImage = await loadImageAsset(skyUrl);
  const canvas = document.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found.");
  }

  const backgroundRenderer = new BackgroundRenderer({
    width: canvas.width,
    height: canvas.height,
    skyImage,
  });

  await new Main(backgroundRenderer).init(Object.keys(data)[0]);
};

boot();
