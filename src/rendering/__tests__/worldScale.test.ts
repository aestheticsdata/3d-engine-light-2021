// UNITS_PER_METRE and the two conversions built on it, pinned so a future
// change to the ratio is a deliberate edit here too. Every ground dimension in
// the renderer (COS-246) is authored in metres and converted through this
// module alone — grep -rn "UNITS_PER_METRE" src is what proves that in review,
// this file is what proves the conversion itself is right.

import {
  GROUND_DEPTH_METRES,
  GROUND_HALF_WIDTH_METRES,
  GROUND_Y,
  metresToUnits,
  UNITS_PER_METRE,
  unitsToMetres,
} from "@rendering/worldScale";
import { describe, expect, it } from "vitest";

describe("worldScale", () => {
  it("converts metres to units at the defined ratio", () => {
    expect(metresToUnits(1)).toBe(UNITS_PER_METRE);
    expect(metresToUnits(4)).toBe(4 * UNITS_PER_METRE);
    expect(metresToUnits(0)).toBe(0);
  });

  it("converts units back to metres, inverting metresToUnits", () => {
    expect(unitsToMetres(UNITS_PER_METRE)).toBe(1);
    expect(unitsToMetres(metresToUnits(17))).toBeCloseTo(17, 10);
  });

  // 175 is not a round number by accident: it is what keeps the 1.75m eye
  // height the checker floor always assumed, unchanged by COS-246 re-deriving
  // everything else about it.
  it("pins GROUND_Y to the 1.75m eye height the floor has always assumed", () => {
    expect(GROUND_Y).toBe(175);
    expect(GROUND_Y).toBe(metresToUnits(1.75));
  });

  // 60m and ±40m are what GroundGrid and GroundFloor draw out to, and what
  // GroundProjection floors its own ORTHOGRAPHIC falloff reach at — one shared
  // pair rather than three copies of "how far the ground goes."
  it("pins the ground's own extent to 60m deep and 40m to each side", () => {
    expect(GROUND_DEPTH_METRES).toBe(60);
    expect(GROUND_HALF_WIDTH_METRES).toBe(40);
  });
});
