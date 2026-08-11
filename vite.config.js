import { defineConfig } from "vite";
import { readFileSync } from "fs";
import path from "path";

// The brand block's build string comes from here rather than from a literal in
// the markup, so bumping the version in one place is enough.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
);

export default defineConfig({
  root: "src",
  // The app owns its whole origin now — halcyon.1991computer.com — rather than
  // living under a path on the studio site, so assets resolve from the root.
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@animations": path.resolve(__dirname, "src/animations"),
      "@app": path.resolve(__dirname, "src/app"),
      "@camera": path.resolve(__dirname, "src/camera"),
      "@primitives": path.resolve(__dirname, "src/primitives"),
      "@data": path.resolve(__dirname, "src/data"),
      "@img": path.resolve(__dirname, "src/img"),
      "@input": path.resolve(__dirname, "src/input"),
      "@textures": path.resolve(__dirname, "src/textures"),
      "@rendering": path.resolve(__dirname, "src/rendering"),
      "@scene": path.resolve(__dirname, "src/scene"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  // Cross-origin isolation, dev only: it is what makes
  // performance.measureUserAgentSpecificMemory() available and
  // performance.now() unclamped, both read by SystemWidget (E6/COS-239). The
  // three image assets under src/textures/images are bundled same-origin
  // imports, so COEP's cross-origin blocking has nothing to break here.
  // Production isolation depends on the static host and is out of scope.
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
