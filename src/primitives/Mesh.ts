const Mesh = () => {
  const pointsMesh    = [];
  const trianglesMesh = [];

  const renderMesh = (container) => {
    for (const i in trianglesMesh) {
      trianglesMesh[i].render(container);
    }
  }

  const changeFocal = (value) => {
    for (const i in trianglesMesh) {
      trianglesMesh[i].changeFocal(value);
    }
  };

  const changeOffsetZ = (value) => {
    for (const i in trianglesMesh) {
      trianglesMesh[i].changeOffsetZ(value);
    }
  };

  const transformMesh = (rot) => {
    for (const i in pointsMesh) {
      pointsMesh[i].transformPt(rot);
    }
  };

  const setMesh = (points, triangles) => {
    for (const i in pointsMesh) {
      pointsMesh[i] = points[i];
    }

    for (const i in triangles) {
      trianglesMesh [i] = triangles[i];
    }
  }

  return {
    renderMesh,
    changeFocal,
    changeOffsetZ,
    transformMesh,
    setMesh,
  }
};

export default Mesh;


