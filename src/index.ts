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

class Main {
  private readonly times: number[];
  private fps: number;
  private readonly fpsNode: HTMLElement;
  private readonly pauseBtn: HTMLElement;
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
    if (!fpsNode || !pauseBtn) {
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
      duration: 1250,
    });
    this.objects3D = data;
    this.primitivesName = Object.keys(this.objects3D);
    this.pitch = 300;
    this.yaw = 300;
    this.roll = 200;
    this.focal = 300;
    this.zOffset = 0;
    this.times = [];
    this.fps = 0;
    this.fpsNode = fpsNode;
    this.pauseBtn = pauseBtn;
    this.requestAnimationID = 0;
    this.isPlaying = true;
    this.currentPrimitiveName = null;
    this.targetPrimitiveName = null;
    this.queuedPrimitiveName = null;

    this.pauseBtn.addEventListener("click", this.togglePause);
  }

  private changeFocal = (focal: number) => {
    this.focal = focal;
    this.applyCameraSettingsToActiveMeshes();
  };

  private changeOffsetZ = (zOffset: number) => {
    this.zOffset = zOffset;
    this.applyCameraSettingsToActiveMeshes();
  };

  private changePitch = (pitch: number) => (this.pitch = pitch);
  private changeYaw = (yaw: number) => (this.yaw = yaw);
  private changeRoll = (roll: number) => (this.roll = roll);

  private fpsCounter() {
    const now = performance.now();
    while (this.times.length > 0 && this.times[0] <= now - 1000) {
      this.times.shift();
    }

    this.times.push(now);
    this.fps = this.times.length;
    this.fpsNode.textContent = String(Math.floor(this.fps));
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
    this.matrix3D.setAngle((this.pitch - this.centerY) / 50);
    mesh.transformMesh(this.matrix3D.pitch);

    this.matrix3D.setAngle(-(this.yaw - this.centerX) / 50);
    mesh.transformMesh(this.matrix3D.yaw);

    this.matrix3D.setAngle(this.roll / 250);
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

    const renderables = this.transitionMachine.getRenderables();
    renderables.forEach((renderable) => this.rotateMesh(renderable.mesh));
    this.surface3D.render(renderables);
  }

  private togglePause = () => {
    this.isPlaying ? this.stop() : this.start();
    this.isPlaying = !this.isPlaying;
    this.pauseBtn.textContent = this.isPlaying ? "pause" : "play";
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
    this.fpsNode.textContent = String(0);
  };

  private attachControlListeners() {
    this.controls.attachListener("#focalSlider", this.changeFocal);
    this.controls.attachListener("#zOffsetSlider", this.changeOffsetZ);
    this.controls.attachListener("#pitchSlider", this.changePitch);
    this.controls.attachListener("#yawSlider", this.changeYaw);
    this.controls.attachListener("#rollSlider", this.changeRoll);
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
    this.attachControlListeners();
    this.startTransitionToPrimitive(primitive, performance.now());
    this.start();
  }
}

new Main().init(Object.keys(data)[0]);
