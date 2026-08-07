// The GEOMETRY card's five counts and the POLY BUDGET bar under them.
//
// All five are real now (E6/COS-239). VERTICES and TRIANGLES are summed over
// the meshes actually submitted to Surface3D this frame rather than read off
// the current primitive, which is what keeps them right in the two places the
// registry count is wrong: a shape transition puts two meshes on screen at
// once, and hiding the mesh from the scene graph submits none at all. EDGES is
// derived from TRIANGLES. DRAW CALLS is canvas submissions per frame — one per
// drawn triangle, plus one per background LAYER that painted (E5b/COS-247,
// where it used to be one for the whole background pass whether that pass drew
// two layers or six) — read off RenderStats rather than derived here, since
// Mesh, Surface3D and BackgroundRenderer are the only classes that know when a
// fill(), stroke() or drawImage() actually happened.
//
// The two halves are counted at different granularities on purpose. The checker
// floor is 900 cell fills at the shipped grid step, which would bury the subject
// of the frame under its scenery; the mesh is the subject, so its count stays
// per triangle. What the row is worth reading for is that it now moves when an
// ENVIRONMENT switch does.
//
// pushFrame() and render() are split the way FramerateWidget splits them, and
// for the same reason: the push half runs on the paint path, where the
// submitted meshes and the render pass's own counts are both in hand and
// provably describe the same frame, while render() — six field writes and two
// style writes — rides the same 90ms display gate as the rest of the telemetry
// row.

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
// the twenty shapes and say nothing on the other nineteen. Derived from the
// registry instead and rounded up to a power of two. The label prints it, so
// the denominator documents itself.
//
// It is still 8192, and that is a decision rather than a coincidence. COS-410's
// three new knots each need a longer curve than the trefoil and would have
// pushed the registry maximum past 8192 at the trefoil's tube resolution,
// doubling this to 16384 and halving the bar for every other shape in the
// console. TorusKnotGenerator holds them under it instead by trading tube
// segments for path segments, so the densest shape in the registry is now 8008
// and this number has not moved. Nothing enforces that from here — the budget
// is derived, so it would move silently — which is why the ceiling is asserted
// on the other side, in TorusKnotGenerator and its suite.
const REGISTRY_MAX_TRIANGLES = Math.max(...Object.values(data).map((object3D) => object3D.triangles.length));

export const POLY_BUDGET = 2 ** Math.ceil(Math.log2(REGISTRY_MAX_TRIANGLES));

// Five arguments, so an options object rather than a positional list (R4). The
// renderables are here for VERTICES, which only the mesh list knows; every
// other field is read off the frame's RenderStats rather than re-derived, so
// the card cannot drift from what the renderer actually did.
export interface GeometryFrame {
  renderables: readonly MeshRenderRequest[];
  submitted: number;
  drawn: number;
  drawCalls: number;
  cullBackfaces: boolean;
}

class GeometryWidget {
  private readonly fields: FieldWriter;
  private readonly barFills: HTMLElement[];
  private vertices: number;
  private submitted: number;
  private culled: number;
  private drawCalls: number;

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
    this.drawCalls = 0;
  }

  // Cheap enough for the paint path: one reduction over at most two
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
  public pushFrame(frame: GeometryFrame) {
    this.vertices = frame.renderables.reduce((total, renderable) => total + renderable.mesh.pointCount, 0);
    this.submitted = frame.submitted;
    this.drawCalls = frame.drawCalls;
    // Nothing is culled while the test is off: every submitted triangle is
    // drawn, and the row must read 0 rather than reporting the degenerate-UV
    // skips on their own. Clamped at 0 rather than left to go negative
    // (COS-418/E2b): a triangle split at the near plane can draw as two
    // fragments, so drawn can now exceed submitted for the frame it is in.
    this.culled = frame.cullBackfaces ? Math.max(0, this.submitted - frame.drawn) : 0;
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
    this.fields.write("geoDrawCalls", this.drawCalls.toLocaleString());
    this.fields.write("polyBudget", `${this.submitted} / ${POLY_BUDGET}`);

    this.barFills.forEach((fill) => {
      fill.style.width = `${percent.toFixed(1)}%`;
    });
  }

  // The pause half of the frame-time ticket's own zeroing (E6/COS-239):
  // draw calls are a render-pass count like fill rate, not a scene fact like
  // VERTICES/TRIANGLES, so this alone resets on stop rather than the whole
  // card.
  public zeroDrawCalls() {
    this.drawCalls = 0;
  }
}

export default GeometryWidget;
