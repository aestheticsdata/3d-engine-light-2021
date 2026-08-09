import { isPolygonOnScreen } from "@rendering/screenVisibility";
import { describe, expect, it } from "vitest";

describe("isPolygonOnScreen", () => {
  it("keeps a polygon entirely inside the frame", () => {
    const points = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(true);
  });

  it("drops a polygon entirely to the left of the frame", () => {
    const points = [
      { x: -300, y: 100 },
      { x: -200, y: 100 },
      { x: -200, y: 200 },
      { x: -300, y: 200 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(false);
  });

  it("drops a polygon entirely to the right of the frame", () => {
    const points = [
      { x: 1100, y: 100 },
      { x: 1200, y: 100 },
      { x: 1200, y: 200 },
      { x: 1100, y: 200 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(false);
  });

  it("drops a polygon entirely above the frame", () => {
    const points = [
      { x: 100, y: -200 },
      { x: 200, y: -200 },
      { x: 200, y: -100 },
      { x: 100, y: -100 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(false);
  });

  it("drops a polygon entirely below the frame", () => {
    const points = [
      { x: 100, y: 700 },
      { x: 200, y: 700 },
      { x: 200, y: 800 },
      { x: 100, y: 800 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(false);
  });

  it("keeps a polygon that straddles an edge", () => {
    const points = [
      { x: -50, y: 100 },
      { x: 50, y: 100 },
      { x: 50, y: 200 },
      { x: -50, y: 200 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(true);
  });

  it("keeps a polygon whose bounding box only touches the frame's edge", () => {
    const points = [
      { x: 1024, y: 100 },
      { x: 1124, y: 100 },
      { x: 1124, y: 200 },
      { x: 1024, y: 200 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(true);
  });

  it("keeps a polygon that fully encloses the frame", () => {
    const points = [
      { x: -1000, y: -1000 },
      { x: 2000, y: -1000 },
      { x: 2000, y: 2000 },
      { x: -1000, y: 2000 },
    ];

    expect(isPolygonOnScreen(points, 1024, 640)).toBe(true);
  });
});
