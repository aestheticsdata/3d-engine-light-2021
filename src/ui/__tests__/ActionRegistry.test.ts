// Everything except bindDomActions, which is the one method that needs a
// document — the same split FrameBuffer's suite makes around present().
//
// The behaviour worth pinning is the loud failure. A registry that returned
// quietly on an unknown id would turn a typo in a data-action attribute, or a
// binding naming an action nobody registered, into a control that silently does
// nothing — which is indistinguishable from the placeholder affordance this
// whole epic exists to remove.

import ActionRegistry from "@ui/ActionRegistry";
import { describe, expect, it, vi } from "vitest";

describe("ActionRegistry", () => {
  it("runs the handler registered under an id", () => {
    const registry = new ActionRegistry();
    const handler = vi.fn();

    registry.register("stepFrame", handler);
    registry.run("stepFrame");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("throws rather than doing nothing when an id has no handler", () => {
    const registry = new ActionRegistry();

    expect(() => registry.run("stepFrame")).toThrow(/stepFrame/);
  });

  it("passes the argument through for the one action that carries one", () => {
    const registry = new ActionRegistry();
    const handler = vi.fn();

    registry.register("selectPrimitive", handler);
    registry.run("selectPrimitive", 4);

    expect(handler).toHaveBeenCalledWith(4);
  });

  it("hands undefined to an action invoked without one, rather than a stale value", () => {
    const registry = new ActionRegistry();
    const handler = vi.fn();

    registry.register("selectPrimitive", handler);
    registry.run("selectPrimitive", 2);
    registry.run("selectPrimitive");

    expect(handler).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps the last registration for an id, so a re-register cannot leave two live handlers", () => {
    const registry = new ActionRegistry();
    const first = vi.fn();
    const second = vi.fn();

    registry.register("togglePause", first);
    registry.register("togglePause", second);
    registry.run("togglePause");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
