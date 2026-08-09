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
//
// COS-453: the near clip above only rejects what is behind the eye, not what
// is simply off to the side or below the bottom of the frame — at the
// default zoom, most of the sheet's 900 cells are one or the other. Each
// cell's clipped corners are still projected every frame; isPolygonOnScreen
// tests that projection's own bounding box against the canvas before the
// fade, the fog or the fill run, so an invisible cell costs four divides and
// nothing else.

import GroundNearClip from "@rendering/GroundNearClip";
import { isPolygonOnScreen } from "@rendering/screenVisibility";
import { GROUND_DEPTH_METRES, metresToUnits } from "@rendering/worldScale";

import type Fog from "@rendering/Fog";
import type { GroundVertex } from "@rendering/GroundNearClip";
import type GroundProjection from "@rendering/GroundProjection";

// The outer share of the ground's radius that the rim dissolve occupies. The
// inner three-quarters stay fully opaque.
const RIM_FADE_FRACTION = 0.25;

const FLOOR_LIGHT_CELL = "rgba(244, 243, 238, 1)";
const FLOOR_DARK_CELL = "rgba(122, 124, 128, 1)";

// Three collaborators, so a named options object rather than a positional list
// (R4). It was a positional pair until COS-247's fog joined it.
export interface GroundFloorOptions {
  ground: GroundProjection;
  stepMetres: number;
  fog: Fog;
}

class GroundFloor {
  private readonly ground: GroundProjection;
  private readonly clip: GroundNearClip;
  private readonly cellSize: number;
  private readonly fog: Fog;

  constructor(options: GroundFloorOptions) {
    this.ground = options.ground;
    this.clip = new GroundNearClip(options.ground);
    this.cellSize = metresToUnits(options.stepMetres);
    this.fog = options.fog;
  }

  // The two passes are public and separate rather than one draw(): the cells
  // are world geometry and project themselves, while the dissolve is a band
  // pinned to the horizon, so the caller paints the second one inside the
  // horizon's own frame and the first one in plain screen space.
  public drawCells(context: CanvasRenderingContext2D) {
    const reach = metresToUnits(GROUND_DEPTH_METRES);
    const { width, height } = context.canvas;

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

        const projected = visible.map((corner) => this.ground.project(corner.x, corner.z));

        // The corners already had to be projected to reach this line — what
        // this skips is everything after it. Most of the sheet's 900 cells
        // land outside the viewport at the default zoom, and this is the
        // only thing between them and a fadeAt, a fogAt and a canvas fill
        // they cannot be seen paying for (COS-453).
        if (!isPolygonOnScreen(projected, width, height)) {
          continue;
        }

        // Faded by the cell's own depth rather than by a band painted across
        // the screen afterwards. The band was anchored to the horizon and had
        // to pick a side, so the moment a vertical drag carried the eye under
        // the plane it dissolved the near edge and left the sheet's far edge
        // standing as a hard grey slab. Depth has no side to pick.
        const midX = xLeft + this.cellSize / 2;
        const midZ = zNear + this.cellSize / 2;

        context.globalAlpha = this.fadeAt(midX, midZ) * this.fogAt(midX, midZ);
        // Modulo twice, because row and col are signed now that the sheet is
        // centred — a bare % would give -1 and paint two light cells adjacent.
        context.fillStyle = (((row + col) % 2) + 2) % 2 === 0 ? FLOOR_LIGHT_CELL : FLOOR_DARK_CELL;
        context.beginPath();

        projected.forEach((point, index) => {
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

  // Multiplied into the rim dissolve above rather than replacing it (COS-247).
  // The two answer different questions: the rim says where the finite sheet
  // ends, the fog says how much air is in the way, and at FOG 0 — the shipped
  // default — this is exactly 1 and the sheet is the one E5a drew.
  //
  // Faded toward the sky rather than painted over, which is the same colour at
  // the horizon and one pass fewer. The early exit is what keeps the default
  // frame free of a depthAt call per cell.
  private fogAt(x: number, z: number): number {
    if (this.fog.isClear) {
      return 1;
    }

    return this.fog.groundAlpha(this.ground.depthAt(x, z));
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
