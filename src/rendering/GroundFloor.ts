// The checker floor: the ground's other pass, sharing the same GroundProjection
// as GroundGrid so a floor cell and a grid line agree on where the ground is.
//
// Its own file for the same reason GroundGrid got one (COS-246, R17): pulled
// out so BackgroundRenderer stays the class that owns layer flags and pass
// order, not the class that also derives every quad.
//
// The cell equals the current grid step rather than a fixed size, so the floor
// and an overlaid grid line always land on the same edge.
//
// The sheet is square and centred on the orbit target rather than running
// forward from the eye. That changed when the camera learned to turn: a
// forward-only sheet is correct only while the camera looks down +z, and at a
// yaw of 90° it becomes a ribbon running off sideways with no ground at all
// over half the frame. Cells behind the near plane are trimmed rather than
// dropped — they are the largest on screen, so dropping one leaves a hole
// across the foreground.

import GroundNearClip from "@rendering/GroundNearClip";
import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";

import type { GroundVertex } from "@rendering/GroundNearClip";
import type GroundProjection from "@rendering/GroundProjection";

// The outer share of the ground's radius that the rim dissolve occupies. The
// inner three-quarters stay fully opaque.
const RIM_FADE_FRACTION = 0.25;

const FLOOR_LIGHT_CELL = "rgba(244, 243, 238, 1)";
const FLOOR_DARK_CELL = "rgba(122, 124, 128, 1)";

class GroundFloor {
  private readonly ground: GroundProjection;
  private readonly clip: GroundNearClip;
  private readonly cellSize: number;

  constructor(ground: GroundProjection, stepMetres: number) {
    this.ground = ground;
    this.clip = new GroundNearClip(ground);
    this.cellSize = metresToUnits(stepMetres);
  }

  // The two passes are public and separate rather than one draw(): the cells
  // are world geometry and project themselves, while the dissolve is a band
  // pinned to the horizon, so the caller paints the second one inside the
  // horizon's own frame and the first one in plain screen space.
  public drawCells(context: CanvasRenderingContext2D) {
    const reach = metresToUnits(GROUND_DEPTH_METRES);

    context.save();
    const half = Math.ceil(reach / this.cellSize);

    for (let row = -half; row < half; row += 1) {
      const zNear = row * this.cellSize;
      const zFar = zNear + this.cellSize;

      for (let col = -half; col < half; col += 1) {
        const xLeft = col * this.cellSize;
        const xRight = xLeft + this.cellSize;
        const corners: GroundVertex[] = [
          { x: xLeft, z: zNear },
          { x: xRight, z: zNear },
          { x: xRight, z: zFar },
          { x: xLeft, z: zFar },
        ];
        const visible = this.clip.polygon(corners);

        // Fewer than three corners survived: the cell is entirely behind the
        // eye and has no area left to fill.
        if (visible.length < 3) {
          continue;
        }

        // Faded by the cell's own depth rather than by a band painted across
        // the screen afterwards. The band was anchored to the horizon and had
        // to pick a side, so the moment a vertical drag carried the eye under
        // the plane it dissolved the near edge and left the sheet's far edge
        // standing as a hard grey slab. Depth has no side to pick.
        const midX = xLeft + this.cellSize / 2;
        const midZ = zNear + this.cellSize / 2;

        context.globalAlpha = this.fadeAt(midX, midZ);
        // Modulo twice, because row and col are signed now that the sheet is
        // centred — a bare % would give -1 and paint two light cells adjacent.
        context.fillStyle = (((row + col) % 2) + 2) % 2 === 0 ? FLOOR_LIGHT_CELL : FLOOR_DARK_CELL;
        context.beginPath();

        visible.forEach((corner, index) => {
          const point = this.ground.project(corner.x, corner.z);

          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });

        context.closePath();
        context.fill();
      }
    }

    context.restore();
  }

  // Faded by distance across the ground itself, not by depth from the eye. The
  // sheet is finite, so its rim is the thing that must never be visible as an
  // edge — and the rim is a circle in the plane whatever the camera is doing,
  // while depth stops tracking it the moment the view goes grazing or drops
  // underneath. Keying on the plane's own radius makes the floor a disc that
  // dissolves at its edge from every angle.
  //
  // Opaque over the whole inner disc and dissolving only across the outer
  // RIM_FADE_FRACTION of the radius. A fade that starts at the middle is not a
  // horizon, it is a translucent floor — the sky reads straight through the
  // ground the user is standing over, which is not what any of this is for.
  private fadeAt(x: number, z: number): number {
    const reach = metresToUnits(GROUND_DEPTH_METRES);
    const rim = reach * RIM_FADE_FRACTION;
    const beyond = Math.hypot(x, z) - (reach - rim);

    if (beyond <= 0) {
      return 1;
    }

    const remaining = Math.max(0, 1 - beyond / rim);

    // Smoothstep rather than linear, so the disc meets full opacity without a
    // visible ring where the ramp begins.
    return remaining * remaining * (3 - 2 * remaining);
  }

  public drawFade(context: CanvasRenderingContext2D, horizonY: number, frameHeight: number) {
    const floorFade = context.createLinearGradient(0, horizonY, 0, frameHeight);
    floorFade.addColorStop(0, "rgba(255, 225, 238, 0.22)");
    floorFade.addColorStop(0.18, "rgba(255, 255, 255, 0.06)");
    floorFade.addColorStop(1, "rgba(0, 0, 0, 0.02)");
    context.fillStyle = floorFade;
    context.fillRect(0, horizonY, context.canvas.width, frameHeight - horizonY + 4);
  }
}

export default GroundFloor;
