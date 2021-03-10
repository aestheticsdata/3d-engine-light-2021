const Matrix3D = () => {
  let roll;
  let pitch;
  let yaw;

  let cos = 0, sin = 0;

  const setMatrix3D = function () {
    roll  = [[cos, -sin, 0, 0],
            [sin,  cos, 0, 0],
            [0,    0  , 1, 0],
            [0,    0  , 0, 1]];

    pitch = [[1,  0  ,  0  , 0],
            [0,  cos, -sin, 0],
            [0,  sin,  cos, 0],
            [0,  0  ,  0  , 1]];

    yaw = [[ cos, 0,  sin, 0],
          [ 0  , 1,  0  , 0],
          [-sin, 0,  cos, 0],
          [ 0  , 0,  0  , 1]];
  };

  const setAngle = function (agl) {
    let angle = agl * (Math.PI/180); // radian angle

    cos = Math.cos(angle);
    sin = Math.sin(angle);

    setMatrix3D();
  };

  return {
    roll,
    pitch,
    yaw,
    setAngle,
  };
}

export default Matrix3D;


