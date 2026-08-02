import type ShapeTransitionContext from "@animations/shapeTransition/ShapeTransitionContext";
import { easeInOutCubic, lerp } from "@animations/shapeTransition/easing";
import type { ShapeTransitionState, TransitionPayload } from "@animations/shapeTransition/types";
import type { StateMachineUpdate } from "@animations/StateMachine";

// The first shape of the session drops in from above with nothing to replace.

class EnteringState {
  public onEnter(
    context: ShapeTransitionContext,
    _controller: unknown,
    payload?: unknown,
  ) {
    const transition = this.requirePayload(payload);

    context.beginEntrance(transition.mesh);
    context.showOnly(transition.mesh, -context.travelY);
  }

  public onUpdate(
    context: ShapeTransitionContext,
    update: StateMachineUpdate<ShapeTransitionContext, ShapeTransitionState>,
  ) {
    if (!context.incomingMesh) {
      update.transition("idle");

      return;
    }

    const progress = easeInOutCubic(update.progress(context.duration));
    context.showOnly(context.incomingMesh, lerp(-context.travelY, 0, progress));

    // settle() before the transition, not after: the transition runs idle's
    // onEnter synchronously, inside this same frame, and idle renders whatever
    // is current at that moment.
    if (progress >= 1) {
      context.settle();
      update.transition("idle");
    }
  }

  private requirePayload(payload?: unknown): TransitionPayload {
    if (!payload || typeof payload !== "object" || !("mesh" in payload)) {
      throw new Error("Shape transition requires a mesh payload.");
    }

    return payload as TransitionPayload;
  }
}

export default EnteringState;
