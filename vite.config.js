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
  base: "/3dengine",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@animations": path.resolve(__dirname, "src/animations"),
      "@primitives": path.resolve(__dirname, "src/primitives"),
      "@data": path.resolve(__dirname, "src/data"),
      "@textures": path.resolve(__dirname, "src/textures"),
      "@rendering": path.resolve(__dirname, "src/rendering"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
