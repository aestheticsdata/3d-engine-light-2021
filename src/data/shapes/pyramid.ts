import { Object3D } from "@data/types";

const pyramid: Object3D = {
  points: [
    [0, -100, 0],
    [100, 100, -100],
    [-100, 100, -100],
    [-100, 100, 100],
    [100, 100, 100],
  ],
  triangles: [
    [0, 1, 2, "rgba(255,255,127,1)"],
    [0, 2, 3, "rgba(0,255,127,1)"],
    [0, 3, 4, "rgba(66,66,127,1)"],
    [0, 4, 1, "rgba(166,20,27,1)"],
    [1, 3, 2, "rgba(120,66,32,1)"],
    [1, 4, 3, "rgba(220,66,32,1)"],
  ],
};

export default pyramid;
