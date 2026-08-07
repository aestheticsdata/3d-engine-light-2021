// Registry data in, a Mesh out.
//
// The single construction site of Point3D and Triangle FROM THE REGISTRY in
// the repo, and this is where that pays: the render target and the camera are
// resolved once, here, instead of by every point for itself. Triangle's own
// clipToNear (COS-418/E2b) is the one other call site: a clip fragment has no
// registry entry to rebuild from every frame, so it is built through
// Point3D.withPosition and discarded at the end of the frame instead of
// living in a mesh's points/triangles arrays.
//
// Pure. No DOM and no store. The camera arrives as a record rather than as a set
// of values to copy, so there is no third step where the caller applies it —
// building a mesh is what puts it under the camera, and every later change to
// that camera reaches this mesh without anything walking its vertices.

import Mesh from "@primitives/Mesh";
import Point3D from "@primitives/Point3D";
import Triangle from "@primitives/Triangle";
import { sphericalUVs } from "@rendering/uvProjection";

import type { Object3D } from "@data/types";
import type Camera from "@primitives/Camera";
import type RenderTarget from "@primitives/RenderTarget";

class MeshFactory {
  private readonly renderTarget: RenderTarget;
  private readonly camera: Camera;

  constructor(renderTarget: RenderTarget, camera: Camera) {
    this.renderTarget = renderTarget;
    this.camera = camera;
  }

  public build(object3D: Object3D): Mesh {
    const points = object3D.points.map(
      (point) => new Point3D(point[0], point[1], point[2], this.renderTarget, this.camera),
    );

    // Read here rather than in the loop, and from object3D rather than from the
    // Point3D instances above: the projection has to run against the pristine
    // coordinates, which setTransform is about to start rewriting every frame
    // (E4b/COS-245). Once per mesh build, never per frame.
    const generated = sphericalUVs(object3D);

    // `triangle` is a union of a 4-tuple (flat colour) and a 7-tuple (colour
    // plus three UVs), so its `length` is the literal type `4 | 7`. Testing it
    // narrows the union and both branches index a tuple that really has those
    // slots — which is what removes the three `as [number, number]` casts the
    // old inline version needed to silence the same access.
    //
    // The 7-tuple branch is also how authored UVs win: they win by never being
    // generated over, so the cube's two subdivided faces keep the mapping the
    // registry gave them in every texture mode.
    const triangles = object3D.triangles.map((triangle, index) => {
      const [a, b, c, material] = triangle;

      if (triangle.length === 7) {
        return new Triangle(points[a], points[b], points[c], material, triangle[4], triangle[5], triangle[6]);
      }

      // Non-null for exactly the faces this branch handles, since sphericalUVs
      // returns null for the authored ones and nothing else. Read through the
      // optional slots anyway: a face that somehow arrived without coordinates
      // should come out flat rather than throw.
      const face = generated[index];

      return new Triangle(points[a], points[b], points[c], material, face?.[0], face?.[1], face?.[2]);
    });

    return new Mesh({ points, triangles, boundingRadius: this.boundingRadiusOf(object3D) });
  }

  // Folded over the registry's own raw coordinates rather than the Point3D
  // instances above: rotation is rigid, so this radius is the same before and
  // after setTransform ever runs, and the raw arrays are already in hand here
  // without needing Point3D to expose x/y (E6/COS-239 deliberately leaves
  // that to whichever of E3a or E5b lands first and actually needs it).
  private boundingRadiusOf(object3D: Object3D): number {
    return object3D.points.reduce((radius, [x, y, z]) => Math.max(radius, Math.sqrt(x * x + y * y + z * z)), 0);
  }
}

export default MeshFactory;
