import StateMachine, { StateDefinition } from "@animations/StateMachine";
import Mesh from "@primitives/Mesh";
import { MeshRenderRequest } from "@primitives/Surface3D";

type ShapeTransitionState = "idle" | "entering" | "switching";

interface ShapeTransitionOptions {
  width: number;
  height: number;
  duration?: number;
  margin?: number;
}

interface TransitionPayload {
  mesh: Mesh;
}

interface ShapeTransitionContext {
  currentMesh: Mesh | null;
  incomingMesh: Mesh | null;
  outgoingMesh: Mesh | null;
  renderables: MeshRenderRequest[];
  duration: number;
  travelX: number;
  travelY: number;
}

const easeInOutCubic = (progress: number): number =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const requirePayload = (payload?: unknown): TransitionPayload => {
  if (!payload || typeof payload !== "object" || !("mesh" in payload)) {
    throw new Error("Shape transition requires a mesh payload.");
  }

  return payload as TransitionPayload;
};

const states: Record<
  ShapeTransitionState,
  StateDefinition<ShapeTransitionContext, ShapeTransitionState>
> = {
  idle: {
    onEnter: (context) => {
      context.outgoingMesh = null;
      context.incomingMesh = null;
      context.renderables = context.currentMesh
        ? [{ mesh: context.currentMesh, offsetX: 0, offsetY: 0 }]
        : [];
    },
  },
  entering: {
    onEnter: (context, _controller, payload) => {
      const transition = requirePayload(payload);

      context.currentMesh = null;
      context.outgoingMesh = null;
      context.incomingMesh = transition.mesh;
      context.renderables = [
        { mesh: transition.mesh, offsetX: 0, offsetY: -context.travelY },
      ];
    },
    onUpdate: (context, update) => {
      if (!context.incomingMesh) {
        update.transition("idle");
        return;
      }

      const progress = easeInOutCubic(update.progress(context.duration));
      context.renderables = [
        {
          mesh: context.incomingMesh,
          offsetX: 0,
          offsetY: lerp(-context.travelY, 0, progress),
        },
      ];

      if (progress >= 1) {
        context.currentMesh = context.incomingMesh;
        context.incomingMesh = null;
        update.transition("idle");
      }
    },
  },
  switching: {
    onEnter: (context, _controller, payload) => {
      const transition = requirePayload(payload);

      context.outgoingMesh = context.currentMesh;
      context.incomingMesh = transition.mesh;
      context.renderables = [
        ...(context.outgoingMesh
          ? [{ mesh: context.outgoingMesh, offsetX: 0, offsetY: 0 }]
          : []),
        { mesh: transition.mesh, offsetX: 0, offsetY: -context.travelY },
      ];
    },
    onUpdate: (context, update) => {
      if (!context.incomingMesh) {
        update.transition("idle");
        return;
      }

      const progress = easeInOutCubic(update.progress(context.duration));
      const renderables: MeshRenderRequest[] = [];

      if (context.outgoingMesh) {
        renderables.push({
          mesh: context.outgoingMesh,
          offsetX: lerp(0, -context.travelX, progress),
          offsetY: 0,
        });
      }

      renderables.push({
        mesh: context.incomingMesh,
        offsetX: 0,
        offsetY: lerp(-context.travelY, 0, progress),
      });

      context.renderables = renderables;

      if (progress >= 1) {
        context.currentMesh = context.incomingMesh;
        context.outgoingMesh = null;
        context.incomingMesh = null;
        update.transition("idle");
      }
    },
  },
};

class ShapeTransitionMachine {
  private readonly context: ShapeTransitionContext;
  private readonly machine: StateMachine<
    ShapeTransitionContext,
    ShapeTransitionState
  >;

  constructor(options: ShapeTransitionOptions) {
    this.context = {
      currentMesh: null,
      incomingMesh: null,
      outgoingMesh: null,
      renderables: [],
      duration: options.duration ?? 650,
      travelX: options.width + (options.margin ?? 160),
      travelY: options.height + (options.margin ?? 160),
    };

    this.machine = new StateMachine({
      context: this.context,
      initialState: "idle",
      states,
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

  public getActiveMeshes(): Mesh[] {
    return Array.from(
      new Set(
        this.context.renderables.map((renderable) => renderable.mesh),
      ),
    );
  }
}

export default ShapeTransitionMachine;
