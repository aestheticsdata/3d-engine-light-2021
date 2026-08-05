import type data from "@data/data";
import type { ShapeFamily } from "@data/shapeFamilies";

export interface ShapeReference {
  label: string;
  url: string;
}

export interface ShapeInfo {
  // Which section of the primitive picker the shape is listed under. Required
  // for the same reason `generator` below is, and the reason this record was
  // chosen as the family's home over a separate key-to-family map: a second list
  // of registry keys can drift from the registry, and a shape missing from it
  // would silently vanish from the picker instead of failing loudly.
  family: ShapeFamily;
  title: string;
  description: string;
  geometricFeature: string;
  densityLabel: string;
  // How the mesh is actually produced, as the SHAPE STORY footer prints it.
  // Required on purpose: a shape that lands without one is a compile error
  // rather than an em dash nobody notices. Each value names the construction the
  // shape's own file uses, not a generic description of the family.
  generator: string;
  textureSummary: string;
  // Optional: shapes with no canonical write-up (the cross) simply omit these.
  references?: ShapeReference[];
}

// Checked against the registry, exported widened. The `satisfies` clause is what
// makes a shape added to data.ts and left unclassified here a compile error —
// a missing key, a missing `family` and a mistyped family name all fail at this
// line. The export is deliberately widened back to a string key afterwards:
// every consumer looks a shape up by a name it got at runtime (Main takes it
// from the shape switcher), and narrowing the export would push the fourteen
// literals through the whole call chain to buy nothing.
const entries = {
  sphere: {
    family: "PRIMITIVES",
    title: "Sphere",
    description: "A low-poly sphere built from latitude and longitude bands with a bold checker pattern.",
    geometricFeature: "Triangulated meridians and parallels approximate a smooth volume with a limited polygon budget.",
    densityLabel: "Medium density",
    generator: "lat/long bands",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Sphere" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Sphere.html" },
    ],
  },
  cube: {
    family: "PRIMITIVES",
    title: "Cube",
    description: "A hard-edged box mixing flat-colored faces with subdivided textured surfaces.",
    geometricFeature: "Two faces are heavily subdivided for texture mapping, while the others stay simple and flat.",
    densityLabel: "High density",
    generator: "unit hull + subdivided faces",
    textureSummary: "Dog and galaxy textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Cube" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Cube.html" },
    ],
  },
  pyramid: {
    family: "PRIMITIVES",
    title: "Pyramid",
    description: "A classic square-based pyramid with strongly contrasted side colors and a sharp apex.",
    geometricFeature: "Five vertices define four lateral faces converging to a single tip plus a triangulated base.",
    densityLabel: "Low density",
    generator: "square base + apex fan",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Square_pyramid",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/SquarePyramid.html",
      },
    ],
  },
  cross: {
    family: "PRIMITIVES",
    title: "Cross",
    description: "An extruded cross silhouette that reads like a solid emblem rather than a rounded primitive.",
    geometricFeature: "A 2D profile is duplicated in depth, then stitched with side quads to create thickness.",
    densityLabel: "Medium density",
    generator: "extruded 2D profile",
    textureSummary: "No textures",
  },
  donut: {
    family: "SURFACES",
    title: "Donut",
    description: "A torus primitive with a dense triangulated ring and alternating pastel surface colors.",
    geometricFeature:
      "A circular tube is swept around a larger circle, producing a continuous loop with no sharp corners.",
    densityLabel: "High density",
    generator: "ring sweep",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Torus" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Torus.html" },
    ],
  },
  torusKnot: {
    family: "SURFACES",
    title: "Torus Knot",
    description: "A tubular surface wrapped along a trefoil-like closed knot with repeating braided curvature.",
    geometricFeature:
      "The tube follows a p/q knot centerline and uses transported frames to keep the cross-section stable.",
    densityLabel: "High density",
    generator: "p/q knot sweep",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Torus_knot" },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TorusKnot.html",
      },
    ],
  },
  torusKnot25: {
    family: "SURFACES",
    title: "Cinquefoil knot",
    description:
      "The (2, 5) torus knot, 5₁ — Solomon's seal, five lobes of the same tube sweep in gold over deep blue.",
    geometricFeature:
      "Two turns around the main axis to five through the hole; coprime p and q are what make the curve close as one loop.",
    densityLabel: "High density",
    generator: "p/q knot sweep",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cinquefoil_knot",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/SolomonsSealKnot.html",
      },
    ],
  },
  torusKnot27: {
    family: "SURFACES",
    title: "Septafoil knot",
    description: "The (2, 7) torus knot, 7₁ — seven lobes in mint and violet, the longest curve of the four.",
    geometricFeature:
      "Its curve is the longest in the registry, so the sweep spends its whole tessellation budget on path segments.",
    densityLabel: "High density",
    generator: "p/q knot sweep",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/7_1_knot",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TorusKnot.html",
      },
    ],
  },
  torusKnot34: {
    family: "SURFACES",
    title: "(3, 4) torus knot",
    description: "The (3, 4) torus knot, 8₁₉ — the only one of the four with p > 2, in peach over deep teal.",
    geometricFeature:
      "Three turns around the main axis rather than two, so three strands cross every section of the torus instead of two.",
    densityLabel: "High density",
    generator: "p/q knot sweep",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/8_19_knot",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TorusKnot.html",
      },
    ],
  },
  menger: {
    family: "FRACTALS",
    title: "Menger Sponge",
    description: "A level-2 cube fractal carved by recursively removing center volumes on each axis.",
    geometricFeature:
      "Only exposed voxel faces are emitted, revealing tunnels and cavities while preserving a clean outer silhouette.",
    densityLabel: "Very high density",
    generator: "level-2 recursive carve",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Menger_sponge",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/MengerSponge.html",
      },
    ],
  },
  cuboctahedron: {
    family: "POLYHEDRA",
    title: "Cuboctahedron",
    description:
      "An Archimedean solid mixing 8 triangles and 6 squares, coloured by face type in the blues of Conway's plate.",
    geometricFeature:
      "Its 12 vertices are the midpoints of a cube's edges, so cube and octahedron faces alternate around every vertex.",
    densityLabel: "Low density",
    generator: "convex hull builder",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cuboctahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/Cuboctahedron.html",
      },
    ],
  },
  rhombicDodecahedron: {
    family: "POLYHEDRA",
    title: "Rhombic dodecahedron",
    description: "A Catalan solid whose 12 identical rhombic faces are shaded in three tones, one per axis they share.",
    geometricFeature:
      "The convex hull of a cube and its dual octahedron, and the dual of the cuboctahedron: a face here for every vertex there.",
    densityLabel: "Low density",
    generator: "cube + octahedron hull",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Rhombic_dodecahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/RhombicDodecahedron.html",
      },
    ],
  },
  kisRhombicDodecahedron: {
    family: "POLYHEDRA",
    title: "Kisrhombic dodecahedron",
    description:
      "The disdyakis dodecahedron: 48 identical scalene triangles in two alternating greens, one light and one dark.",
    geometricFeature:
      "A pyramid raised on each of the rhombic dodecahedron's 12 faces, placed by reciprocating the truncated cuboctahedron rather than by eye.",
    densityLabel: "Low density",
    generator: "tCO reciprocal",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Disdyakis_dodecahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/DisdyakisDodecahedron.html",
      },
    ],
  },
  truncatedCuboctahedron: {
    family: "POLYHEDRA",
    title: "Truncated cuboctahedron",
    description:
      "An Archimedean solid of 12 squares, 8 hexagons and 6 octagons, in three ambers keyed to the face types.",
    geometricFeature:
      "Its 26 faces sit on the 26 axes of the cube — an octagon per face axis, a hexagon per corner axis, a square per edge axis.",
    densityLabel: "Medium density",
    generator: "signed permutations",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Truncated_cuboctahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TruncatedCuboctahedron.html",
      },
    ],
  },
  icosidodecahedron: {
    family: "POLYHEDRA",
    title: "Icosidodecahedron",
    description:
      "An Archimedean solid of 20 triangles and 12 pentagons in two roses, the icosahedral counterpart of the cuboctahedron.",
    geometricFeature:
      "Its 30 vertices are the midpoints of an icosahedron's edges, so triangles and pentagons alternate around every one of them.",
    densityLabel: "Low density",
    generator: "icosahedron edge midpoints",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Icosidodecahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/Icosidodecahedron.html",
      },
    ],
  },
  rhombicTriacontahedron: {
    family: "POLYHEDRA",
    title: "Rhombic triacontahedron",
    description:
      "A Catalan solid of 30 identical golden rhombi, shaded in five tones — one per cube inscribed in the dodecahedron.",
    geometricFeature:
      "The convex hull of a dodecahedron and its dual icosahedron, and the dual of the icosidodecahedron: a face here for every vertex there.",
    densityLabel: "Low density",
    generator: "dodecahedron + icosahedron hull",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Rhombic_triacontahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/RhombicTriacontahedron.html",
      },
    ],
  },
  kisRhombicTriacontahedron: {
    family: "POLYHEDRA",
    title: "Kisrhombic triacontahedron",
    description:
      "The disdyakis triacontahedron: 120 identical scalene triangles in two alternating tones, the densest solid of the family.",
    geometricFeature:
      "A pyramid raised on each of the rhombic triacontahedron's 30 faces, placed by reciprocating the truncated icosidodecahedron.",
    densityLabel: "High density",
    generator: "tID reciprocal",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Disdyakis_triacontahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/DisdyakisTriacontahedron.html",
      },
    ],
  },
  truncatedIcosidodecahedron: {
    family: "POLYHEDRA",
    title: "Truncated icosidodecahedron",
    description:
      "An Archimedean solid of 30 squares, 20 hexagons and 12 decagons in three plums, the largest of Conway's family.",
    geometricFeature:
      "One vertex per flag of the icosahedron — each of the 120 sits where a decagon, a hexagon and a square plane meet.",
    densityLabel: "High density",
    generator: "icosahedron flag solve",
    textureSummary: "No textures",
    references: [
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Truncated_icosidodecahedron",
      },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TruncatedIcosidodecahedron.html",
      },
    ],
  },
} satisfies Record<keyof typeof data, ShapeInfo>;

const shapeInfo: Record<string, ShapeInfo> = entries;

export default shapeInfo;
