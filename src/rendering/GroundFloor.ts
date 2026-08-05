// The checker floor: the ground's other pass, sharing the same GroundProjection
// as GroundGrid so a floor cell and a grid line agree on where the ground is.
//
// Its own file for the same reason GroundGrid got one (COS-246, R17): pulled
// out so BackgroundRenderer stays the class that owns layer flags and pass
// order, not the class that also derives every quad.
//
// The cell equals the current grid step rather than a fixed size — so the
// floor and an overlaid grid line always land on the same edge — which is
// also most of the performance win: at a 4m step over the shared 60m-by-80m
// ground plane this is on the order of a few hundred quads, not the roughly
// 8200 the old fixed 3.4x4.2 cell filled every frame regardless of what was
// visible.

import { GROUND_DEPTH_METRES, GROUND_HALF_WIDTH_METRES, metresToUnits } from "@rendering/worldScale";

import type GroundProjection from "@rendering/GroundProjection";

const FLOOR_LIGHT_CELL = "rgba(244, 243, 238, 1)";
const FLOOR_DARK_CELL = "rgba(122, 124, 128, 1)";

class GroundFloor {
  private readonly ground: GroundProjection;
  private readonly cellSize: number;

  constructor(ground: GroundProjection, stepMetres: number) {
    this.ground = ground;
    this.cellSize = metresToUnits(stepMetres);
  }

  // horizonY is the caller's shared render-target centre, not derived again
  // here — the same value renderAtmosphere anchors to, so the two passes
  // cannot disagree about where it is. Frame height comes off the context's
  // own canvas rather than a third constructor argument for one number that
  // never varies per instance.
  public draw(context: CanvasRenderingContext2D, horizonY: number) {
    this.drawCells(context);
    this.drawFade(context, horizonY, context.canvas.height);
  }

  private drawCells(context: CanvasRenderingContext2D) {
    const nearZ = this.ground.nearZ;
    const farZ = nearZ + metresToUnits(GROUND_DEPTH_METRES);
    const xHalf = metresToUnits(GROUND_HALF_WIDTH_METRES);
    const rowCount = Math.max(0, Math.ceil((farZ - nearZ) / this.cellSize));
    const colCount = Math.max(0, Math.ceil((2 * xHalf) / this.cellSize));

    for (let row = rowCount - 1; row >= 0; row -= 1) {
      const zTop = nearZ + row * this.cellSize;
      const zBottom = zTop + this.cellSize;

      for (let col = 0; col < colCount; col += 1) {
        const xLeft = -xHalf + col * this.cellSize;
        const xRight = xLeft + this.cellSize;
        const topLeft = this.ground.project(xLeft, zTop);
        const topRight = this.ground.project(xRight, zTop);
        const bottomRight = this.ground.project(xRight, zBottom);
        const bottomLeft = this.ground.project(xLeft, zBottom);

        context.fillStyle = (row + col) % 2 === 0 ? FLOOR_LIGHT_CELL : FLOOR_DARK_CELL;
        context.beginPath();
        context.moveTo(topLeft.x, topLeft.y);
        context.lineTo(topRight.x, topRight.y);
        context.lineTo(bottomRight.x, bottomRight.y);
        context.lineTo(bottomLeft.x, bottomLeft.y);
        context.closePath();
        context.fill();
      }
    }
  }

  private drawFade(context: CanvasRenderingContext2D, horizonY: number, frameHeight: number) {
    const fadeStartY = horizonY + (frameHeight - horizonY) * 0.5;
    const transparencyMask = context.createLinearGradient(0, horizonY, 0, fadeStartY);
    transparencyMask.addColorStop(0, "rgba(0, 0, 0, 1)");
    transparencyMask.addColorStop(1, "rgba(0, 0, 0, 0)");
    // The composite mode is scoped to this one fill and nothing else. Left set,
    // the vignette that follows would erase the frame instead of darkening it.
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = transparencyMask;
    context.fillRect(0, horizonY, context.canvas.width, fadeStartY - horizonY);
    context.restore();

    const floorFade = context.createLinearGradient(0, horizonY, 0, frameHeight);
    floorFade.addColorStop(0, "rgba(255, 225, 238, 0.22)");
    floorFade.addColorStop(0.18, "rgba(255, 255, 255, 0.06)");
    floorFade.addColorStop(1, "rgba(0, 0, 0, 0.02)");
    context.fillStyle = floorFade;
    context.fillRect(0, horizonY, context.canvas.width, frameHeight - horizonY + 4);
  }
}

export default GroundFloor;
