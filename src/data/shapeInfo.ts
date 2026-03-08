export interface ShapeInfo {
  title: string;
  description: string;
  geometricFeature: string;
  densityLabel: string;
  textureSummary: string;
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
  },
  cube: {
    title: "Cube",
    description:
      "A hard-edged box mixing flat-colored faces with subdivided textured surfaces.",
    geometricFeature:
      "Two faces are heavily subdivided for texture mapping, while the others stay simple and flat.",
    densityLabel: "High density",
    textureSummary: "Dog and galaxy textures",
  },
  pyramid: {
    title: "Pyramid",
    description:
      "A classic square-based pyramid with strongly contrasted side colors and a sharp apex.",
    geometricFeature:
      "Five vertices define four lateral faces converging to a single tip plus a triangulated base.",
    densityLabel: "Low density",
    textureSummary: "No textures",
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
  },
};

export default shapeInfo;
