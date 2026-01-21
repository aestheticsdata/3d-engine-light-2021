import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "src",
  base: "/3dengine",
  resolve: {
    alias: {
      "@primitives": path.resolve(__dirname, "src/primitives"),
      "@data": path.resolve(__dirname, "src/data"),
      "@textures": path.resolve(__dirname, "src/textures"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
