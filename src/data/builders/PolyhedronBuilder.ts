// Convex polyhedra from a vertex list and a set of faces.
//
// The Archimedean and Catalan solids all share the same shape of definition: a
// list of vertices, and a list of faces given as vertex indices. Everything
// around that — normalizing the scale, ordering each face's vertices and
// getting the winding right — is identical from one solid to the next, so it
// lives here once instead of in every shape file.
//
// Faces are passed as *sets*: the indices may be in any order. They are sorted
// cyclically around the face centre, which removes the most tedious and
// error-prone part of writing these solids by hand.
//
// Winding: the renderer culls a triangle when its projected 2D cross product is
// <= 0 (see Triangle.isFrontFacing). Because screen Y points down, the triangles
// that survive are the ones whose world-space (b-a) x (c-a) points *towards* the
// centre of the solid. Both hand-authored primitives (cube, pyramid) follow that
// convention; it is reproduced here by flipping any face loop whose normal comes
// out pointing away from the centre.
//
import Vec3Math from "@data/builders/Vec3Math";

type Vec3 = [number, number, number];

class PolyhedronBuilder {
  private readonly vec: Vec3Math;

  constructor() {
    this.vec = new Vec3Math();
  }

  // Recentre on the origin and normalize to the requested circumradius, so
  // every solid in the family shows up at the same size as the other shapes.
  public centerAndScale(vertices: number[][], radius: number): number[][] {
    const center = this.vec.centroid(vertices);
    const maxDistance = Math.max(...vertices.map((vertex) => this.vec.magnitude(this.vec.sub(vertex, center))));
    const scale = radius / maxDistance;

    return vertices.map((vertex) => [
      (vertex[0] - center[0]) * scale,
      (vertex[1] - center[1]) * scale,
      (vertex[2] - center[2]) * scale,
    ]);
  }

  public orderFaces(vertices: number[][], faces: number[][]): number[][] {
    return faces.map((face) => this.orderFaceVertices(face, vertices));
  }

  // A face is the set of vertices reaching furthest along its normal.
  //
  // The tolerance defaults to exactly 0 and is opted into. The rhombic
  // dodecahedron's coordinates are integers, so its maximum is exact; admitting
  // near-misses there would pull a fifth vertex into a four-vertex face and the
  // cyclic sort would triangulate a non-planar rhombus without complaining.
  // Solids with irrational coordinates pass one explicitly.
  public facesFromNormals(vertices: number[][], normals: number[][], tolerance: number = 0): number[][] {
    return normals.map((normal) => {
      const reach = Math.max(...vertices.map((vertex) => this.vec.dot(vertex, normal)));

      return vertices.reduce<number[]>((indices, vertex, index) => {
        if (this.vec.dot(vertex, normal) >= reach - tolerance) {
          indices.push(index);
        }

        return indices;
      }, []);
    });
  }

  // The solid is centred on the origin by the time this runs, so a face's
  // outward direction is simply the direction of its own centre.
  private orderFaceVertices(face: number[], vertices: number[][]): number[] {
    const pts = face.map((index) => vertices[index]);
    const faceCenter = this.vec.centroid(pts);

    // Any two non-collinear spokes from the face centre span the face plane.
    let normal: Vec3 = [0, 0, 0];
    for (let i = 1; i < pts.length; i += 1) {
      normal = this.vec.cross(this.vec.sub(pts[0], faceCenter), this.vec.sub(pts[i], faceCenter));
      if (this.vec.magnitude(normal) > 1e-6) {
        break;
      }
    }

    const flipped: Vec3 = [-normal[0], -normal[1], -normal[2]];
    const outward = this.vec.normalize(this.vec.dot(normal, faceCenter) < 0 ? flipped : normal);

    // 2D frame inside the face plane, used only to sort the vertices by angle.
    const u = this.vec.normalize(this.vec.sub(pts[0], faceCenter));
    const w = this.vec.cross(outward, u);

    const ordered = face
      .map((index, i) => {
        const spoke = this.vec.sub(pts[i], faceCenter);

        return {
          index,
          angle: Math.atan2(this.vec.dot(spoke, w), this.vec.dot(spoke, u)),
        };
      })
      .sort((a, b) => a.angle - b.angle)
      .map((entry) => entry.index);

    // Engine convention: (b-a) x (c-a) must point back towards the centre.
    const a = vertices[ordered[0]];
    const b = vertices[ordered[1]];
    const c = vertices[ordered[2]];
    if (this.vec.dot(this.vec.cross(this.vec.sub(b, a), this.vec.sub(c, a)), outward) > 0) {
      ordered.reverse();
    }

    return ordered;
  }
}

export default PolyhedronBuilder;
