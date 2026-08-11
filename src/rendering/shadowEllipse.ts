// The shadow blob's projected ellipse and its own alpha ramp — the derivation
// GroundShadow used to hold inline, lifted out with E3e so the canvas painter
// and the frame-buffer compositor read one geometry instead of two that have to
// agree by hand.
//
// It is an ellipse only in the sense that a circle on the ground projects to
// one. The shape is built from the ground's own basis rather than from a
// closed-form semi-axis pair: project the circle's centre and two points a
// radius away along +x and +z, and the two difference vectors ARE the projected
// ellipse's axes. A unit circle then lands on it exactly for the affine part of
// the projection, tilting with roll and foreshortening with pitch and zoom
// without any of that being written down here.

import { GROUND_Y, metresToUnits } from "@rendering/worldScale";

import type { MeshBounds } from "@primitives/Mesh";
import type Fog from "@rendering/Fog";
import type GroundProjection from "@rendering/GroundProjection";

// One posed mesh's contribution. The offsets are screen-space and come straight
// from the transition machine: mid-switch there are two meshes sliding across
// the frame, and a shadow drawn without them detaches from the shape it belongs
// to and sits under the middle of the canvas.
export interface ShadowBlob {
  bounds: MeshBounds;
  offsetX: number;
  offsetY: number;
}

// The unit circle's image on screen: p = [ux vx; uy vy] q + (centreX, centreY),
// which is column for column the matrix GroundShadow hands context.transform().
export interface ShadowEllipse {
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  centreX: number;
  centreY: number;
  alpha: number;
}

// Directly under a resting shape, and at its faintest once the shape has risen
// a fade's worth above the plane. A contact shadow is what says an object is
// standing on something; one that never lightens says it is welded there.
const CONTACT_ALPHA = 0.42;
const RISEN_ALPHA = 0.1;
const RISE_FADE = metresToUnits(4);

// The core stays dense over the inner half and gives up the rest, which is what
// makes the blob read as a shadow rather than as a grey disc with a hard edge.
// Exported because the canvas painter spells them as gradient stops and the
// compositor evaluates them as a ramp; they are the same two numbers.
export const CORE_STOP = 0.5;
export const CORE_SHARE = 0.82;

// Below this the projected basis has collapsed — the blob is edge-on, or the
// circle straddles the near plane — and the mapping would either paint a line
// or mirror the gradient through a degenerate matrix.
const MIN_PROJECTED_AREA = 1e-3;

// y is DOWN in this engine, so the mesh's LARGEST y is its lowest point and
// GROUND_Y is a positive number below the origin. The gap between the two is
// the height the shape is hovering at, which is what the density answers to.
//
// Fogged by the same curve as everything else on the ground: a shadow that
// stayed black while the floor around it dissolved would be the one mark in the
// frame that the weather does not reach.
const alphaFor = (ground: GroundProjection, fog: Fog, bounds: MeshBounds): number => {
  const height = Math.max(0, GROUND_Y - bounds.maxY);
  const risen = Math.min(1, height / RISE_FADE);
  const centreZ = (bounds.minZ + bounds.maxZ) / 2;
  const survives = fog.groundAlpha(ground.depthAt((bounds.minX + bounds.maxX) / 2, centreZ));

  return (CONTACT_ALPHA + (RISEN_ALPHA - CONTACT_ALPHA) * risen) * survives;
};

// Null for a blob that has no business being drawn at all: an empty mesh, one
// the near plane has rejected, or one whose basis has collapsed to a line.
export const shadowEllipseFor = (ground: GroundProjection, fog: Fog, blob: ShadowBlob): ShadowEllipse | null => {
  const { bounds } = blob;
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreZ = (bounds.minZ + bounds.maxZ) / 2;
  // The mean of the two horizontal half-extents, so a long shape casts one
  // round shadow of its average width rather than an oval fighting the one
  // perspective already gives it. An empty mesh folds to an inverted box and
  // fails this test as NaN, which is the intent.
  const radius = (bounds.maxX - bounds.minX + (bounds.maxZ - bounds.minZ)) / 4;

  if (!(radius > 0) || ground.depthAt(centreX, centreZ) < ground.nearDepth) {
    return null;
  }

  const centre = ground.project(centreX, centreZ);
  const alongX = ground.project(centreX + radius, centreZ);
  const alongZ = ground.project(centreX, centreZ + radius);
  const ux = alongX.x - centre.x;
  const uy = alongX.y - centre.y;
  const vx = alongZ.x - centre.x;
  const vy = alongZ.y - centre.y;

  if (Math.abs(ux * vy - uy * vx) < MIN_PROJECTED_AREA) {
    return null;
  }

  return {
    ux,
    uy,
    vx,
    vy,
    centreX: centre.x + blob.offsetX,
    centreY: centre.y + blob.offsetY,
    alpha: alphaFor(ground, fog, bounds),
  };
};

// The gradient's three stops, evaluated at a radius in the unit circle's own
// frame. Every stop is black, so the canvas's premultiplied interpolation
// leaves the colour alone and moves only the alpha — which is what lets one
// linear ramp stand in for the CanvasGradient the painter path builds, rather
// than merely approximate it.
export const shadowAlphaAt = (radius: number, alpha: number): number => {
  if (radius >= 1) {
    return 0;
  }

  if (radius <= CORE_STOP) {
    return alpha + (alpha * CORE_SHARE - alpha) * (radius / CORE_STOP);
  }

  return alpha * CORE_SHARE * (1 - (radius - CORE_STOP) / (1 - CORE_STOP));
};
