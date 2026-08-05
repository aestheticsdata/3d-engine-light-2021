import type Point3D from "@primitives/Point3D";
import type Triangle from "@primitives/Triangle";
import type { TriangleRenderOptions } from "@primitives/Triangle";

class Mesh {
  private readonly points: Point3D[];
  private readonly triangles: Triangle[];

  // Copied rather than aliased: the factory hands over the arrays it was
  // building, and a mesh whose geometry a caller can still push into is not a
  // mesh.
  constructor(points: Point3D[], triangles: Triangle[]) {
    this.points = [...points];
    this.triangles = [...triangles];
  }

  // What this mesh submits, for the GEOMETRY card. MeshFactory maps the
  // registry entry one-for-one, so these are the same two numbers SHAPE INFO
  // prints — counted per mesh rather than per primitive, which is what keeps
  // them honest while a transition has two meshes on screen at once.
  public get pointCount(): number {
    return this.points.length;
  }

  public get triangleCount(): number {
    return this.triangles.length;
  }

  // A visitor rather than a `depths` getter, and that is the point: the
  // histogram walks this every frame over as many as 7920 triangles, and
  // returning an array would allocate one per mesh per frame for a caller that
  // only ever reads it once.
  public forEachTriangleDepth(visit: (depth: number) => void) {
    for (const triangle of this.triangles) {
      visit(triangle.depth);
    }
  }

  public renderMesh(
    context: CanvasRenderingContext2D,
    offsetX: number = 0,
    offsetY: number = 0,
    options: TriangleRenderOptions,
  ): number {
    this.sortByDepth();

    let renderedTriangles = 0;

    for (const triangle of this.triangles) {
      if (triangle.render(context, offsetX, offsetY, options)) {
        renderedTriangles++;
      }
    }

    return renderedTriangles;
  }

  // Idempotent, unlike the incremental transform it replaces: applying the same
  // matrix twice leaves the mesh where it was. That is what lets a transition
  // hand the same matrix to both the outgoing and the incoming mesh and get one
  // shared attitude, and it removes a whole class of drift — the geometry is
  // never the product of the frames that came before it.
  public setTransform(transform: number[][]) {
    for (const point of this.points) {
      point.setFromSource(transform);
    }
  }

  // The painter's algorithm: far faces first, so near ones paint over them.
  // Descending, and the direction is not a preference — invert it and every mesh
  // renders inside-out. In place, because the order is only ever read here and a
  // sorted copy per frame would allocate one array per mesh per frame.
  private sortByDepth() {
    this.triangles.sort((t1, t2) => t2.depth - t1.depth);
  }
}

export default Mesh;
