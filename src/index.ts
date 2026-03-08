import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import data, { Data3D } from "@data/data";
import Matrix3D from "@primitives/Matrix3D";
import Mesh from "@primitives/Mesh";
import Point3D from "@primitives/Point3D";
import Surface3D from "@primitives/Surface3D";
import Triangle from "@primitives/Triangle";
import { loadTextures } from "@textures/textures";
import Controls from "./controls";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";

const TRANSITION_DURATION_MS = 1250;
const PITCH_YAW_ROTATION_DIVISOR = 110;
const ROLL_ROTATION_DIVISOR = 500;
const FOCAL_SLIDER_MIN = 0;
const FOCAL_SLIDER_MAX = 100;
const FOCAL_LENGTH_MIN = 180;
const FOCAL_LENGTH_MAX = 3200;
const DEFAULT_FOCAL_SLIDER_VALUE = 18;
const DEFAULT_Z_OFFSET = 0;
const DEFAULT_PITCH = 400;
const DEFAULT_YAW = 400;
const DEFAULT_ROLL = 200;
const DEFAULT_ROTATION_SPEED = 200;
const ROTATION_SPEED_SLIDER_MAX = 2000;
const FPS_DISPLAY_UPDATE_INTERVAL_MS = 90;
const FPS_SMOOTHING_FACTOR = 0.2;

const sliderProgress = (value: number, min: number, max: number): number =>
  (value - min) / (max - min);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sliderToFocalLength = (sliderValue: number): number => {
  const progress = clamp(
    sliderProgress(sliderValue, FOCAL_SLIDER_MIN, FOCAL_SLIDER_MAX),
    0,
    1,
  );

  return (
    FOCAL_LENGTH_MIN *
    Math.pow(FOCAL_LENGTH_MAX / FOCAL_LENGTH_MIN, progress)
  );
};

class Main {
  private readonly times: number[];
  private fps: number;
  private readonly fpsNode: HTMLElement;
  private readonly pauseBtn: HTMLElement;
  private readonly wireframeBtn: HTMLElement;
  private readonly resetBtn: HTMLElement;
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
  private wireframeEnabled: boolean;
  private smoothedFps: number;
  private lastFpsDisplayUpdateAt: number;
  private currentPrimitiveName: string | null;
  private targetPrimitiveName: string | null;
  private queuedPrimitiveName: string | null;

  constructor() {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas element not found.");
    }

    const stage = canvas.getContext("2d");
    if (!stage) {
      throw new Error("2D canvas context is not available.");
    }

    const fpsNode = document.getElementById("fpsCounterNb");
    const pauseBtn = document.getElementById("playPause");
    const wireframeBtn = document.getElementById("toggleWireframe");
    const resetBtn = document.getElementById("resetControls");
    if (!fpsNode || !pauseBtn || !wireframeBtn || !resetBtn) {
      throw new Error("UI controls are missing.");
    }

    this.controls = new Controls();
    this.stage = stage;
    this.centerX = this.stage.canvas.width >> 1;
    this.centerY = this.stage.canvas.height >> 1;
    this.surface3D = new Surface3D(this.stage);
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
    this.wireframeEnabled = false;
    this.focal = 300;
    this.zOffset = DEFAULT_Z_OFFSET;
    this.times = [];
    this.fps = 0;
    this.smoothedFps = 0;
    this.lastFpsDisplayUpdateAt = 0;
    this.fpsNode = fpsNode;
    this.pauseBtn = pauseBtn;
    this.wireframeBtn = wireframeBtn;
    this.resetBtn = resetBtn;
    this.requestAnimationID = 0;
    this.isPlaying = true;
    this.currentPrimitiveName = null;
    this.targetPrimitiveName = null;
    this.queuedPrimitiveName = null;

