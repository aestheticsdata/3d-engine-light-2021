import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  base: "/3dengine",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
