// Registry data in, a Mesh out.
//
// The single construction site of Point3D and Triangle in the repo, which is
// what makes it worth naming: the viewport work that stops Point3D querying the
// DOM once per vertex needs exactly this seam.
//
// Pure. No DOM, no store, no camera. The caller applies the camera afterwards,
// as it always did.

import Mesh from "@primitives/Mesh";
import Point3D from "@primitives/Point3D";
import Triangle from "@primitives/Triangle";
import { Object3D } from "@data/types";

class MeshFactory {
  public build(object3D: Object3D): Mesh {
    const points = object3D.points.map(
      (point) => new Point3D(point[0], point[1], point[2]),
    );

    // `triangle` is a union of a 4-tuple (flat colour) and a 7-tuple (colour
    // plus three UVs), so its `length` is the literal type `4 | 7`. Testing it
    // narrows the union and both branches index a tuple that really has those
    // slots — which is what removes the three `as [number, number]` casts the
    // old inline version needed to silence the same access.
    const triangles = object3D.triangles.map((triangle) => {
      const [a, b, c, material] = triangle;

      if (triangle.length === 7) {
        return new Triangle(
          points[a],
          points[b],
          points[c],
          material,
          triangle[4],
          triangle[5],
          triangle[6],
        );
      }

      return new Triangle(points[a], points[b], points[c], material);
    });

    return new Mesh(points, triangles);
  }
}

export default MeshFactory;
