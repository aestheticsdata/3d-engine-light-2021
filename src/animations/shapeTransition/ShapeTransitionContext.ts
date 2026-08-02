// What the three states read and write, and the only thing that knows how a
// mesh turns into a render request.
//
// It was a bare mutable record, so each state assembled its own renderable
// literals and the five copies had to agree by hand about which slot carries
// the horizontal travel and which the vertical. Here there are two ways to fill
// the list and no third.

import type Mesh from "@primitives/Mesh";
import type { MeshRenderRequest } from "@primitives/Surface3D";

export interface ShapeTransitionContextOptions {
  duration: number;
  travelX: number;
  travelY: number;
}

class ShapeTransitionContext {
  private readonly durationMs: number;
  private readonly travelXValue: number;
  private readonly travelYValue: number;
  private current: Mesh | null;
  private incoming: Mesh | null;
  private outgoing: Mesh | null;
  private renderList: MeshRenderRequest[];

  constructor(options: ShapeTransitionContextOptions) {
    this.durationMs = options.duration;
    this.travelXValue = options.travelX;
    this.travelYValue = options.travelY;
    this.current = null;
    this.incoming = null;
    this.outgoing = null;
    this.renderList = [];
  }

  // The live list, not a copy: the render loop reads it every frame, and Main
  // walks it to rotate each mesh before painting it.
  public get renderables(): MeshRenderRequest[] {
    return this.renderList;
  }

  public get duration(): number {
    return this.durationMs;
  }

  public get travelX(): number {
    return this.travelXValue;
  }

  public get travelY(): number {
    return this.travelYValue;
  }

  public get currentMesh(): Mesh | null {
    return this.current;
  }

  public get incomingMesh(): Mesh | null {
    return this.incoming;
  }

  public get outgoingMesh(): Mesh | null {
    return this.outgoing;
  }

  // A mesh arrives with nothing on screen: there is no outgoing shape to slide
  // out, and the current one is dropped rather than kept, so an entrance that is
  // interrupted cannot leave a stale mesh behind.
  public beginEntrance(mesh: Mesh) {
    this.current = null;
    this.outgoing = null;
    this.incoming = mesh;
  }

  public beginSwitch(mesh: Mesh) {
    this.outgoing = this.current;
    this.incoming = mesh;
  }

  // The order is load-bearing and is the order the record kept: the incoming
  // mesh becomes the current one BEFORE it is cleared, or the idle state that
  // runs next in the same frame finds no mesh and blanks the screen.
  public settle() {
    this.current = this.incoming;
    this.outgoing = null;
    this.incoming = null;
  }

  public clear() {
    this.outgoing = null;
    this.incoming = null;
  }

  // Takes a nullable mesh because the idle state calls it with whatever is
  // current, and on the very first frame that is nothing at all.
  public showOnly(mesh: Mesh | null, offsetY: number) {
    this.renderList = mesh ? [{ mesh, offsetX: 0, offsetY }] : [];
  }

  // Mid-switch: the outgoing mesh leaves sideways, the incoming one drops in
  // from above. The outgoing one is genuinely optional — switchTo falls back to
  // an entrance when there is nothing on screen, but a state can still be
  // entered with only half a pair.
  public showPair(outgoingOffsetX: number, incomingOffsetY: number) {
    const next: MeshRenderRequest[] = [];

    if (this.outgoing) {
      next.push({ mesh: this.outgoing, offsetX: outgoingOffsetX, offsetY: 0 });
    }

    if (this.incoming) {
      next.push({ mesh: this.incoming, offsetX: 0, offsetY: incomingOffsetY });
    }

    this.renderList = next;
  }
}

export default ShapeTransitionContext;
