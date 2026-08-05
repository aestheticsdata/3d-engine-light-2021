// The world grid: strokes over the floor, sharing the same GroundProjection so
// a grid line and a floor cell agree on where the ground actually is.
//
// Two families of line, and they fade differently because they are shaped
// differently. A row (constant z, varying x) sits at one depth for its whole
// length, so one alpha describes it; a column (constant x, varying z) runs
// from the eye to the horizon, so its fade is a gradient along the stroke
// rather than a single number. Both use a plain linear falloff — E5b owns the
// real fog curve this is standing in for until it lands.
//
// Rows are drawn far to near so the sub-pixel guard can compare each new row
// only against the one immediately before it: near the horizon, consecutive
// rows land within a pixel of each other, and painting every one of them is a
// stroke call for a line nobody can see.
//
// In ORTHOGRAPHIC this still shows a grid rather than collapsing to a point:
// GroundProjection.project(x, z) uses the tangent line to the perspective
// curve at z = 0 in that mode instead of Camera.scaleAt(z)'s own flat "z stops
// mattering" (correct for a mesh vertex, wrong for a ground point whose y is
// one constant rather than a per-vertex value). Nothing here knows that — this
// class calls project(x, z) exactly as it would in PERSPECTIVE, which is the
// point of keeping that exception inside GroundProjection alone.

import { GROUND_DEPTH_METRES, GROUND_HALF_WIDTH_METRES, metresToUnits } from "@rendering/worldScale";
import { chartTokens } from "@ui/chartTokens";

import type GroundProjection from "@rendering/GroundProjection";

const MIN_ROW_GAP_PX = 1.5;
const AXIS_LINE_WIDTH = 1.5;
const GRID_LINE_WIDTH = 1;

// A canvas gradient stop needs its alpha in the colour string itself; the
// tokens below are plain hex, so the fade is applied here rather than baked
// into a second, pre-faded copy of each token.
const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

class GroundGrid {
  private readonly ground: GroundProjection;
  private readonly stepUnits: number;

  constructor(ground: GroundProjection, stepMetres: number) {
    this.ground = ground;
    this.stepUnits = metresToUnits(stepMetres);
  }

  public draw(context: CanvasRenderingContext2D) {
    const nearZ = this.ground.nearZ;
    const farZ = nearZ + metresToUnits(GROUND_DEPTH_METRES);
    const xHalf = metresToUnits(GROUND_HALF_WIDTH_METRES);

    context.save();
    this.drawColumns(context, nearZ, farZ, xHalf);
    this.drawRows(context, nearZ, farZ, xHalf);
    context.restore();
  }

  // Constant x, varying z: the lines that converge on the vanishing point.
  // Each is one moveTo/lineTo from the near clip to the far edge, faded along
  // its own length with a gradient rather than a single alpha.
  private drawColumns(context: CanvasRenderingContext2D, nearZ: number, farZ: number, xHalf: number) {
    const half = Math.floor(xHalf / this.stepUnits);

    for (let k = -half; k <= half; k += 1) {
      const x = k * this.stepUnits;
      const near = this.ground.project(x, nearZ);
      const far = this.ground.project(x, farZ);
      const color = k === 0 ? chartTokens.groundGridAxis : chartTokens.groundGridLine;
      const gradient = context.createLinearGradient(near.x, near.y, far.x, far.y);

      gradient.addColorStop(0, withAlpha(color, 1));
      gradient.addColorStop(1, withAlpha(color, 0));

      context.strokeStyle = gradient;
      context.lineWidth = k === 0 ? AXIS_LINE_WIDTH : GRID_LINE_WIDTH;
      context.beginPath();
      context.moveTo(near.x, near.y);
      context.lineTo(far.x, far.y);
      context.stroke();
    }
  }

  // Constant z, varying x: one depth per line, so one alpha per line. Drawn
  // far to near so the sub-pixel guard compares each row only against the one
  // immediately before it — except the k=0 axis, which always draws regardless
  // of how close its neighbour landed. Without that exception the axis is just
  // another row competing for the guard's one surviving slot per cluster, and
  // a near-tie could drop the one line most worth keeping visible in favour of
  // an adjacent, unremarkable one.
  private drawRows(context: CanvasRenderingContext2D, nearZ: number, farZ: number, xHalf: number) {
    const first = Math.floor(farZ / this.stepUnits);
    const last = Math.ceil(nearZ / this.stepUnits);
    let previousY: number | null = null;

    for (let k = first; k >= last; k -= 1) {
      const z = k * this.stepUnits;
      const left = this.ground.project(-xHalf, z);
      const right = this.ground.project(xHalf, z);
      const isAxis = k === 0;

      if (!isAxis && previousY !== null && Math.abs(left.y - previousY) < MIN_ROW_GAP_PX) {
        continue;
      }

      previousY = left.y;

      const fade = Math.max(0, Math.min(1, 1 - (z - nearZ) / (farZ - nearZ)));
      const color = isAxis ? chartTokens.groundGridAxis : chartTokens.groundGridLine;

      context.strokeStyle = withAlpha(color, fade);
      context.lineWidth = isAxis ? AXIS_LINE_WIDTH : GRID_LINE_WIDTH;
      context.beginPath();
      context.moveTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.stroke();
    }
  }
}

export default GroundGrid;
