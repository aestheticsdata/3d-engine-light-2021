// -----------------------------------------------------------------------------
// UV / TEXTURE MAPPING SUPPORT
// -----------------------------------------------------------------------------
// This Triangle can be rendered in two different modes:
//
// 1) Flat color:
//    - material is a CSS color string (e.g. "rgba(...)").
//    - the triangle is filled with ctx.fill().
//
// 2) Textured:
//    - material is a texture key (e.g. "dog", "galaxy") used to fetch an image
//      from the global textures registry.
//    - uva/uvb/uvc define the (u,v) texture coordinates for each vertex.
//
// UV coordinates:
// - u and v are normalized in [0..1].
// - (0,0) is the top-left of the texture, (1,1) is the bottom-right.
// - each triangle vertex (A,B,C) has its own UV (uva, uvb, uvc).
//
// Why UVs are optional:
// - most primitives are still solid colors.
// - only some objects (like the cube faces) need textures.
// - keeping UVs optional avoids changing every triangle in data.ts.
//
// -----------------------------------------------------------------------------
// Canvas 2D implementation notes (Affine mapping)
// -----------------------------------------------------------------------------
// The HTML Canvas 2D API does not provide perspective-correct texturing.
// Instead, we approximate texture mapping using an affine transform.
//
// Steps:
// 1) Project 3D points -> 2D screen coordinates (ax,ay) (bx,by) (cx,cy).
// 2) Convert UVs -> pixel coordinates in texture space (x1,y1) (x2,y2) (x3,y3).
// 3) Compute the 2D affine transform that maps texture triangle -> screen triangle.
//    In other words, find matrix M + translation D such that:
//
//      [sx]   [m11 m21 dx] [tx]
//      [sy] = [m12 m22 dy] [ty]
//      [ 1]   [ 0   0   1] [ 1]
//
//    where (tx,ty) are texture-space coordinates and (sx,sy) are screen-space.
//
// 4) Clip to the projected triangle in screen space, then draw the full image
//    through the transform. Only the clipped triangle region becomes visible.
//
// This is fast and simple, but not perspective-correct:
// - rotating faces can show stretching / shearing artifacts.
// - we reduce those artifacts by subdividing faces into many small triangles.
//
// uvDet:
// - uvDet is twice the signed area of the UV triangle.
// - uvDet == 0 means the UV triangle is degenerate, so we skip rendering.
// -----------------------------------------------------------------------------```

import Point3D from "@primitives/Point3D";
import Point2D from "@primitives/Point2D";
import { textures } from "@textures/textures";

type UV = [number, number];

class Triangle {
  private a: Point3D;
  private b: Point3D;
  private c: Point3D;

  public aproj: Point2D;
  public bproj: Point2D;
  public cproj: Point2D;

  // can be a color OR a texture key
  public material: string;

  // optional UVs
  private uva?: UV;
  private uvb?: UV;
  private uvc?: UV;

  constructor(
    a: Point3D,
    b: Point3D,
    c: Point3D,
    material: string,
    uva?: UV,
    uvb?: UV,
    uvc?: UV,
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.material = material;
    this.uva = uva;
    this.uvb = uvb;
    this.uvc = uvc;
  }

  public get depth(): number {
    return (this.a.zValue + this.b.zValue + this.c.zValue) / 3;
  }

  public render(context: CanvasRenderingContext2D): void {
    this.aproj = this.a.convert3D2D();
    this.bproj = this.b.convert3D2D();
    this.cproj = this.c.convert3D2D();

    // 2D backface culling (keep your current behavior)
    const v1x = this.bproj.x - this.aproj.x;
    const v1y = this.bproj.y - this.aproj.y;
    const v2x = this.cproj.x - this.aproj.x;
    const v2y = this.cproj.y - this.aproj.y;
    if (v1x * v2y - v1y * v2x <= 0) return;

    const img = textures[this.material];

    // flat color
    if (!img || !this.uva || !this.uvb || !this.uvc) {
      context.fillStyle = this.material;
      context.beginPath();
      context.moveTo(this.aproj.x, this.aproj.y);
      context.lineTo(this.bproj.x, this.bproj.y);
      context.lineTo(this.cproj.x, this.cproj.y);
      context.closePath();
      context.fill();
      return;
    }

    // textured triangle (affine)
    const ax = this.aproj.x,
      ay = this.aproj.y;
    const bx = this.bproj.x,
      by = this.bproj.y;
    const cx = this.cproj.x,
      cy = this.cproj.y;

    const [u1, v1] = this.uva;
    const [u2, v2] = this.uvb;
    const [u3, v3] = this.uvc;

    const w = img.width;
    const h = img.height;

    // UV in pixels
    const x1 = u1 * w,
      y1 = v1 * h;
    const x2 = u2 * w,
      y2 = v2 * h;
    const x3 = u3 * w,
      y3 = v3 * h;

    // Solve affine transform (UV->Screen)
    const uvDet = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
    if (uvDet === 0) return;

    const m11 = (ax * (y2 - y3) + bx * (y3 - y1) + cx * (y1 - y2)) / uvDet;
    const m12 = (ay * (y2 - y3) + by * (y3 - y1) + cy * (y1 - y2)) / uvDet;

    const m21 = (ax * (x3 - x2) + bx * (x1 - x3) + cx * (x2 - x1)) / uvDet;
    const m22 = (ay * (x3 - x2) + by * (x1 - x3) + cy * (x2 - x1)) / uvDet;

    const dx =
      (ax * (x2 * y3 - x3 * y2) +
        bx * (x3 * y1 - x1 * y3) +
        cx * (x1 * y2 - x2 * y1)) /
      uvDet;

    const dy =
      (ay * (x2 * y3 - x3 * y2) +
        by * (x3 * y1 - x1 * y3) +
        cy * (x1 * y2 - x2 * y1)) /
      uvDet;

    context.save();

    // clip triangle in screen space
    context.beginPath();
    context.moveTo(ax, ay);
    context.lineTo(bx, by);
    context.lineTo(cx, cy);
    context.closePath();
    context.clip();

    // apply transform and draw image in UV space
    context.setTransform(m11, m12, m21, m22, dx, dy);
    context.drawImage(img, 0, 0);

    context.restore();
  }

  public changeFocal(value: number) {
    this.a.fl = this.b.fl = this.c.fl = value;
  }

  public changeOffsetZ(value: number) {
    this.a.zOffset = this.b.zOffset = this.c.zOffset = value;
  }
}

export default Triangle;
