import Mesh from "./Mesh";

class Surface3D {
  meshes: Mesh[] = [];
  surface3DContainer: CanvasRenderingContext2D;

  constructor(container: CanvasRenderingContext2D, mesh: Mesh) {
    this.meshes.push(mesh);
    this.surface3DContainer = container;
  }

  render() {
    this.surface3DContainer.clearRect(0, 0, 1024, 640);
    for (const i in this.meshes) {
      this.meshes[i].renderMesh(this.surface3DContainer);
    }
  };
};

export default Surface3D;

