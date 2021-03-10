import Point3D from "../primitives/Point3D";
import Triangle from "../primitives/Triangle";
import { DataType } from "../services/DataType";


const make3DObjects = (jsonData: DataType) => {
  const keys = Object.keys(jsonData);
  const objects3D = [];

  for (const i in keys) {
    const tempObj3D = Object.keys(jsonData)[i]; // object of this kind : {"points":[...], "triangles":[...]}
    const pointsJSON = jsonData[tempObj3D].points; // [[x,y,z], [x,y,z],...]
    const trianglesJSON = jsonData[tempObj3D].triangles; // [[a,b,c,color], [a,b,c,color],...]
    const pointsTmp = [];
    const trianglesTmp = [];

    for (const n in pointsJSON) {
      pointsTmp.push(Point3D(pointsJSON[n][0], pointsJSON[n][1], pointsJSON[n][2]));
    }

    for (const m in trianglesJSON) {
      trianglesTmp.push(Triangle(
        pointsTmp[ trianglesJSON[m][0] ],
        pointsTmp[ trianglesJSON[m][1] ],
        pointsTmp[ trianglesJSON[m][2] ],
        trianglesJSON[m][3]));
    }

    objects3D.push({points: pointsTmp, triangles: trianglesTmp});
  }

  return {
    keys,
    objects3D,
  };
};

export default make3DObjects;
