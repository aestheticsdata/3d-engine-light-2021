import StateMachine from "@animations/StateMachine";
import EnteringState from "@animations/shapeTransition/EnteringState";
import IdleState from "@animations/shapeTransition/IdleState";
import ShapeTransitionContext from "@animations/shapeTransition/ShapeTransitionContext";
import SwitchingState from "@animations/shapeTransition/SwitchingState";

import type { ShapeTransitionState } from "@animations/shapeTransition/types";
import type Mesh from "@primitives/Mesh";
import type { MeshRenderRequest } from "@primitives/Surface3D";

interface ShapeTransitionOptions {
  width: number;
  height: number;
  duration?: number;
  margin?: number;
}

class ShapeTransitionMachine {
  private readonly context: ShapeTransitionContext;
  private readonly machine: StateMachine<ShapeTransitionContext, ShapeTransitionState>;

  constructor(options: ShapeTransitionOptions) {
    // How far off-screen a mesh starts and ends. One margin for both axes,
    // resolved once — it was applied twice, so a caller passing a margin had it
    // read from two places that could drift apart.
    const margin = options.margin ?? 160;

    this.context = new ShapeTransitionContext({
      duration: options.duration ?? 650,
      travelX: options.width + margin,
      travelY: options.height + margin,
    });

    // A fresh state object per machine. That is only equivalent to the shared
    // table it replaces because none of the three holds a field: give one state
    // some state of its own and two machines stop agreeing.
    this.machine = new StateMachine({
      context: this.context,
      initialState: "idle",
      states: {
        idle: new IdleState(),
        entering: new EnteringState(),
        switching: new SwitchingState(),
      },
    });
  }

  public get state(): ShapeTransitionState {
    return this.machine.state;
  }

  public isAnimating(): boolean {
    return this.machine.state !== "idle";
  }

  public update(now: number) {
    this.machine.update(now);
  }

  public syncClock(now: number) {
    this.machine.rebaseTime(now);
  }

  public playInitialEntrance(mesh: Mesh, now: number) {
    this.machine.transition("entering", { mesh }, now);
  }

  public switchTo(mesh: Mesh, now: number) {
    if (!this.context.currentMesh) {
      this.playInitialEntrance(mesh, now);

      return;
    }

    this.machine.transition("switching", { mesh }, now);
  }

  public getRenderables(): MeshRenderRequest[] {
    return this.context.renderables;
  }

  // Deduped by identity rather than by value: the camera writes focal length and
  // z offset straight onto these objects, so they have to be the very meshes
  // being drawn.
  public getActiveMeshes(): Mesh[] {
    return Array.from(new Set(this.context.renderables.map((renderable) => renderable.mesh)));
  }
}

export default ShapeTransitionMachine;
