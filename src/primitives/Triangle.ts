const Triangle = (a, b, c, color) => { //a, b, c are Point3D
  const renderTriangle = (container) => {
    const aproj = a.convert3D2D();
    const bproj = b.convert3D2D();
    const cproj = c.convert3D2D();

    container.graphics.beginFill(color);
    container.graphics.moveTo(aproj.x, aproj.y);
    container.graphics.lineTo(bproj.x, bproj.y);
    container.graphics.lineTo(cproj.x, cproj.y);
    container.graphics.lineTo(aproj.x, aproj.y);
    container.graphics.endFill();
  };

  const changeFocal = (value) => {
    a.fl = b.fl = c.fl = value;

    return {
      a,
      b,
      c,
    };
  };

  const changeOffsetZ = (value) => {
    a.zOffset = b.zOffset = c.zOffset = value;

    return {
      a,
      b,
      c,
    };
  }

  return {
    renderTriangle,
    changeFocal,
    changeOffsetZ,
  }
}

export default Triangle;

