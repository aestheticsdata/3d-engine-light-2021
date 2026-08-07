// Affine texel sampling: a UV against a flat, already-decoded RGBA buffer,
// in the same repeat behaviour CanvasPattern's "repeat" mode already gives
// AffineTextureMapper.draw — UV SCALE runs past 1, and a wrap other than
// repeat would clip a tiled face at the image edge instead of continuing it.
// Nearest-neighbour, matching the affine mapper's own resolution: a pattern
// fill has no bilinear filtering to reproduce, so adding one here would draw
// a sharper texture than the canvas path ever did.

export interface Texel {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Wraps into [0, 1) rather than clamping — a UV of 1.9 has to read the same
// texel a UV of 0.9 does, which is what "repeat" means.
const wrap = (value: number): number => {
  const fractional = value % 1;

  return fractional < 0 ? fractional + 1 : fractional;
};

export const sampleTexel = (pixels: Uint8ClampedArray, width: number, height: number, u: number, v: number): Texel => {
  const x = Math.min(width - 1, Math.floor(wrap(u) * width));
  const y = Math.min(height - 1, Math.floor(wrap(v) * height));
  const index = (y * width + x) * 4;

  return { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: pixels[index + 3] };
};
