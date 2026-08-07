// The key light: one direction, three scalars, and the shade a face comes out at.
//
// It takes the three vertices rather than a normal, and that is deliberate — the
// vector arithmetic all lives here, so it can be asserted against without
// building a mesh, and Triangle goes on knowing only that a face has a colour.
// Four positional arguments on fillFor rather than R4's options object, for the
// reason Triangle.render already carries four: this is the per-triangle path,
// and one object literal per triangle per frame is 7920 allocations a frame on
// the torus knot. R4's line in this codebase falls between per-mesh calls, which
// get an options object (MeshRenderPass), and per-triangle calls, which do not.
//
// Vec3Math is not used here, for the same reason. It has cross, dot and
// normalise, and every one of them returns a fresh tuple: its own header says it
// stays tuple math because it runs at import time in the shape generators. On
// the render path it would be exactly the churn Triangle's projected-scalar
// fields record this codebase removing.
//
// Only DRAWN triangles reach either public method. E6 split Mesh.renderMesh into
// three passes and fill() runs over survivors alone, so a backface-culled or
// near-plane-clipped triangle costs no normal at all — which is roughly half the
// faces of a closed solid, and the reason the draft's whole-mesh normal pass was
// not worth keeping.

import { parseCssColor } from "@rendering/cssColor";
import { toEyeSpace, worldLightDirection } from "@rendering/lightDirection";
import ShadeCache, { SHADE_STEPS, SPECULAR_STEPS } from "@rendering/ShadeCache";

import type Point3D from "@primitives/Point3D";
import type { RGBA } from "@rendering/cssColor";
import type { Vec3 } from "@rendering/lightDirection";
import type { ResolvedMaterial } from "@rendering/material";

export interface LightingValues {
  azimuth: number;
  elevation: number;
  // Both percentages, as the rows print them.
  ambient: number;
  specular: number;
  // The KEY_LIGHT scene-graph row. False drops both the diffuse and the specular
  // term and leaves ambient alone, which is what hiding a light has to mean if
  // the toggle is to be worth anything.
  enabled: boolean;
}

// Fixed, not a slider. The mockup has four lighting rows and none of them is
// shininess; inventing a fifth would be this ticket designing UI.
const SHININESS = 32;
const PERCENT = 100;
// Below this a face has no area worth a normal. Real in this registry rather
// than defensive: SphereGenerator emits thirteen coincident points at each pole,
// so every triangle in the first and last latitude band has two vertices in the
// same place and a cross product of exactly zero.
const DEGENERATE = 1e-9;

// The unreadable-colour fallback shared with Fog's own UNPARSED constant:
// white is the multiply's identity, so an unrecognised fill still shows
// something rather than painting black.
const UNSHADEABLE_FALLBACK: RGBA = [255, 255, 255, 1];

// Stands in until the first frame calls setCamera. Main shades a mesh in
// buildMesh, before the render path has run once, and reading the world
// direction unrotated there costs a frame nobody sees rather than a NaN somebody
// has to find.
const UNROTATED = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

class Lighting {
  private readonly cache: ShadeCache;
  private world: Vec3;
  private eye: Vec3;
  private ambient: number;
  private specular: number;
  private enabled: boolean;
  private eyeDistance: number;
  private cameraTransform: number[][];
  // Written by computeTerms and read by whichever public method called it — the
  // same scratch arrangement Triangle keeps its projected coordinates in, and
  // for the same reason: handing them back would mean an object per drawn
  // triangle per frame.
  private shadeStep: number;
  private specularStep: number;

  constructor(values: LightingValues) {
    this.cache = new ShadeCache();
    this.world = worldLightDirection(values.azimuth, values.elevation);
    this.eye = this.world;
    this.ambient = values.ambient / PERCENT;
    this.specular = values.specular / PERCENT;
    this.enabled = values.enabled;
    this.eyeDistance = 0;
    this.cameraTransform = UNROTATED;
    this.shadeStep = SHADE_STEPS;
    this.specularStep = 0;
  }

  // The four rows, on the click that moves one of them. The eye-space direction
  // is rebuilt here as well as in setCamera because a paused console has to
  // shade correctly from this call alone — the next frame may never come.
  public setValues(values: LightingValues) {
    this.ambient = values.ambient / PERCENT;
    this.specular = values.specular / PERCENT;
    this.enabled = values.enabled;
    this.world = worldLightDirection(values.azimuth, values.elevation);
    this.eye = toEyeSpace(this.world, this.cameraTransform);
  }

  // Per frame, from the same viewMatrix() the background pass is already handed.
  // Never meshMatrix(): that one carries the turntable spin and, since E4a, the
  // SCALE factor — lightDirection.toEyeSpace records what each would do here.
  public setCamera(cameraTransform: number[][], eyeDistance: number) {
    this.cameraTransform = cameraTransform;
    this.eyeDistance = eyeDistance;
    this.eye = toEyeSpace(this.world, cameraTransform);
  }

