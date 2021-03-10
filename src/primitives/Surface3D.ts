const Surface3D = () => {
  const meshes = [];
  let surface3DContainer;

  const renderSurface3D = () => {
    for (const i in meshes) {
      meshes[i].renderMesh(surface3DContainer);
    }
  };

  const addmesh = (mesh) => {
    meshes.push(mesh);
  };

  const setContainer = (container) => {
    surface3DContainer = container;
  };

  return {
    renderSurface3D,
    addmesh,
    setContainer,
  }
};

export default Surface3D;

