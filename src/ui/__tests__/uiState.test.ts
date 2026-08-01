// The store's four hard guarantees, pinned before COS-367 rebuilds it as a class.
//
// Each of them is the kind of thing a rewrite breaks without throwing: notifying
// once per slice instead of once per reset still repaints the console, just N
// times; copying the listener Set before iterating still delivers, just not to
// whoever joined mid-pass. Both would ship green.
//
// The store is a module-scope singleton, so every test pulls a fresh copy through
// a reset module registry. Sharing one instance would let a slice registered
// above make a reset assertion below pass for the wrong reason.

import { describe, expect, it, vi } from "vitest";

import type { UiState } from "@ui/uiState";

const freshStore = async (): Promise<typeof import("@ui/uiState")> => {
  vi.resetModules();

  return import("@ui/uiState");
};

describe("registerSlice", () => {
  it("writes the slice into state and notifies exactly once", async () => {
    const store = await freshStore();
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
  it("records the slice as the value RESET restores it to", async () => {
    const store = await freshStore();
    store.registerSlice({ drawnTriangles: 0 });
    store.setState({ drawnTriangles: 4096 });

    store.resetAll();

    expect(store.getState().drawnTriangles).toBe(0);
  });
});

describe("resetAll", () => {
  it("restores every registered slice in a single notification", async () => {
    const store = await freshStore();
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
  it("returns an unsubscribe that stops delivery", async () => {
    const store = await freshStore();
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

  it("delivers in subscription order", async () => {
    const store = await freshStore();
    const order: string[] = [];
    store.subscribe(() => order.push("first"));
    store.subscribe(() => order.push("second"));

    store.setState({ drawnTriangles: 1 });

    expect(order).toEqual(["first", "second"]);
  });

  // Set.forEach visits entries added while it is iterating, so a listener that
  // subscribes from inside a notification is reached in that same pass. A
  // defensive `[...listeners].forEach(...)` in uiState.ts:47 looks harmless and
  // would delay it to the next one.
  it("visits a listener that subscribed during the pass already running", async () => {
    const store = await freshStore();
    const order: string[] = [];
    store.subscribe(() => {
      order.push("first");
      store.subscribe(() => order.push("late"));
    });

    store.setState({ drawnTriangles: 1 });

    expect(order).toEqual(["first", "late"]);
  });

  // index.ts:276-283 subscribes a listener that repaints, and guards itself with
  // a change detector precisely because notify is synchronous and re-entrant.
  // Queueing or coalescing the nested pass would make that guard the wrong shape.
  it("runs a notification raised from inside a notification immediately", async () => {
    const store = await freshStore();
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
