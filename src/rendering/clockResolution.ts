// Whether performance.now() on this page can actually resolve the stage
// split FrameTimeWidget draws (E6/COS-239).
//
// Chromium clamps the clock to 100µs outside cross-origin isolation and
// coarser still in Firefox and Safari; cross-origin isolated pages (which
// vite.config.js's dev headers make this one, in dev) drop to 5µs. Against a
// four-millisecond frame a one-millisecond clamp does not split into four
// honest numbers, it splits into noise wearing four labels — so the split is
// gated on a boot-time probe rather than trusted unconditionally.
//
// The probe busy-waits for real ticks rather than asserting a browser/flag
// combination, because the answer is what this page's headers actually
// achieved, not what the platform advertises.

const CLOCK_PROBE_TARGET_SAMPLES = 50;
// A generous ceiling so a coarse clock still gets its 50 samples rather than
// being cut off mid-probe and misread as "unresolvable": even at a 1ms clamp,
// 200,000 near-free iterations comfortably cross 50 tick boundaries.
const CLOCK_PROBE_MAX_ITERATIONS = 200_000;

export const CLOCK_RESOLUTION_THRESHOLD_MS = 0.2;

// The smallest nonzero gap this page's clock produced between two
// back-to-back reads, in milliseconds — Infinity if the probe never observed
// one at all.
export const probeClockResolutionMs = (): number => {
  let smallestDelta = Number.POSITIVE_INFINITY;
  let observed = 0;
  let previous = performance.now();

  for (
    let iteration = 0;
    iteration < CLOCK_PROBE_MAX_ITERATIONS && observed < CLOCK_PROBE_TARGET_SAMPLES;
    iteration += 1
  ) {
    const now = performance.now();
    const delta = now - previous;

    if (delta > 0) {
      smallestDelta = Math.min(smallestDelta, delta);
      observed += 1;
      previous = now;
    }
  }

  return smallestDelta;
};
