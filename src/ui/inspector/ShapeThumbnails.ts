// One small rendered picture of each primitive, painted once.
//
// It is the real mesh through the real rasteriser, not an icon set: the same
// MeshFactory, the same Triangle.render, the same baked materials. A drawn
// thumbnail would be a second source of truth for what a shape looks like, and
// it would be wrong the day COS-201 adds a solid nobody drew an icon for.
//
// Its own MeshFactory and RenderTarget, because the app's are bound to the
// 1024x640 stage: Point3D caches the projection centre and scale per point at
// construction, so a mesh built for the stage cannot be re-aimed at a 44px
// thumbnail. referenceHeight is pinned to the thumbnail's own SIZE rather than
// left at RenderTarget's 640 default, which is what keeps scale at exactly 1 —
// this file's own camera and offsetFor() below were tuned assuming no extra
// multiplier, and inheriting the stage's reference height would silently
// shrink every thumbnail toward its own centre.
//
// Rendered after the textures resolve, so the cube shows its galaxy face rather
// than a hole — which is why Main calls this from init() and not from its
// constructor.

import Camera from "@primitives/Camera";
import Matrix3D from "@primitives/Matrix3D";
import MeshFactory from "@primitives/MeshFactory";
import RenderTarget from "@primitives/RenderTarget";
import RenderStats from "@rendering/RenderStats";

import type { Data3D } from "@data/types";
import type TextureRegistry from "@textures/TextureRegistry";

// The painted size is --size-chip-shape; the backing store is twice that, so
// the picture is sharp on a 2x display instead of being scaled up from 44
// device pixels. The CSS box is what the layout sees, this is only resolution.
const PAINTED_SIZE = 44;
const SIZE = PAINTED_SIZE * 2;
// A three-quarter view: enough yaw to show a second face, enough pitch to show
// the top. Without it a cube is a square and a cross is a plus sign, which is
// exactly what a flat thumbnail must not look like.
const VIEW_PITCH_DEGREES = -22;
const VIEW_YAW_DEGREES = 32;
const FOCAL = 300;
// How much of the half-tile the silhouette is allowed to fill. Short of 1 so a
// shape never touches the edge of its own thumbnail.
const FIT_MARGIN = 0.82;

class ShapeThumbnails {
  private readonly objects3D: Data3D;
  private readonly textures: TextureRegistry;

  constructor(objects3D: Data3D, textures: TextureRegistry) {
    this.objects3D = objects3D;
    this.textures = textures;
  }

  public paint(primitive: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas");

    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.width = `${PAINTED_SIZE}px`;
    canvas.style.height = `${PAINTED_SIZE}px`;
    canvas.className = "shape-picker__thumb";
    canvas.setAttribute("aria-hidden", "true");

    const context = canvas.getContext("2d");
    const object3D = this.objects3D[primitive];

    if (!context || !object3D) {
      return canvas;
    }

    // Its own camera as well as its own viewport, and for the same reason: this
    // picture is not the console's projection at a smaller size. It has no FOV
    // control, no zoom, and nothing that comes near either clip plane — the
    // shape is pushed back until it fits and painted once.
    //
    // The push-back is expressed as a magnification because that is what the
    // camera holds now: k = fl / (fl + zOffset) is the identity that made the
    // console's whole zoom range survive the change, used here to say the same
    // thing about one fixed offset.
    const offsetZ = this.offsetFor(object3D.points);
    const camera = new Camera({ focal: FOCAL, magnification: FOCAL / (FOCAL + offsetZ) });
    const renderTarget = new RenderTarget({ width: SIZE, height: SIZE, referenceHeight: SIZE });
    const mesh = new MeshFactory(renderTarget, camera).build(object3D);
    const matrix3D = new Matrix3D();

    // Yaw times pitch, in that order, which is the single matrix equivalent of
    // the two sequential passes this replaces. A thumbnail is painted once and
    // never re-posed, so it needs none of the rig — only the same builders.
    mesh.setTransform(
      matrix3D.multiply(matrix3D.yawMatrix(VIEW_YAW_DEGREES), matrix3D.pitchMatrix(VIEW_PITCH_DEGREES)),
    );

    // A throwaway accumulator: renderMesh (E6/COS-239) always writes through
    // one, but a thumbnail is painted once and nothing here reads its stats
    // back — the console's own telemetry describes the stage, not a picker
    // chip.
    mesh.renderMesh({
      context,
      offsetX: 0,
      offsetY: 0,
      options: { textures: this.textures, cullBackfaces: true, opacity: 1 },
      stats: new RenderStats(),
      eyeDistance: camera.distance,
      timed: false,
    });

    return canvas;
  }

  // The bounding SPHERE, not the per-axis extent, and the difference is what was
  // clipping the corners off: the mesh is rotated before it is drawn, and a cube
  // whose faces sit at ±h has corners at h·√3. Only a radius is rotation
  // invariant, so only a radius can bound the silhouette at every view angle.
  //
  // Then the perspective divide: scale = focal / (focal + z + offset), so the
  // nearest point of the sphere projects largest. Solving R·focal/(focal + offset
  // − R) ≤ target for the offset gives the bound below. It assumes a point can be
  // at full radius laterally *and* at nearest depth at once, which it cannot —
  // so it errs slightly wide, which is the direction to err in.
  private offsetFor(points: number[][]): number {
    let radius = 1;

    points.forEach((point) => {
      radius = Math.max(radius, Math.hypot(point[0], point[1], point[2]));
    });

    const target = (SIZE / 2) * FIT_MARGIN;

    return (radius * FOCAL) / target + radius - FOCAL;
  }
}

export default ShapeThumbnails;
