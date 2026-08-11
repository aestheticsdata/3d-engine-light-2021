// The bindings table's own invariants.
//
// Two consumers read this array — ShortcutsPanel prints it, KeyboardShortcuts
// dispatches it — and every failure mode here is silent. A live binding with no
// handler prints a chip whose key does nothing; two bindings claiming one key
// give the first one found and leave the other permanently dead; a shape range
// derived past the digit row promises keys no keyboard has. None of them throws,
// and all three ship green without this suite.

import data from "@data/data";
import { PRIMITIVE_COUNT, SHAPE_KEY_COUNT, SHORTCUTS } from "@ui/shortcuts";
import { describe, expect, it } from "vitest";

describe("SHORTCUTS", () => {
  it("gives every live binding an action to run", () => {
    const liveWithoutHandler = SHORTCUTS.filter((binding) => binding.status === "live" && !binding.handler);

    expect(liveWithoutHandler).toEqual([]);
  });

  it("claims each key exactly once, so no binding is shadowed by an earlier one", () => {
    const keys = SHORTCUTS.flatMap((binding) => binding.keys);

    expect(keys.length).toBe(new Set(keys).size);
  });

  it("matches on lower-case keys, which is what the handler compares against", () => {
    const keys = SHORTCUTS.flatMap((binding) => binding.keys);

    expect(keys.every((key) => key === key.toLowerCase())).toBe(true);
  });

  it("stops the shape range at the digit row however large the registry grows", () => {
    expect(PRIMITIVE_COUNT).toBe(Object.keys(data).length);
    expect(SHAPE_KEY_COUNT).toBeLessThanOrEqual(9);
    expect(SHAPE_KEY_COUNT).toBeLessThanOrEqual(PRIMITIVE_COUNT);
  });

  it("prints a range that matches the keys it actually binds", () => {
    const shape = SHORTCUTS.find((binding) => binding.handler === "selectPrimitive");

    expect(shape?.keys.length).toBe(SHAPE_KEY_COUNT);
    expect(shape?.keyLabel).toBe(`1-${SHAPE_KEY_COUNT}`);
    // No two-digit key: every entry has to be one physical press.
    expect(shape?.keys.every((key) => key.length === 1)).toBe(true);
  });

  it("carries no binding still waiting on a listener, now that there is one", () => {
    const statuses = new Set(SHORTCUTS.map((binding) => binding.status));

    expect(statuses.has("live")).toBe(true);
    expect([...statuses].every((status) => status === "live" || status === "pendingFeature")).toBe(true);
  });
});