    this.pauseBtn.addEventListener("click", this.togglePause);
    this.wireframeBtn.addEventListener("click", this.toggleWireframe);
    this.resetBtn.addEventListener("click", this.resetControls);
  }

  private changeFocal = (sliderValue: number) => {
    this.focal = sliderToFocalLength(sliderValue);
    this.applyCameraSettingsToActiveMeshes();
    this.renderPausedFrame();
  };

  private changeOffsetZ = (zOffset: number) => {
    this.zOffset = zOffset;
    this.applyCameraSettingsToActiveMeshes();
    this.renderPausedFrame();
  };

  private changePitch = (pitch: number) => (this.pitch = pitch);
  private changeYaw = (yaw: number) => (this.yaw = yaw);
  private changeRoll = (roll: number) => (this.roll = roll);
  private changeRotationSpeed = (rotationSpeed: number) =>
    (this.rotationSpeed = rotationSpeed);

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
    this.fpsNode.textContent = String(Math.round(this.smoothedFps));
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
    const mesh = this.buildMesh(primitive);

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
    renderables.forEach((renderable) => this.rotateMesh(renderable.mesh));
    this.surface3D.render(renderables, {
      wireframe: this.wireframeEnabled,
    });
  }

  private renderPausedFrame() {
    if (this.isPlaying) {
      return;
    }

    this.surface3D.render(this.getCurrentRenderables(), {
      wireframe: this.wireframeEnabled,
    });
  }

  private togglePause = () => {
    this.isPlaying ? this.stop() : this.start();
    this.isPlaying = !this.isPlaying;
    this.pauseBtn.textContent = this.isPlaying ? "pause" : "play";
  };

  private toggleWireframe = () => {
    this.wireframeEnabled = !this.wireframeEnabled;
    this.wireframeBtn.textContent = this.wireframeEnabled ? "on" : "off";
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
    this.fpsNode.textContent = String(0);
  };

  private getCurrentRenderables() {
    return this.transitionMachine.getRenderables();
  }

  private attachControlListeners() {
    this.controls.attachListener("#focalSlider", this.changeFocal);
    this.controls.attachListener("#zOffsetSlider", this.changeOffsetZ);
    this.controls.attachListener("#pitchSlider", this.changePitch);
    this.controls.attachListener("#yawSlider", this.changeYaw);
    this.controls.attachListener("#rollSlider", this.changeRoll);
    this.controls.attachListener(
      "#rotationSpeedSlider",
      this.changeRotationSpeed,
    );
  }

  private applyDefaultControlValues() {
    this.controls.setNumericValue("#focalSlider", DEFAULT_FOCAL_SLIDER_VALUE);
    this.controls.setNumericValue("#zOffsetSlider", DEFAULT_Z_OFFSET);
    this.controls.setNumericValue("#pitchSlider", DEFAULT_PITCH);
    this.controls.setNumericValue("#yawSlider", DEFAULT_YAW);
    this.controls.setNumericValue("#rollSlider", DEFAULT_ROLL);
    this.controls.setNumericValue(
      "#rotationSpeedSlider",
      clamp(DEFAULT_ROTATION_SPEED, 0, ROTATION_SPEED_SLIDER_MAX),
    );
  }

  private syncSettingsFromControls() {
    this.changeFocal(this.controls.getNumericValue("#focalSlider") ?? this.focal);
    this.changeOffsetZ(
      this.controls.getNumericValue("#zOffsetSlider") ?? this.zOffset,
    );
    this.changePitch(this.controls.getNumericValue("#pitchSlider") ?? this.pitch);
    this.changeYaw(this.controls.getNumericValue("#yawSlider") ?? this.yaw);
    this.changeRoll(this.controls.getNumericValue("#rollSlider") ?? this.roll);
    this.changeRotationSpeed(
      this.controls.getNumericValue("#rotationSpeedSlider") ??
        this.rotationSpeed,
    );
  }

  private resetControls = () => {
    this.applyDefaultControlValues();
    this.syncSettingsFromControls();
  };

  public async init(primitive: string) {
    await loadTextures({
      dog: dogUrl,
      galaxy: galaxyUrl,
    });

    this.controls.createSelectButton(
      this.primitivesName,
      this.requestPrimitiveChange,
    );
    this.applyDefaultControlValues();
    this.attachControlListeners();
    this.syncSettingsFromControls();
    this.startTransitionToPrimitive(primitive, performance.now());
    this.start();
  }
}

new Main().init(Object.keys(data)[0]);
