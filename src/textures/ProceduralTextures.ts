// The two textures the console draws for itself.
//
// CHECKER and UV GRID are not files. They are two 64x64 canvases painted from
// the BASE swatch, which is the rule E4a set everywhere else: the swatch is the
// ink a shape is made of, so a procedural texture generated in any other colour
// would be the one surface in the console that ignored it.
//
// Repainted IN PLACE, never replaced, and that is what keeps TextureRegistry out
// of the material path. The two canvas objects are adopted once at boot and the
// registry goes on handing back the same two references forever; a swatch
// changes their pixels. The one thing that does not survive it is a cached
// CanvasPattern — createPattern snapshots its source — which is why redraw()'s
// caller has to invalidate the pattern cache, and why that is said out loud at
// the call site rather than left for someone to discover in a stale frame.
//
// 64x64 because it tiles: UV SCALE runs to 16, so a mapped face can show 256
// copies and a larger tile would buy resolution nothing at that density can see.

import { formatRgba, multiplyColor, parseCssColor } from "@rendering/cssColor";
import { CHECKER_KEY, UV_GRID_KEY } from "@textures/textureKeys";

import type { RGBA } from "@rendering/cssColor";

const SIZE = 64;
// Two cells across the tile rather than eight, so UV SCALE is what sets the
// density of the check and this file only sets its phase. At the shipped scale
// of 8 that is a 16x16 board across a mapped surface.
const CHECKER_CELLS = 2;
const GRID_CELLS = 8;
// What the darker half of the checker, and the UV grid's ground, are: the ink
// multiplied down rather than a fixed grey. A fixed ground would leave the red
// swatch legible and the white one washed out, because contrast against a
// constant is a different amount of contrast for every colour in the palette.
const SHADE: RGBA = [72, 72, 72, 1];
// The fallback ink when the swatch resolves to something cssColor cannot read.
// White rather than transparent: an unreadable colour should paint the texture
// the console opens on, not remove it.
const WHITE: RGBA = [255, 255, 255, 1];

class ProceduralTextures {
  private readonly checker: HTMLCanvasElement;
  private readonly uvGrid: HTMLCanvasElement;
  private readonly canvases: Record<string, HTMLCanvasElement>;

  constructor(baseColor: string) {
    this.checker = this.blank();
    this.uvGrid = this.blank();
    this.canvases = { [CHECKER_KEY]: this.checker, [UV_GRID_KEY]: this.uvGrid };
    this.redraw(baseColor);
  }

  public get sources(): Record<string, HTMLCanvasElement> {
    return this.canvases;
  }

  // Both, on every swatch, rather than only the one currently selected: the
  // chips switch without a rebuild, and a texture painted in the previous colour
  // would show for one frame on the way past.
  public redraw(baseColor: string) {
    const ink = parseCssColor(baseColor) ?? WHITE;
    const ground = multiplyColor(ink, SHADE);

    this.paintChecker(formatRgba(ink), formatRgba(ground));
    this.paintGrid(formatRgba(ink), formatRgba(ground));
  }

  private paintChecker(ink: string, ground: string) {
    const context = this.contextOf(this.checker);
    const cell = SIZE / CHECKER_CELLS;

    context.fillStyle = ground;
    context.fillRect(0, 0, SIZE, SIZE);
    context.fillStyle = ink;

    for (let row = 0; row < CHECKER_CELLS; row += 1) {
      for (let column = 0; column < CHECKER_CELLS; column += 1) {
        if ((row + column) % 2 === 0) {
          context.fillRect(column * cell, row * cell, cell, cell);
        }
      }
    }
  }

  // One cell filled solid, which is the only part of this that is not
  // decoration. A symmetric grid cannot show which way up a face is mapped or
  // whether it is mirrored, and showing exactly that is what a UV grid is for —
  // it is the instrument the spherical projection gets read with.
  //
  // Lines as fillRect rather than stroke: a stroked line at an integer
  // coordinate straddles two pixel columns and comes out antialiased across
  // both, which at an 8px pitch is most of the tile.
  private paintGrid(ink: string, ground: string) {
    const context = this.contextOf(this.uvGrid);
    const cell = SIZE / GRID_CELLS;

    context.fillStyle = ground;
    context.fillRect(0, 0, SIZE, SIZE);
    context.fillStyle = ink;
    context.fillRect(0, 0, cell, cell);

    // Up to but not including the far edge, so a tile carries its own leading
    // line and borrows its trailing one from the next copy. Drawing both would
    // double the line at every seam.
    for (let step = 0; step < GRID_CELLS; step += 1) {
      context.fillRect(step * cell, 0, 1, SIZE);
      context.fillRect(0, step * cell, SIZE, 1);
    }
  }

  private blank(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");

    canvas.width = SIZE;
    canvas.height = SIZE;

    return canvas;
  }

  private contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("2D canvas context is not available for a procedural texture.");
    }

    return context;
  }
}

export default ProceduralTextures;
