// The 90ms publish throttle, which T03 could not cover because there was no
// module to point it at — the logic was a private method on Main reading
// performance.now() and writing through setField in the same breath. Extracting
// FPSMeter is what makes it testable, so the suite lands with the extraction.
//
// The clock is a plain counter. Nothing here waits on real time.

import FPSMeter from "@app/FPSMeter";
import { describe, expect, it } from "vitest";

const WINDOW_MS = 90;

describe("sample", () => {
  it("publishes at most once per throttle window and returns null in between", () => {
    const clock = { value: 1000 };
    const meter = new FPSMeter(() => clock.value);

    // The first call publishes: nothing has been published yet, so the whole
    // elapsed time counts as the window.
    expect(meter.sample()).not.toBeNull();

    clock.value = 1000 + WINDOW_MS - 1;
    expect(meter.sample()).toBeNull();

    clock.value = 1000 + WINDOW_MS;
    expect(meter.sample()).not.toBeNull();
  });

  // The readout must not reflow once per frame. At 60fps that is six writes per
  // hundred milliseconds, which is unreadable — the whole reason the throttle
  // exists.
  it("publishes roughly eleven times per second at 60fps, not sixty", () => {
    const clock = { value: 1000 };
    const meter = new FPSMeter(() => clock.value);
    const published: number[] = [];

    for (let frame = 0; frame < 60; frame += 1) {
      clock.value = 1000 + Math.round((frame * 1000) / 60);
      const rate = meter.sample();

      if (rate !== null) {
        published.push(rate);
      }
    }

    expect(published.length).toBeGreaterThan(8);
    expect(published.length).toBeLessThan(14);
  });

  it("reports the count of frames inside the trailing one-second window", () => {
    const clock = { value: 0 };
    const meter = new FPSMeter(() => clock.value);

    // Ten frames 100ms apart, then a sample far enough ahead to publish. The
    // window is wall-clock, so entries older than a second fall out on their
    // own.
    for (let frame = 0; frame < 10; frame += 1) {
      clock.value = frame * 100;
      meter.sample();
    }

    clock.value = 1000;
    expect(meter.sample()).toBeGreaterThan(0);
  });
});

describe("rawFps", () => {
  // The framerate widget's sparkline needs a value every rendered frame, not
  // once per 90ms — reading the throttled sample() return would flatten the
  // history to the publish cadence instead of one point per frame.
  it("updates on every call even while the publish throttle returns null", () => {
    const clock = { value: 1000 };
    const meter = new FPSMeter(() => clock.value);

    meter.sample();
    expect(meter.rawFps).toBe(1);

    clock.value = 1000 + WINDOW_MS - 1;
    expect(meter.sample()).toBeNull();
    expect(meter.rawFps).toBe(2);
  });
});

describe("reset", () => {
  it("lets the next sample publish immediately", () => {
    const clock = { value: 1000 };
    const meter = new FPSMeter(() => clock.value);

    meter.sample();
    clock.value = 1010;
    expect(meter.sample()).toBeNull();

    meter.reset();
    expect(meter.sample()).not.toBeNull();
  });
});
