// Everything except present() is plain typed-array arithmetic — no DOM, no
// ImageData — so everything except present() is asserted here. present()'s
// one CanvasRenderingContext2D call is exercised only by hand, in the
// browser, the same as Surface3D's own canvas calls always have been.

import FrameBuffer from "@rendering/FrameBuffer";
import { describe, expect, it } from "vitest";

const snapshotOf = (width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray => {
  const bytes = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < bytes.length; i += 4) {
    bytes[i] = r;
    bytes[i + 1] = g;
    bytes[i + 2] = b;
    bytes[i + 3] = 255;
  }

  return bytes;
};

describe("FrameBuffer", () => {
  it("reports the size it was constructed with", () => {
    const buffer = new FrameBuffer(4, 3);
    expect(buffer.bufferWidth).toBe(4);
    expect(buffer.bufferHeight).toBe(3);
  });

  it("seeds the colour buffer from the snapshot and the depth buffer to the beats-everything sentinel", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.clear(snapshotOf(2, 2, 10, 20, 30));

    expect(buffer.readPixel(0, 0)).toEqual([10, 20, 30, 1]);
    expect(buffer.readPixel(1, 1)).toEqual([10, 20, 30, 1]);
    // 0 is the sentinel: any triangle whose d falls inside Camera's [near,
    // far] produces a strictly positive 1/d, which must beat it.
    expect(buffer.depthTestPasses(0, 0, 0.0001)).toBe(true);
  });

  it("passes the depth test for a nearer (larger 1/d) candidate and fails for a farther one", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.clear(snapshotOf(2, 2, 0, 0, 0));
    buffer.writePixel(0, 0, 0.5, 255, 0, 0, 1);

    expect(buffer.depthTestPasses(0, 0, 0.8)).toBe(true);
    expect(buffer.depthTestPasses(0, 0, 0.3)).toBe(false);
  });

  it("writes an opaque pixel outright, ignoring whatever was underneath", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.clear(snapshotOf(2, 2, 10, 10, 10));
    buffer.writePixel(1, 0, 1, 200, 100, 50, 1);

    expect(buffer.readPixel(1, 0)).toEqual([200, 100, 50, 1]);
  });

  it("blends a translucent pixel against the buffer's existing colour", () => {
    const buffer = new FrameBuffer(1, 1);
    buffer.clear(snapshotOf(1, 1, 0, 0, 0));
    buffer.writePixel(0, 0, 1, 200, 100, 40, 0.5);

    expect(buffer.readPixel(0, 0)).toEqual([100, 50, 20, 1]);
  });

  it("writes the depth unconditionally on a translucent pixel, not scaled by alpha", () => {
    const buffer = new FrameBuffer(1, 1);
    buffer.clear(snapshotOf(1, 1, 0, 0, 0));
    buffer.writePixel(0, 0, 0.7, 200, 100, 40, 0.3);

    expect(buffer.depthTestPasses(0, 0, 0.8)).toBe(true);
    expect(buffer.depthTestPasses(0, 0, 0.6)).toBe(false);
  });

  it("does not blend colour written for one pixel into its neighbours", () => {
    const buffer = new FrameBuffer(2, 1);
    buffer.clear(snapshotOf(2, 1, 0, 0, 0));
    buffer.writePixel(0, 0, 1, 255, 0, 0, 1);

    expect(buffer.readPixel(0, 0)).toEqual([255, 0, 0, 1]);
    expect(buffer.readPixel(1, 0)).toEqual([0, 0, 0, 1]);
  });

  it("reallocates on a real size change and keeps the new size", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.setSize(5, 6);

    expect(buffer.bufferWidth).toBe(5);
    expect(buffer.bufferHeight).toBe(6);
    buffer.clear(snapshotOf(5, 6, 1, 2, 3));
    expect(buffer.readPixel(4, 5)).toEqual([1, 2, 3, 1]);
  });

  it("does nothing on setSize with the same width and height", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.clear(snapshotOf(2, 2, 9, 9, 9));
    buffer.writePixel(0, 0, 1, 1, 1, 1, 1);
    buffer.setSize(2, 2);

    // A reallocation would have wiped the pixel this write just placed.
    expect(buffer.readPixel(0, 0)).toEqual([1, 1, 1, 1]);
  });

  it("does not carry a resized buffer's stale pixels into the new allocation", () => {
    const buffer = new FrameBuffer(2, 2);
    buffer.clear(snapshotOf(2, 2, 9, 9, 9));
    buffer.writePixel(0, 0, 1, 200, 0, 0, 1);
    buffer.setSize(3, 3);
    buffer.clear(snapshotOf(3, 3, 1, 1, 1));

    expect(buffer.readPixel(0, 0)).toEqual([1, 1, 1, 1]);
  });

  it("blends the same colour writePixel would, for the same alpha", () => {
    const blended = new FrameBuffer(1, 1);
    const written = new FrameBuffer(1, 1);
    blended.clear(snapshotOf(1, 1, 0, 0, 0));
    written.clear(snapshotOf(1, 1, 0, 0, 0));

    blended.blendPixel(0, 0, 200, 100, 40, 0.5);
    written.writePixel(0, 0, 1, 200, 100, 40, 0.5);

    expect(blended.readPixel(0, 0)).toEqual(written.readPixel(0, 0));
  });

  // E3d/COS-244's edge feather, and the difference the whole pass turns on: a
  // partially covered pixel tints what is already there without taking ownership
  // of the depth, so the surface behind it can still be drawn into the part of
  // the pixel the feather never covered.
  it("leaves the depth untouched, so a farther fragment can still reach a feathered pixel", () => {
    const buffer = new FrameBuffer(1, 1);
    buffer.clear(snapshotOf(1, 1, 0, 0, 0));
    buffer.writePixel(0, 0, 0.5, 0, 0, 0, 1);
    buffer.blendPixel(0, 0, 255, 255, 255, 0.5);

    // The blend moved the colour, and moved the depth test not at all.
    expect(buffer.readPixel(0, 0)).toEqual([128, 128, 128, 1]);
    expect(buffer.depthTestPasses(0, 0, 0.6)).toBe(true);
    expect(buffer.depthTestPasses(0, 0, 0.4)).toBe(false);
  });
});
