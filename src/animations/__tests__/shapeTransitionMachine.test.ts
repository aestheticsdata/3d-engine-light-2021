// The transition machine's observable contract, pinned before COS-388 turned its
// three state literals into classes and unchanged by that conversion.
//
// The subtle one is the transition raised from inside onUpdate: `entering`
// finishes by calling update.transition("idle") while StateMachine.update is
// still on the stack, so idle.onEnter rewrites context.renderables before that
// same frame reads them. A rewrite that defers the transition to the next frame
// would leave one stale frame on screen and pass every eyeball check.

import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import Mesh from "@primitives/Mesh";
import { describe, expect, it } from "vitest";

const DURATION = 100;

// A mesh with no geometry is enough: nothing under test reads a point or a
// triangle.
const emptyMesh = () => new Mesh({ points: [], triangles: [], boundingRadius: 0 });

const machine = () => new ShapeTransitionMachine({ width: 1024, height: 640, duration: DURATION });

describe("playInitialEntrance", () => {
  it("lands in idle with the incoming mesh at rest once the duration is up", () => {
    const transitions = machine();
    const mesh = emptyMesh();

    transitions.playInitialEntrance(mesh, 0);

    expect(transitions.state).toBe("entering");
    expect(transitions.isAnimating()).toBe(true);

    transitions.update(DURATION);

    expect(transitions.state).toBe("idle");
    expect(transitions.isAnimating()).toBe(false);

    const renderables = transitions.getRenderables();
    expect(renderables).toHaveLength(1);
    expect(renderables[0].mesh).toBe(mesh);
    expect(renderables[0].offsetX).toBe(0);
    expect(renderables[0].offsetY).toBe(0);
  });

  it("drops the mesh in from above while the entrance runs", () => {
    const transitions = machine();

    transitions.playInitialEntrance(emptyMesh(), 0);

    expect(transitions.getRenderables()[0].offsetY).toBeLessThan(0);
  });
});

describe("switchTo", () => {
  it("carries the outgoing and the incoming mesh together while in flight", () => {
    const transitions = machine();
    const first = emptyMesh();
    const second = emptyMesh();

    transitions.playInitialEntrance(first, 0);
    transitions.update(DURATION);
    transitions.switchTo(second, DURATION);

    expect(transitions.state).toBe("switching");
    expect(transitions.getRenderables()).toHaveLength(2);

    transitions.update(DURATION * 1.5);

    const midway = transitions.getRenderables();
    expect(midway).toHaveLength(2);
    expect(midway[0].mesh).toBe(first);
    expect(midway[1].mesh).toBe(second);
    // The outgoing mesh leaves sideways, the incoming one arrives from above.
    expect(midway[0].offsetX).toBeLessThan(0);
    expect(midway[1].offsetY).toBeLessThan(0);

    transitions.update(DURATION * 2);

    const settled = transitions.getRenderables();
    expect(transitions.state).toBe("idle");
    expect(settled).toHaveLength(1);
    expect(settled[0].mesh).toBe(second);
  });

  it("plays an entrance instead when there is nothing on screen to replace", () => {
    const transitions = machine();
    const mesh = emptyMesh();

    transitions.switchTo(mesh, 0);

    expect(transitions.state).toBe("entering");
    expect(transitions.getRenderables()).toHaveLength(1);
  });
});

describe("getRenderables", () => {
  // The render loop reads this array every frame. Returning a copy would be a
  // per-frame allocation and would silently break any caller holding on to it.
  it("hands back the same array instance on every call", () => {
    const transitions = machine();
    transitions.playInitialEntrance(emptyMesh(), 0);

    expect(transitions.getRenderables()).toBe(transitions.getRenderables());
  });
});

describe("getActiveMeshes", () => {
  it("dedupes by mesh identity, not by value", () => {
    const transitions = machine();
    const first = emptyMesh();
    const second = emptyMesh();

    // Two meshes that are indistinguishable by value and must still count twice.
    expect(first).toEqual(second);
    expect(first).not.toBe(second);

    transitions.playInitialEntrance(first, 0);
    transitions.update(DURATION);
    transitions.switchTo(second, DURATION);

    const active = transitions.getActiveMeshes();
    expect(active).toHaveLength(2);
    expect(active[0]).toBe(first);
    expect(active[1]).toBe(second);
  });

  it("reports one mesh once it is alone on screen", () => {
    const transitions = machine();
    const mesh = emptyMesh();

    transitions.playInitialEntrance(mesh, 0);
    transitions.update(DURATION);

    expect(transitions.getActiveMeshes()).toHaveLength(1);
    expect(transitions.getActiveMeshes()[0]).toBe(mesh);
  });
});
