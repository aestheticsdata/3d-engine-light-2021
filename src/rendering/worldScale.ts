// The one conversion between the console's authored units and a metre.
//
// Not arbitrary: every primitive in the registry is authored to roughly a
// 100-unit radius (sphere 100, cube ±100, cuboctahedron circumradius 100, the
// Menger sponge 210 across), so pinning 100 units to the metre makes the
// on-screen object a 2 m thing. GROUND_Y follows from the same constant — a
// 1.75 m eye height, the assumption the checker floor always made — which is
// what keeps the shapes hovering about 0.7 m above the ground the way they
// did before this module existed.
//
// Pure, stateless, and needed by three classes — GroundProjection, GroundGrid
// and BackgroundRenderer — so it is exported rather than duplicated three
// times, the same trade D8 already made for easing.ts's helpers.

export const UNITS_PER_METRE = 100;

export const metresToUnits = (metres: number): number => metres * UNITS_PER_METRE;

export const unitsToMetres = (units: number): number => units / UNITS_PER_METRE;

export const GROUND_Y = metresToUnits(1.75);

// How far the ground plane reaches: GROUND_DEPTH_METRES beyond whatever the
// near clip currently is, and GROUND_HALF_WIDTH_METRES to either side. A span
// added to the near clip rather than a fixed far edge, so the visible sheet of
// ground stays the same size regardless of where zoom or FOV puts the near
// plane. Shared by GroundFloor, GroundGrid and GroundProjection's own
// ORTHOGRAPHIC falloff — one ground plane, one edge, one home for the number.
export const GROUND_DEPTH_METRES = 60;
export const GROUND_HALF_WIDTH_METRES = 40;
