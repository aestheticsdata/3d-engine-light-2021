// Raw pixel access for the rasteriser's own texel sampling (E3b/COS-242).
// AffineTextureMapper hands a CanvasPattern to context.fillStyle; a
// putImageData-backed buffer has no fillStyle to hand one to, so a texture
// has to be decoded to a flat RGBA array once, the same way TextureRegistry
// decodes a URL to a bitmap once.
//
// Keyed and invalidated exactly the way AffineTextureMapper already is: the
// two procedural sources are canvases ProceduralTextures repaints in place,
// so a cached decode is wrong from the moment a swatch moves until
// invalidate() runs — the same call site that already invalidates the
// pattern cache invalidates this one too (Main.changeMaterial).

import type { TextureSource } from "@textures/TextureRegistry";

export interface DecodedTexture {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

class TexturePixelCache {
  private readonly decoded: Map<string, DecodedTexture>;
  private readonly scratch: HTMLCanvasElement;
  private readonly scratchContext: CanvasRenderingContext2D;

  constructor() {
    this.decoded = new Map();
    this.scratch = document.createElement("canvas");

    const context = this.scratch.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("2D canvas context is not available for the texture pixel cache.");
    }

    this.scratchContext = context;
  }

  public invalidate() {
    this.decoded.clear();
  }

  // Decoded once per key and held until invalidate() runs. The scratch
  // canvas is reused across every source rather than rebuilt: only its
  // contents, never the element, need to change between two textures of
  // different sizes.
  public get(key: string, image: TextureSource): DecodedTexture {
    const cached = this.decoded.get(key);

    if (cached) {
      return cached;
    }

    this.scratch.width = image.width;
    this.scratch.height = image.height;
    this.scratchContext.clearRect(0, 0, image.width, image.height);
    this.scratchContext.drawImage(image, 0, 0);

    const imageData = this.scratchContext.getImageData(0, 0, image.width, image.height);
    const built: DecodedTexture = { pixels: imageData.data, width: image.width, height: image.height };

    this.decoded.set(key, built);

    return built;
  }
}

export default TexturePixelCache;
