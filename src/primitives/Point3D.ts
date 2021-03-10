import Point2D from "./Point2D";

type Point3DType  = (x: number, y: number, z: number) => {
  x: number,
  y: number,
  z: number,
  convert3D2D: () => { x: number, y: number },
  transformPt: (rot: Array<Array<number>>) => {x: number, y: number, z: number},
};

const Point3D: Point3DType = (x, y, z) => {
  const fl = 300;
  const zOffset = 0;

  const canvas: any | null = document.querySelector('canvas'); // type (any | null) to calm down TypeScript
  let vpX = 100; // init to calm down TypeScript
  let vpY = 100; // init to calm down TypeScript

  if (canvas) {
    vpX = canvas[0].width >> 1;
    vpY = canvas[0].height >> 1;
  }

  const convert3D2D = () => {
    const scale = fl / (fl + z + zOffset);
    const tmpX = vpX + x*scale;
    const tmpY = vpY + y*scale;

    return Point2D(tmpX, tmpY);
  };

  const transformPt = (rot: Array<Array<number>>) => {
    let vect: [number, number, number, number]= [0, 0, 0, 0];
    vect[0] = rot[0][0] * x + rot[0][1] * y + rot[0][2] * z + rot[0][3] * 1;
    vect[1] = rot[1][0] * x + rot[1][1] * y + rot[1][2] * z + rot[1][3] * 1;
    vect[2] = rot[2][0] * x + rot[2][1] * y + rot[2][2] * z + rot[2][3] * 1;
    vect[3] = 1;

    x = vect[0];
    y = vect[1];
    z = vect[2];

    return {x, y, z};
  };

  return {
    x,
    y,
    z,
    convert3D2D,
    transformPt,
  };
}

export default Point3D;

