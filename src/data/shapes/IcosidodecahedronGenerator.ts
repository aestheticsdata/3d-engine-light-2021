// Icosidodecahedron (ID) — the rectified dodecahedron, and the icosahedral
// counterpart of the cuboctahedron in this folder: where CO's vertices are the
// midpoints of a cube's edges, ID's are the midpoints of an icosahedron's.
//
// 30 vertices, 60 edges, 32 faces — 20 triangles and 12 pentagons.
//
// It is built from the shared icosahedron scaffolding rather than from a table
// of 30 coordinates, which makes the construction self-checking: the
// icosahedron's 30 edges have to produce 30 vertices, its 20 faces have to
// produce 20 triangles, and its 12 vertices have to produce 12 pentagons.
//
// References:
//   "The Symmetries of Things", Conway, Burgiel & Goodman-Strauss, p. 285
//   https://en.wikipedia.org/wiki/Icosidodecahedron
//   https://mathworld.wolfram.com/Icosidodecahedron.html

import Icosahedron from "@data/builders/Icosahedron";
import MeshBuilder from "@data/builders/MeshBuilder";
import { AXES } from "@data/builders/symmetry";
import type { Object3D } from "@data/types";

const CIRCUMRADIUS = 100;

// Two roses, lighter on the larger faces so the pentagons read as the flats and
// the triangles as the bevels between them. The three fan triangles of a
// pentagon share its colour, or the solid reads as 60 triangles.
const PENTAGON_COLOR = "rgba(214, 112, 128, 1)";
const TRIANGLE_COLOR = "rgba(150, 60, 82, 1)";

class IcosidodecahedronGenerator {
  private readonly builder: MeshBuilder;
  private readonly icosahedron: Icosahedron;

  // The scaffolding is a constructor input with a default rather than a module
  // singleton: three solids need one, and one instance shared across three
  // callers is the module-level mutable state this epic is removing.
  constructor(icosahedron: Icosahedron = new Icosahedron()) {
    this.builder = new MeshBuilder();
    this.icosahedron = icosahedron;
  }

  public build(): Object3D {
    this.builder.addConvexPolyhedron({
      vertices: this.buildVertices(),
      faces: [...this.buildTriangleFaces(), ...this.buildPentagonFaces()],
      radius: CIRCUMRADIUS,
      colorForFace: (vertexCount) =>
        vertexCount === 5 ? PENTAGON_COLOR : TRIANGLE_COLOR,
    });

    return this.builder.mesh;
  }

  // The ID vertices *are* the icosahedron's edge midpoints.
  private buildVertices(): number[][] {
    return this.icosahedron.edges.map(([first, second]) =>
      AXES.map(
        (axis) =>
          (this.icosahedron.vertices[first][axis] +
            this.icosahedron.vertices[second][axis]) /
          2,
      ),
    );
  }

  // One triangle per icosahedron face — the three edges around it.
  private buildTriangleFaces(): number[][] {
    return this.icosahedron.faces.map(([first, second, third]) => [
      this.icosahedron.edgeIndex(first, second),
      this.icosahedron.edgeIndex(second, third),
      this.icosahedron.edgeIndex(first, third),
    ]);
  }

  // One pentagon per icosahedron vertex — its vertex figure, the five edge
  // midpoints around it. The builder sorts them cyclically, so they can be
  // collected in any order here.
  private buildPentagonFaces(): number[][] {
    return this.icosahedron.vertices.map((_, vertex) =>
      this.icosahedron.edges.reduce<number[]>(
        (indices, [first, second], index) => {
          if (first === vertex || second === vertex) {
            indices.push(index);
          }

          return indices;
        },
        [],
      ),
    );
  }
}

export default IcosidodecahedronGenerator;
