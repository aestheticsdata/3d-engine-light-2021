// The decoded bitmaps, behind an owner.
//
// This was a module-level mutable map plus the repo's only exported `function`,
// and a geometry primitive in another folder reached into it by index access —
// so a pure math class silently depended on a registry it never declared. It is
// now handed to the renderer through the render options, which makes that
// dependency visible at the one call site that builds them.
//
// One bad URL rejects the whole load and throws out of boot. That is deliberate
// and is not something to soften with a per-image catch: a missing texture makes
// the affected faces fall back to filling with the raw material string, which
// paints "dog" as a CSS colour and silently renders black. A loud boot failure
// is the correct outcome.
//
// Not every source is decoded, since E4b: the two procedural textures are
// canvases this registry adopts rather than URLs it fetches. It holds them and
// does not own them — ProceduralTextures repaints the same canvas objects in
// place when the base colour moves, so a swatch never has to re-register
// anything and this class never has to know a texture can change.

// Both satisfy drawImage and createPattern, and both carry width and height,
// which is everything the texture path asks of a source.
export type TextureSource = HTMLImageElement | HTMLCanvasElement;

class TextureRegistry {
  private readonly images: Map<string, TextureSource>;

  constructor() {
    this.images = new Map();
  }

  public async load(defs: Record<string, string>): Promise<void> {
    const entries = await Promise.all(Object.entries(defs).map(([key, url]) => this.loadImage(key, url)));

    entries.forEach(([key, image]) => {
      this.images.set(key, image);
    });
  }

  // Synchronous, and the asymmetry with load() above is the point: there is
  // nothing to await for a texture that was drawn rather than fetched, so the
  // procedural keys are resolvable from the first frame while dog and galaxy are
  // still decoding.
  public adopt(sources: Record<string, HTMLCanvasElement>) {
    Object.entries(sources).forEach(([key, canvas]) => {
      this.images.set(key, canvas);
    });
  }

  public get(key: string): TextureSource | undefined {
    return this.images.get(key);
  }

  public has(key: string): boolean {
    return this.images.has(key);
  }

  private loadImage(key: string, url: string): Promise<[string, HTMLImageElement]> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([key, image]);
      image.onerror = reject;
      image.src = url;
    });
  }
}

export default TextureRegistry;
