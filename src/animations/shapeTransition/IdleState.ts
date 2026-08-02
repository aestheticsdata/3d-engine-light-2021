import type ShapeTransitionContext from "@animations/shapeTransition/ShapeTransitionContext";

// Nothing is moving: whatever is current sits at the origin, and the two
// transient meshes are dropped so a later switch cannot pick up the last one.
//
// A regular method rather than an arrow property, and that is not a preference:
// StateMachine calls `this.states[state].onEnter?.(…)`, which is a method call
// on this object, so `this` is bound by the call itself.
class IdleState {
  public onEnter(context: ShapeTransitionContext) {
    context.clear();
    context.showOnly(context.currentMesh, 0);
  }
}

export default IdleState;
