// The store's hard guarantees, carried across from the module form COS-367
// replaced. The assertions are unchanged on purpose — that is the whole point of
// having written them first.
//
// Each is the kind of thing a rewrite breaks without throwing: notifying once
// per slice instead of once per reset still repaints the console, just N times;
// copying the listener Set before iterating still delivers, just not to whoever
// joined mid-pass. Both would ship green.
//
// The module form needed vi.resetModules() to get an uncontaminated store per
// test. A class does not — `new UiStateStore()` is the isolation, and losing
// that scaffolding is the first dividend of the conversion.

import { describe, expect, it } from "vitest";

import UiStateStore from "@ui/UiStateStore";
import type { UiState } from "@ui/UiStateStore";

describe("registerSlice", () => {
  it("writes the slice into state and notifies exactly once", () => {
    const store = new UiStateStore();
    const seen: Readonly<UiState>[] = [];
    store.subscribe((state) => seen.push({ ...state }));

    store.registerSlice({ drawnTriangles: 0, sceneSelection: "MESH_01" });

    expect(seen).toEqual([{ drawnTriangles: 0, sceneSelection: "MESH_01" }]);
    expect(store.getState()).toEqual({
      drawnTriangles: 0,
      sceneSelection: "MESH_01",
    });
  });

  // The second write is the one that matters: registerSlice fills `defaults` as
  // well as `state`, and that is the whole reason RESET coverage is automatic.
  it("records the slice as the value RESET restores it to", () => {
    const store = new UiStateStore();
    store.registerSlice({ drawnTriangles: 0 });
    store.setState({ drawnTriangles: 4096 });

    store.resetAll();

    expect(store.getState().drawnTriangles).toBe(0);
  });
});

describe("resetAll", () => {
  it("restores every registered slice in a single notification", () => {
    const store = new UiStateStore();
    store.registerSlice({ drawnTriangles: 0 });
    store.registerSlice({ sceneSelection: "MESH_01" });
    store.registerSlice({ sceneHidden: [] });
    store.setState({
      drawnTriangles: 4096,
      sceneSelection: "GRID_01",
      sceneHidden: ["MESH_01"],
    });

    const seen: Readonly<UiState>[] = [];
    store.subscribe((state) => seen.push({ ...state }));
    store.resetAll();

    expect(seen).toHaveLength(1);
    expect(store.getState()).toEqual({
      drawnTriangles: 0,
      sceneSelection: "MESH_01",
      sceneHidden: [],
    });
  });
});

describe("subscribe", () => {
  it("returns an unsubscribe that stops delivery", () => {
    const store = new UiStateStore();
    const seen: (number | undefined)[] = [];
    const unsubscribe = store.subscribe((state) =>
      seen.push(state.drawnTriangles),
    );

    store.setState({ drawnTriangles: 1 });
    unsubscribe();
    store.setState({ drawnTriangles: 2 });

    expect(seen).toEqual([1]);
    expect(store.getState().drawnTriangles).toBe(2);
  });

  it("delivers in subscription order", () => {
    const store = new UiStateStore();
    const order: string[] = [];
    store.subscribe(() => order.push("first"));
    store.subscribe(() => order.push("second"));

    store.setState({ drawnTriangles: 1 });

    expect(order).toEqual(["first", "second"]);
  });

  // Set.forEach visits entries added while it is iterating, so a listener that
  // subscribes from inside a notification is reached in that same pass. A
  // defensive `[...this.listeners].forEach(...)` in UiStateStore.notify looks
  // harmless and would delay it to the next one.
  it("visits a listener that subscribed during the pass already running", () => {
    const store = new UiStateStore();
    const order: string[] = [];
    store.subscribe(() => {
      order.push("first");
      store.subscribe(() => order.push("late"));
    });

    store.setState({ drawnTriangles: 1 });

    expect(order).toEqual(["first", "late"]);
  });

  // Main subscribes a listener that repaints, and guards itself with a
  // mesh-hidden change detector precisely because notify is synchronous and
  // re-entrant.
  // Queueing or coalescing the nested pass would make that guard the wrong shape.
  it("runs a notification raised from inside a notification immediately", () => {
    const store = new UiStateStore();
    const order: (number | undefined)[] = [];
    let reentered = false;

    store.subscribe((state) => {
      order.push(state.drawnTriangles);

      if (reentered) {
        return;
      }

      reentered = true;
      store.setState({ drawnTriangles: 2 });
    });

    store.setState({ drawnTriangles: 1 });

    expect(order).toEqual([1, 2]);
  });
});

// The inverse of the test this replaces. Through COS-367 and COS-361 the module
// exported a ready-made instance beside the class, and the test pinned the fact
// that everyone got the same one. COS-392 deleted it, so what is worth pinning
// now is that the module hands out no state at all: importing it twice gives two
// callers nothing to share, and two stores cannot contaminate one another.
describe("the module", () => {
  it("exports no instance, only the class", async () => {
    const module = await import("@ui/UiStateStore");

    expect(Object.keys(module)).toEqual(["default"]);
    expect(module.default).toBe(UiStateStore);
  });

  it("gives each instance its own state, defaults and listeners", () => {
    const first = new UiStateStore();
    const second = new UiStateStore();
    const seen: (number | undefined)[] = [];

    first.registerSlice({ drawnTriangles: 0 });
    first.subscribe((state) => seen.push(state.drawnTriangles));

    second.setState({ drawnTriangles: 4096 });

    expect(seen).toEqual([]);
    expect(first.getState().drawnTriangles).toBe(0);

    // `second` registered nothing, so resetAll has no default to restore and
    // must not reach into the slice `first` registered.
    second.resetAll();

    expect(second.getState().drawnTriangles).toBe(4096);
  });
});
