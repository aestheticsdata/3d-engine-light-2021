export interface ShapeReference {
  label: string;
  url: string;
}

export interface ShapeInfo {
  title: string;
  description: string;
  geometricFeature: string;
  densityLabel: string;
  textureSummary: string;
  // Optional: shapes with no canonical write-up (the cross) simply omit these.
  references?: ShapeReference[];
}

const shapeInfo: Record<string, ShapeInfo> = {
  sphere: {
    title: "Sphere",
    description:
      "A low-poly sphere built from latitude and longitude bands with a bold checker pattern.",
    geometricFeature:
      "Triangulated meridians and parallels approximate a smooth volume with a limited polygon budget.",
    densityLabel: "Medium density",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Sphere" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Sphere.html" },
    ],
  },
  cube: {
    title: "Cube",
    description:
      "A hard-edged box mixing flat-colored faces with subdivided textured surfaces.",
    geometricFeature:
      "Two faces are heavily subdivided for texture mapping, while the others stay simple and flat.",
    densityLabel: "High density",
    textureSummary: "Dog and galaxy textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Cube" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Cube.html" },
    ],
  },
  pyramid: {
    title: "Pyramid",
    description:
      "A classic square-based pyramid with strongly contrasted side colors and a sharp apex.",
    geometricFeature:
      "Five vertices define four lateral faces converging to a single tip plus a triangulated base.",
    densityLabel: "Low density",
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
    title: "Cross",
    description:
      "An extruded cross silhouette that reads like a solid emblem rather than a rounded primitive.",
    geometricFeature:
      "A 2D profile is duplicated in depth, then stitched with side quads to create thickness.",
    densityLabel: "Medium density",
    textureSummary: "No textures",
  },
  donut: {
    title: "Donut",
    description:
      "A torus primitive with a dense triangulated ring and alternating pastel surface colors.",
    geometricFeature:
      "A circular tube is swept around a larger circle, producing a continuous loop with no sharp corners.",
    densityLabel: "High density",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Torus" },
      { label: "MathWorld", url: "https://mathworld.wolfram.com/Torus.html" },
    ],
  },
  torusKnot: {
    title: "Torus Knot",
    description:
      "A tubular surface wrapped along a trefoil-like closed knot with repeating braided curvature.",
    geometricFeature:
      "The tube follows a p/q knot centerline and uses transported frames to keep the cross-section stable.",
    densityLabel: "High density",
    textureSummary: "No textures",
    references: [
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Torus_knot" },
      {
        label: "MathWorld",
        url: "https://mathworld.wolfram.com/TorusKnot.html",
      },
    ],
  },
  menger: {
    title: "Menger Sponge",
    description:
      "A level-2 cube fractal carved by recursively removing center volumes on each axis.",
    geometricFeature:
      "Only exposed voxel faces are emitted, revealing tunnels and cavities while preserving a clean outer silhouette.",
    densityLabel: "Very high density",
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
    title: "Cuboctahedron",
    description:
      "An Archimedean solid mixing 8 triangles and 6 squares, coloured by face type in the blues of Conway's plate.",
    geometricFeature:
      "Its 12 vertices are the midpoints of a cube's edges, so cube and octahedron faces alternate around every vertex.",
    densityLabel: "Low density",
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
    title: "Rhombic dodecahedron",
    description:
      "A Catalan solid whose 12 identical rhombic faces are shaded in three tones, one per axis they share.",
    geometricFeature:
      "The convex hull of a cube and its dual octahedron, and the dual of the cuboctahedron: a face here for every vertex there.",
    densityLabel: "Low density",
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
    title: "Kisrhombic dodecahedron",
    description:
      "The disdyakis dodecahedron: 48 identical scalene triangles in two alternating greens, one light and one dark.",
    geometricFeature:
      "A pyramid raised on each of the rhombic dodecahedron's 12 faces, placed by reciprocating the truncated cuboctahedron rather than by eye.",
    densityLabel: "Low density",
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
    title: "Truncated cuboctahedron",
    description:
      "An Archimedean solid of 12 squares, 8 hexagons and 6 octagons, in three ambers keyed to the face types.",
    geometricFeature:
      "Its 26 faces sit on the 26 axes of the cube — an octagon per face axis, a hexagon per corner axis, a square per edge axis.",
    densityLabel: "Medium density",
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
};

export default shapeInfo;
