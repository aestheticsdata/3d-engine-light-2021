// RenderStats' own contract, pinned independently of any renderer touching
// it: the sampling cadence, the hold-between-samples behaviour, and the
// depth-bin arithmetic Mesh's clip-cull pass leans on.

import RenderStats, { DEPTH_BIN_COUNT } from "@rendering/RenderStats";
import { describe, expect, it } from "vitest";

describe("RenderStats", () => {
  it("samples every sixth beginFrame call, not the other five", () => {
    const stats = new RenderStats();
    const sampled = Array.from({ length: 12 }, () => stats.beginFrame());

    expect(sampled).toEqual([false, false, false, false, false, true, false, false, false, false, false, true]);
  });

  it("holds the last sampled timing across unsampled frames rather than reading zero", () => {
    const stats = new RenderStats();

    for (let i = 0; i < 5; i++) {
      stats.beginFrame();
    }
    const timed = stats.beginFrame();
    expect(timed).toBe(true);
    stats.addTransformMs(4);
    stats.addClipCullMs(1);
    stats.addRasterMs(2);
    stats.addPresentMs(0.5);
    expect(stats.totalMs).toBeCloseTo(7.5, 10);

    // Five unsampled frames follow; nothing calls add*Ms on them, mirroring
    // the caller's own "only when beginFrame() returned true" contract.
    for (let i = 0; i < 5; i++) {
      const stillTimed = stats.beginFrame();
      expect(stillTimed).toBe(false);
      expect(stats.totalMs).toBeCloseTo(7.5, 10);
    }
  });

  it("sums multiple add*Ms calls within one sampled frame, for two renderables mid-transition", () => {
    const stats = new RenderStats();

    for (let i = 0; i < 5; i++) {
      stats.beginFrame();
    }
    stats.beginFrame();
    stats.addTransformMs(1);
    stats.addTransformMs(1.5);
    stats.addClipCullMs(0.2);
    stats.addClipCullMs(0.3);

    expect(stats.transformMs).toBeCloseTo(2.5, 10);
    expect(stats.clipCullMs).toBeCloseTo(0.5, 10);
  });

  it("resets every count on each beginFrame regardless of sampling, since they cost nothing to rebuild", () => {
    const stats = new RenderStats();

    stats.beginFrame();
    stats.addDrawCall();
    stats.addDrawCall();
    stats.addSubmitted(10);
    stats.addDrawn();
    stats.addFillPx(50);
    stats.addInverted();
    expect(stats.drawCalls).toBe(2);
    expect(stats.submitted).toBe(10);
    expect(stats.drawn).toBe(1);
    expect(stats.fillPx).toBe(50);
    expect(stats.inverted).toBe(1);

    stats.beginFrame();
    expect(stats.drawCalls).toBe(0);
    expect(stats.submitted).toBe(0);
    expect(stats.drawn).toBe(0);
    expect(stats.fillPx).toBe(0);
    expect(stats.inverted).toBe(0);
  });

  it("bins a depth sample at the near edge into bin 0 and at the far edge into the last bin", () => {
    const stats = new RenderStats();
    stats.setDepthRange(100, 200);

    stats.addDepthSample(100);
    stats.addDepthSample(199.999);

    expect(stats.depthBins[0]).toBe(1);
    expect(stats.depthBins[DEPTH_BIN_COUNT - 1]).toBe(1);
  });

  it("clamps a depth sample outside the fixed range into the nearest edge bin rather than throwing", () => {
    const stats = new RenderStats();
    stats.setDepthRange(100, 200);

    stats.addDepthSample(-1000);
    stats.addDepthSample(1000);

    expect(stats.depthBins[0]).toBe(1);
    expect(stats.depthBins[DEPTH_BIN_COUNT - 1]).toBe(1);
  });

  it("falls back to a span of 1 rather than dividing by zero when near equals far", () => {
    const stats = new RenderStats();
    stats.setDepthRange(50, 50);

    expect(() => stats.addDepthSample(50)).not.toThrow();
    expect(stats.depthBins.reduce((total, count) => total + count, 0)).toBe(1);
  });

  it("zero() clears every field, timings and counts alike, for a paused console", () => {
    const stats = new RenderStats();

    for (let i = 0; i < 6; i++) {
      stats.beginFrame();
    }
    stats.addTransformMs(3);
    stats.addRasterMs(1);
    stats.addDrawCall();
    stats.addSubmitted(5);
    stats.setDepthRange(10, 20);
    stats.addDepthSample(15);

    stats.zero();

    expect(stats.transformMs).toBe(0);
    expect(stats.clipCullMs).toBe(0);
    expect(stats.rasterMs).toBe(0);
    expect(stats.presentMs).toBe(0);
    expect(stats.totalMs).toBe(0);
    expect(stats.drawCalls).toBe(0);
    expect(stats.submitted).toBe(0);
    expect(stats.depthNear).toBe(0);
    expect(stats.depthFar).toBe(0);
    expect(stats.depthBins.reduce((total, count) => total + count, 0)).toBe(0);
  });
});
