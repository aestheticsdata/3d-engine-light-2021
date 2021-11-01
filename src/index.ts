import data, { Data3D } from "./data/data";
import Point3D from "./primitives/Point3D";
import Triangle from "./primitives/Triangle";
import Surface3D from "./primitives/Surface3D";
import Matrix3D from "./primitives/Matrix3D";
import Mesh from "./primitives/Mesh";
import Controls from "./controls";

class Main {
  times: number[];
  fps: number;
  fpsNode: HTMLElement;
  pauseBtn: HTMLElement;
  requestAnimationID: number;
  isPlaying: boolean;
  objects3D: any[];
  primitiveName: string[];
  primitive;
  stage: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  surface3D: Surface3D;
  matrix3D: Matrix3D;
  mesh: Mesh;
  pitch: number;
  yaw: number;
  roll: number;

  constructor() {
    this.stage = document.querySelector('canvas').getContext('2d');
    this.centerX = (this.stage.canvas.width)  >> 1;
    this.centerY = (this.stage.canvas.height) >> 1;
    this.pitch = 300;
    this.yaw = 300;
    this.roll = 200;
    this.times = [];
    this.fpsNode = document.getElementById('fpsCounterNb');
    this.pauseBtn = document.getElementById('playPause');
    this.pauseBtn.addEventListener('click', this.togglePause);
    this.isPlaying = true;
    this.objects3D = [];
    this.make3DObjects(data);
  }

  make3DObjects = (data3D: Data3D) => {
    this.primitiveName = Object.keys(data3D);

    for (const k of this.primitiveName) {
        const pointsJSON = data3D[k].points; // [[x,y,z], [x,y,z],...]
        const trianglesJSON = data3D[k].triangles; // [[a,b,c,color], [a,b,c,color],...]
        const pointsTmp: Point3D[] = [];
        const trianglesTmp: Triangle[] = [];

        pointsJSON.forEach(point => {pointsTmp.push(new Point3D(point[0], point[1], point[2]))});

        trianglesJSON.forEach(triangle => {
          trianglesTmp.push(new Triangle(pointsTmp[triangle[0]], pointsTmp[triangle[1]], pointsTmp[triangle[2]], triangle[3]));
        });

        this.objects3D.push({points: pointsTmp, triangles: trianglesTmp});
    }
};

  togglePause = () => {
    this.isPlaying ? this.stop() : this.start();
    this.isPlaying = !this.isPlaying;
  }

  // https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
  fpsCounter() {
    const now = performance.now();
    while (this.times.length > 0 && this.times[0] <= now - 1000) {
      this.times.shift();
    }
    this.times.push(now);
    this.fps = this.times.length;
    this.fpsNode.textContent = String(Math.floor(this.fps));
  }

  renderFrame(_timestamp) {
    if (this.isPlaying) {
      console.log('pitch', this.pitch);
      this.matrix3D.setAngle((this.pitch - this.centerY) / 50);
      this.mesh.transformMesh(this.matrix3D.pitch);

      this.matrix3D.setAngle(-(this.yaw - this.centerX) / 50);
      this.mesh.transformMesh(this.matrix3D.yaw);

      this.matrix3D.setAngle(this.roll / 250);
      this.mesh.transformMesh(this.matrix3D.roll);

      this.surface3D.render();
    }
  }

  step = (_timestamp) => {
    this.renderFrame(_timestamp);
    this.fpsCounter();
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  }

  start = () => {
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  }

  stop = () => {
    cancelAnimationFrame(this.requestAnimationID);
    this.fpsNode.textContent = String(0);
  }

  init(primitive: string){
    this.make3DObjects(data);
    this.matrix3D = new Matrix3D();
    this.primitive = this.primitiveName.indexOf(primitive);
    this.mesh = new Mesh(this.objects3D[this.primitive].points, this.objects3D[this.primitive].triangles);
    this.surface3D = new Surface3D(this.stage, this.mesh);
    (new Controls(this.mesh, this.pitch, this.yaw, this.roll));
    this.start();
  }
}

(new Main()).init('cube');

