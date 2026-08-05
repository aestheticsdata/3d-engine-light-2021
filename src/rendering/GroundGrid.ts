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

import GroundNearClip from "@rendering/GroundNearClip";
import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";
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
  private readonly clip: GroundNearClip;
  private readonly stepUnits: number;

  constructor(ground: GroundProjection, stepMetres: number) {
    this.ground = ground;
    this.clip = new GroundNearClip(ground);
    this.stepUnits = metresToUnits(stepMetres);
  }

  public draw(context: CanvasRenderingContext2D) {
    // Square and centred on the target, matching GroundFloor: a forward-only
    // span is a ribbon off to one side the moment the camera yaws.
    const reach = metresToUnits(GROUND_DEPTH_METRES);

    context.save();
    this.drawLines(context, reach, true);
    this.drawLines(context, reach, false);
    context.restore();
  }

  // One routine for both families. They differ only in which coordinate is held
  // constant, and once the camera can turn there is no longer a meaningful
  // difference between "the lines that converge" and "the lines at one depth" —
  // a yaw of 90° swaps their roles entirely. Both are therefore faded along
  // their own length by depth rather than one of them getting a single alpha.
  private drawLines(context: CanvasRenderingContext2D, reach: number, alongZ: boolean) {
    const half = Math.floor(reach / this.stepUnits);
    const near = this.ground.nearDepth;
    const fadeSpan = 2 * reach;
    let previous: { x: number; y: number } | null = null;

    for (let k = -half; k <= half; k += 1) {
      const fixed = k * this.stepUnits;
      const from = alongZ ? { x: fixed, z: -reach } : { x: -reach, z: fixed };
      const to = alongZ ? { x: fixed, z: reach } : { x: reach, z: fixed };
      const visible = this.clip.segment(from, to);

      if (!visible) {
        continue;
      }

      const [start, end] = visible;
      const a = this.ground.project(start.x, start.z);
      const b = this.ground.project(end.x, end.z);
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      // The sub-pixel guard, now measured between consecutive lines' midpoints
      // rather than down a screen axis: adjacent grid values stay adjacent on
      // screen at any camera angle, but "adjacent in y" stops being true the
      // moment a yaw turns these lines sideways. The axis always draws.
      if (k !== 0 && previous && Math.hypot(middle.x - previous.x, middle.y - previous.y) < MIN_ROW_GAP_PX) {
        continue;
      }

      previous = middle;

      const color = k === 0 ? chartTokens.groundGridAxis : chartTokens.groundGridLine;
      const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);

      gradient.addColorStop(0, withAlpha(color, this.fadeAt(start.x, start.z, near, fadeSpan)));
      gradient.addColorStop(1, withAlpha(color, this.fadeAt(end.x, end.z, near, fadeSpan)));

      context.strokeStyle = gradient;
      context.lineWidth = k === 0 ? AXIS_LINE_WIDTH : GRID_LINE_WIDTH;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  // Linear in real eye depth rather than in world z, so the falloff stays put
  // as the camera turns instead of sweeping round with it. E5b owns the real
  // fog curve this stands in for.
  private fadeAt(x: number, z: number, near: number, span: number): number {
    const depth = this.ground.depthAt(x, z);

    return Math.max(0, Math.min(1, 1 - (depth - near) / span));
  }
}

export default GroundGrid;
