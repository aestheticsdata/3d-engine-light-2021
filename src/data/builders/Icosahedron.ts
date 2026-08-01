// The icosahedron, as shared scaffolding.
//
// Several solids in this folder are defined not by coordinates of their own but
// by an icosahedron's: ID takes its edge midpoints, R30 pairs its vertices with
// its face centres, kR30 raises pyramids on that. They all need the same 12
// points with the same adjacency.
//
// Adjacency is recovered rather than tabulated, which is what makes those solids
// self-checking: 12 vertices have to yield 30 edges and 20 faces, and a mistake
// anywhere shows up as a wrong count rather than as a subtly wrong picture.
//
// It became a class for the cost of the scan, not for the shape of the code. As
// four module-level containers filled by top-level loops, importing this module
// for a type ran the whole 12x12x12 search; as a class, the search runs when a
// solid that needs it is built. Three solids each build their own — the scan is
// under two thousand comparisons, and one shared mutable instance handed to
// three callers is the thing this epic is removing.

// A module-scope const above the class rather than a static member: there is
// not one `static` across the classes this repo's style was recovered from. Two
// solids outside this file scale by φ², so it is exported rather than
// recomputed at the call site.
export const PHI = (1 + Math.sqrt(5)) / 2;

// Edge length is 2 with these coordinates, and the next-closest pair of
// vertices is 4φ² ≈ 10.5 away, so this separates edges from non-edges with an
// enormous margin.
const EDGE_LENGTH_SQUARED = 4;
const EDGE_TOLERANCE = 1e-6;

class Icosahedron {
  private readonly vertexTable: number[][];
  private readonly edgeTable: number[][];
  private readonly faceTable: number[][];
  private readonly edgeIndices: Map<string, number>;

  constructor() {
    this.vertexTable = this.buildVertices();
    this.edgeIndices = new Map();
    this.edgeTable = this.buildEdges();
    this.faceTable = this.buildFaces();
  }

  public get vertices(): number[][] {
    return this.vertexTable;
  }

  public get edges(): number[][] {
    return this.edgeTable;
  }

  public get faces(): number[][] {
    return this.faceTable;
  }

  // Index of the edge joining two vertices, for turning a face's vertices into
  // the edges around it. It throws rather than returning undefined: the old
  // version cast the miss to `number`, and a miss then travelled as `undefined`
  // into an index expression and produced a corrupt mesh with nothing thrown.
  public edgeIndex(first: number, second: number): number {
    const key = first < second ? `${first},${second}` : `${second},${first}`;
    const index = this.edgeIndices.get(key);

    if (index === undefined) {
      throw new Error(
        `Icosahedron vertices ${first} and ${second} are not an edge.`,
      );
    }

    return index;
  }

  // The 12 vertices: the *cyclic* permutations of (0, ±1, ±φ). Only the cyclic
  // ones — taking all six would give 24 points and a different solid entirely.
  private buildVertices(): number[][] {
    const vertices: number[][] = [];

    [0, 1, 2].forEach((shift) => {
      [1, -1].forEach((shortSign) => {
        [1, -1].forEach((longSign) => {
          const vertex = [0, 0, 0];
          vertex[(shift + 1) % 3] = shortSign;
          vertex[(shift + 2) % 3] = longSign * PHI;
          vertices.push(vertex);
        });
      });
    });

    return vertices;
  }

  private buildEdges(): number[][] {
    const edges: number[][] = [];

    this.vertexTable.forEach((_, first) => {
      this.vertexTable.forEach((__, second) => {
        if (second > first && this.adjacent(first, second)) {
          this.edgeIndices.set(`${first},${second}`, edges.length);
          edges.push([first, second]);
        }
      });
    });

    return edges;
  }

  // A face is a triple of mutually adjacent vertices. On the icosahedron every
  // such triple is a face, so no further filtering is needed; requiring
  // first < second < third counts each one exactly once.
  private buildFaces(): number[][] {
    const faces: number[][] = [];

    this.vertexTable.forEach((_, first) => {
      this.vertexTable.forEach((__, second) => {
        if (second <= first || !this.adjacent(first, second)) {
          return;
        }

        this.vertexTable.forEach((___, third) => {
          if (
            third > second &&
            this.adjacent(second, third) &&
            this.adjacent(first, third)
          ) {
            faces.push([first, second, third]);
          }
        });
      });
    });

    return faces;
  }

  private adjacent(first: number, second: number): boolean {
    const a = this.vertexTable[first];
    const b = this.vertexTable[second];
    const squared =
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

    return Math.abs(squared - EDGE_LENGTH_SQUARED) < EDGE_TOLERANCE;
  }
}

export default Icosahedron;