  // The flat path. Returns the unlit fill unchanged for a texture key, a colour
  // cssColor could not read, or a degenerate face — one fallback in one place,
  // rather than the same three-way guard at every call site.
  public fillFor(resolved: ResolvedMaterial, a: Point3D, b: Point3D, c: Point3D): string {
    if (resolved.rgba === null || !this.computeTerms(a, b, c)) {
      return resolved.fill;
    }

    return this.cache.fillFor(resolved.fill, resolved.rgba, this.shadeStep, this.specularStep);
  }

  // fillFor's numeric twin, for the rasteriser (E3b/COS-242): the same three
  // branches — unlit resolved colour, degenerate face, cached shaded colour —
  // ending in a tuple instead of a cssColor.formatRgba string. resolved.rgba
  // is the one case fillFor never had to fall further than: a texture-keyed
  // material's fill is its raw key string ("dog"), which cssColor cannot
  // parse, so this is the one place that needs a fallback fillFor's CSS
  // fillStyle never did.
  public fillRgba(resolved: ResolvedMaterial, a: Point3D, b: Point3D, c: Point3D): RGBA {
    if (resolved.rgba === null || !this.computeTerms(a, b, c)) {
      return resolved.rgba ?? parseCssColor(resolved.fill) ?? UNSHADEABLE_FALLBACK;
    }

    return this.cache.rgbaFor(resolved.fill, resolved.rgba, this.shadeStep, this.specularStep);
  }

  // The textured path. context.fill() cannot modulate a drawImage, so a textured
  // face is darkened by a black wash over the same triangle — an approximation of
  // a multiply that can only darken, and it goes away in E3b where the texel is
  // multiplied per pixel. Diffuse only: a specular highlight painted as a white
  // wash over a photograph reads as fog rather than as a highlight.
  public overlayFor(a: Point3D, b: Point3D, c: Point3D): string | null {
    if (!this.computeTerms(a, b, c)) {
      return null;
    }

    return this.cache.overlayFor(this.shadeStep);
  }

  // The face normal, the Lambert term and the Blinn-Phong highlight, quantised
  // into the two scratch fields. False means the face has no normal and the
  // caller must leave its colour alone.
  //
  // Every scalar is written out rather than routed through a vector helper, and
  // the nine coordinates are hoisted into locals rather than read back through
  // the getters: this runs once per drawn triangle per frame, which is where
  // what is left of the frame budget goes.
  private computeTerms(a: Point3D, b: Point3D, c: Point3D): boolean {
    const ax = a.xValue;
    const ay = a.yValue;
    const az = a.zValue;
    const bx = b.xValue;
    const by = b.yValue;
    const bz = b.zValue;
    const cx = c.xValue;
    const cy = c.yValue;
    const cz = c.zValue;

    // Nraw = (b - a) x (c - a). Its z is exactly the cross product
    // Triangle.isFrontFacing() takes the sign of — the projection scales both
    // edges by the same s and an s squared factors out — so a visible face has
    // Nraw.z > 0, which points AWAY from an eye sitting at negative z. The
    // outward normal is therefore -Nraw, and the negation rides in the divide
    // below rather than costing three more multiplies.
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const length = Math.hypot(nx, ny, nz);

    if (length < DEGENERATE) {
      return false;
    }

    const inverse = -1 / length;
    const ux = nx * inverse;
    const uy = ny * inverse;
    const uz = nz * inverse;
    const diffuse = this.enabled ? Math.max(0, ux * this.eye[0] + uy * this.eye[1] + uz * this.eye[2]) : 0;

    this.shadeStep = Math.round((this.ambient + (1 - this.ambient) * diffuse) * SHADE_STEPS);
    this.specularStep = this.highlightStep(ux, uy, uz, (ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);

    return true;
  }

  // Blinn-Phong, off the half vector between the light and the view. The eye
  // sits at (0, 0, -distance) in this frame, which is where Camera puts it:
  // depthAt(z) is z + distance, so the projection's denominator vanishes there.
  private highlightStep(ux: number, uy: number, uz: number, px: number, py: number, pz: number): number {
    if (!this.enabled || this.specular === 0) {
      return 0;
    }

    const vx = -px;
    const vy = -py;
    const vz = -this.eyeDistance - pz;
    const viewLength = Math.hypot(vx, vy, vz);

    if (viewLength < DEGENERATE) {
      return 0;
    }

    const hx = this.eye[0] + vx / viewLength;
    const hy = this.eye[1] + vy / viewLength;
    const hz = this.eye[2] + vz / viewLength;
    const halfLength = Math.hypot(hx, hy, hz);

    // The half vector collapses when the light points straight back along the
    // view. That is a real configuration rather than an error — there is simply
    // no highlight to place.
    if (halfLength < DEGENERATE) {
      return 0;
    }

    const alignment = Math.max(0, (ux * hx + uy * hy + uz * hz) / halfLength);

    return Math.round(this.specular * alignment ** SHININESS * SPECULAR_STEPS);
  }
}

export default Lighting;
