import Mesh from "./Mesh";

class Surface3D {
  meshes: Mesh[] = [];
  surface3DContainer: any;

  renderSurface3D() {
    for (const i in this.meshes) {
      this.meshes[i].renderMesh(this.surface3DContainer);
    }
  };

  addmesh(mesh: Mesh) {
    this.meshes.push(mesh);
  };

  setContainer(container: any) {
    this.surface3DContainer = container;
  };
};

export default Surface3D;

