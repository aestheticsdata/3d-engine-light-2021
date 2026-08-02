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

class TextureRegistry {
  private readonly images: Map<string, HTMLImageElement>;

  constructor() {
    this.images = new Map();
  }

  public async load(defs: Record<string, string>): Promise<void> {
    const entries = await Promise.all(Object.entries(defs).map(([key, url]) => this.loadImage(key, url)));

    entries.forEach(([key, image]) => {
      this.images.set(key, image);
    });
  }

  public get(key: string): HTMLImageElement | undefined {
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
