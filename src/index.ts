import data, { Data3D } from "@data/data";
import Point3D from "@primitives/Point3D";
import Triangle from "@primitives/Triangle";
import Surface3D from "@primitives/Surface3D";
import Matrix3D from "@primitives/Matrix3D";
import Mesh from "@primitives/Mesh";
import Controls from "./controls";
import { loadTextures } from "@textures/textures";
import dogUrl from "@textures/images/border-collie.jpeg";
import galaxyUrl from "@textures/images/galaxy.jpeg";

class Main {
  private readonly times: number[];
  private fps: number;
  private fpsNode: HTMLElement;
  private pauseBtn: HTMLElement;
  private requestAnimationID: number;
  private isPlaying: boolean;
  private objects3D: any;
  private primitivesName: string[];
  private primitive;
  private readonly stage: CanvasRenderingContext2D;
  private readonly centerX: number;
  private readonly centerY: number;
  private surface3D: Surface3D;
  private matrix3D: Matrix3D;
  private mesh: Mesh;
  private pitch: number;
  private yaw: number;
  private roll: number;
  private controls: Controls;

  constructor() {
    this.controls = new Controls();
    this.stage = document.querySelector("canvas").getContext("2d");
    this.centerX = this.stage.canvas.width >> 1;
    this.centerY = this.stage.canvas.height >> 1;
    this.pitch = 300;
    this.yaw = 300;
    this.roll = 200;
    this.times = [];
    this.fpsNode = document.getElementById("fpsCounterNb");
    this.pauseBtn = document.getElementById("playPause");
    this.pauseBtn.addEventListener("click", this.togglePause);
    this.isPlaying = true;
    this.objects3D = [];
    this.matrix3D = new Matrix3D();
    this.primitivesName = [];
    this.primitive = "";
    this.make3DObjects(data);
  }

  // callback with arrow function to keep 'this' ///////////////
  private changePitch = (pitch: number) => (this.pitch = pitch);
  private changeYaw = (yaw: number) => (this.yaw = yaw);
  private changeRoll = (roll: number) => (this.roll = roll);
  // //////////////////////////////////////////////////////////

  private make3DObjects(data3D: Data3D) {
    this.primitivesName = Object.keys(data3D);

    for (const k of this.primitivesName) {
      const pointsJSON = data3D[k].points; // [[x,y,z], [x,y,z],...]
      const trianglesJSON = data3D[k].triangles; // [[a,b,c,color], [a,b,c,color],...]
      const pointsTmp: Point3D[] = [];
      const trianglesTmp: Triangle[] = [];

      pointsJSON.forEach((point) => {
        pointsTmp.push(new Point3D(point[0], point[1], point[2]));
      });

      trianglesJSON.forEach((t) => {
        trianglesTmp.push(
          new Triangle(
            pointsTmp[t[0]],
            pointsTmp[t[1]],
            pointsTmp[t[2]],
            t[3],
            t.length > 4 ? (t[4] as any) : undefined,
            t.length > 5 ? (t[5] as any) : undefined,
            t.length > 6 ? (t[6] as any) : undefined,
          ),
        );
      });

      this.objects3D.push({ points: pointsTmp, triangles: trianglesTmp });
    }
  }

  // https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  private fpsCounter() {
    const now = performance.now();
    while (this.times.length > 0 && this.times[0] <= now - 1000) {
      this.times.shift();
    }
    this.times.push(now);
    this.fps = this.times.length;
    this.fpsNode.textContent = String(Math.floor(this.fps));
  }

  private renderFrame(_timestamp) {
    if (this.isPlaying) {
      this.matrix3D.setAngle((this.pitch - this.centerY) / 50);
      this.mesh.transformMesh(this.matrix3D.pitch);

      this.matrix3D.setAngle(-(this.yaw - this.centerX) / 50);
      this.mesh.transformMesh(this.matrix3D.yaw);

      this.matrix3D.setAngle(this.roll / 250);
      this.mesh.transformMesh(this.matrix3D.roll);

      this.surface3D.render();
    }
  }

  private togglePause = () => {
    this.isPlaying ? this.stop() : this.start();
    this.isPlaying = !this.isPlaying;
    this.pauseBtn.textContent = this.isPlaying ? "pause" : "play";
  };

  private step = (_timestamp) => {
    this.renderFrame(_timestamp);
    this.fpsCounter();
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };

  private start = () => {
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };

  private stop = () => {
    cancelAnimationFrame(this.requestAnimationID);
    this.fpsNode.textContent = String(0);
  };

  private putObjectToScene = (primitive: string) => {
    this.primitive = this.primitivesName.indexOf(primitive);
    this.mesh = new Mesh(
      this.objects3D[this.primitive].points,
      this.objects3D[this.primitive].triangles
    );
    this.surface3D = new Surface3D(this.stage, this.mesh);
    this.controls.attachListener("#focalSlider", "changeFocal", this.mesh);
    this.controls.attachListener("#zOffsetSlider", "changeOffsetZ", this.mesh);
    this.controls.attachListener("#pitchSlider", this.changePitch);
    this.controls.attachListener("#yawSlider", this.changeYaw);
    this.controls.attachListener("#rollSlider", this.changeRoll);
  };

  public async init(primitive: string) {
    await loadTextures({
      dog: dogUrl,
      galaxy: galaxyUrl,
    });
    this.controls.createSelectButton(
      this.primitivesName,
      this.putObjectToScene
    );
    this.putObjectToScene(primitive);
    this.start();
  }
}

new Main().init(Object.keys(data)[0]);
