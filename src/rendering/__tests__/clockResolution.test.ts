// The boot-time clock probe, checked for the shape it must have rather than
// for a specific resolution — the real answer depends on the machine and the
// isolation headers actually in effect, which a unit test cannot pin.

import { CLOCK_RESOLUTION_THRESHOLD_MS, probeClockResolutionMs } from "@rendering/clockResolution";
import { describe, expect, it } from "vitest";

describe("clockResolution", () => {
  it("returns a positive, finite number of milliseconds", () => {
    const resolution = probeClockResolutionMs();

    expect(resolution).toBeGreaterThan(0);
    expect(Number.isFinite(resolution)).toBe(true);
  });

  it("pins the threshold FrameTimeWidget gates on to 0.2ms", () => {
    expect(CLOCK_RESOLUTION_THRESHOLD_MS).toBe(0.2);
  });
});
