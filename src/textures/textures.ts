export type TextureMap = Record<string, HTMLImageElement>;

export const textures: TextureMap = {};

export async function loadTextures(defs: Record<string, string>) {
  const entries = await Promise.all(
    Object.entries(defs).map(([key, url]) => {
      return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve([key, img]);
        img.onerror = reject;
        img.src = url;
      });
    })
  );

  for (const [k, img] of entries) textures[k] = img;
}