// The GEOMETRY card's five counts and the POLY BUDGET bar under them.
//
// Four of the five are real. VERTICES and TRIANGLES are summed over the meshes
// actually submitted to Surface3D this frame rather than read off the current
// primitive, which is what keeps them right in the two places the registry
// count is wrong: a shape transition puts two meshes on screen at once, and
// hiding the mesh from the scene graph submits none at all. EDGES is derived
// from TRIANGLES. DRAW CALLS is a static placeholder in the markup and this
// class never touches it — a software rasteriser with no batching would report
// a constant 1, and what that number should mean is de-mock E6's call.
//
// pushFrame() and render() are split the way FramerateWidget splits them, and
// for the same reason: pushFrame() runs on the paint path, where the submitted
// meshes and the drawn count are both in hand and provably describe the same
// frame, while render() — five field writes and two style writes — rides the
// same 90ms display gate as the rest of the telemetry row.

import data from "@data/data";
import DOMScope from "@ui/DOMScope";

import type { MeshRenderRequest } from "@primitives/Surface3D";
import type FieldWriter from "@ui/FieldWriter";

// E = 3F/2, exact for a closed manifold triangle mesh — the sphere, cube,
// pyramid, cuboctahedron, donut and torus knot all satisfy it. The shapes built
// from open or duplicated faces carry some edges twice, so this row is a
// derivation, not a measurement. It is not flagged as approximate in the UI:
// the card reports scene complexity, and a count exact for most of the registry
// is what that row is for.
const EDGES_PER_TRIANGLE = 1.5;

// The design's 4096 budget does not fit this repo — the torus knot alone builds
// 7920 triangles, so a hardcoded ceiling would pin the bar at 100% on one of
// the fourteen shapes and say nothing on the other thirteen. Derived from the
// registry instead and rounded up to a power of two: 8192 today, and it moves
// on its own the day COS-201 lands a denser polyhedron. The label prints it, so
// the denominator documents itself.
const REGISTRY_MAX_TRIANGLES = Math.max(...Object.values(data).map((object3D) => object3D.triangles.length));

export const POLY_BUDGET = 2 ** Math.ceil(Math.log2(REGISTRY_MAX_TRIANGLES));

class GeometryWidget {
  private readonly fields: FieldWriter;
  private readonly barFills: HTMLElement[];
  private vertices: number;
  private submitted: number;
  private culled: number;

  constructor(fields: FieldWriter) {
    const scope = new DOMScope(document);
    const missing = "GEOMETRY node is missing.";

    this.fields = fields;
    // Two bars behind one number. The desktop card's footer and BUDGETS' mobile
    // block are both in the DOM at once — only the media query decides which is
    // painted — so the width goes to both, exactly as FieldWriter writes text
    // to every matching node. A width is a style, not textContent, which is why
    // these two are resolved by hand instead.
    this.barFills = [
      scope.require<HTMLElement>("#geometryBudgetFill", missing),
      scope.require<HTMLElement>("#budgetsPolyFill", missing),
    ];
    this.vertices = 0;
    this.submitted = 0;
    this.culled = 0;
  }

  // Cheap enough for the paint path: two reductions over at most two
  // renderables and one subtraction.
  //
  // That subtraction is culled *plus clipped plus skipped*, not culled alone.
  // Triangle.render() returns false at three guards, and Mesh.renderMesh only
  // counts a truthy return: the backface test, the near/far rejection COS-236
  // added, and the degenerate-UV skip. The clipped ones are reachable at every
  // session — the whole point of the near plane is that a shape pushed close
  // enough loses faces to it — so this row over-counts wherever CULL is on and
  // the zoom is high, and de-mock E6's real instrumentation is what separates
  // the three.
  //
  // The other direction is worse and is deliberate: with CULL off the row reads
  // 0 while clipped triangles are still going missing. Reporting them as CULLED
  // would be a different lie, and there is nowhere honest to put them until E6.
  public pushFrame(renderables: readonly MeshRenderRequest[], drawn: number, cullBackfaces: boolean) {
    this.vertices = renderables.reduce((total, renderable) => total + renderable.mesh.pointCount, 0);
    this.submitted = renderables.reduce((total, renderable) => total + renderable.mesh.triangleCount, 0);
    // Nothing is culled while the test is off: every submitted triangle is
    // drawn, and the row must read 0 rather than reporting the degenerate-UV
    // skips on their own.
    this.culled = cullBackfaces ? this.submitted - drawn : 0;
  }

  public render() {
    // Clamped, and not defensively: a shape transition submits two meshes at
    // once, and the two densest in the registry together exceed the budget the
    // larger of them sets.
    const percent = Math.min(100, (this.submitted / POLY_BUDGET) * 100);

    this.fields.write("geoVertices", this.vertices);
    this.fields.write("geoEdges", Math.round(this.submitted * EDGES_PER_TRIANGLE));
    this.fields.write("geoTriangles", this.submitted);
    this.fields.write("geoCulled", this.culled);
    this.fields.write("polyBudget", `${this.submitted} / ${POLY_BUDGET}`);

    this.barFills.forEach((fill) => {
      fill.style.width = `${percent.toFixed(1)}%`;
    });
  }
}

export default GeometryWidget;
