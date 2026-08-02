import type ShapeTransitionContext from "@animations/shapeTransition/ShapeTransitionContext";
import { easeInOutCubic, lerp } from "@animations/shapeTransition/easing";
import type { ShapeTransitionState, TransitionPayload } from "@animations/shapeTransition/types";
import type { StateMachineUpdate } from "@animations/StateMachine";

// Two meshes on screen at once: the one being replaced leaves sideways while
// its replacement drops in from above, so the two are never confused for one
// shape moving.

class SwitchingState {
  public onEnter(
    context: ShapeTransitionContext,
    _controller: unknown,
    payload?: unknown,
  ) {
    const transition = this.requirePayload(payload);

    context.beginSwitch(transition.mesh);
    context.showPair(0, -context.travelY);
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
    context.showPair(
      lerp(0, -context.travelX, progress),
      lerp(-context.travelY, 0, progress),
    );

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

export default SwitchingState;
