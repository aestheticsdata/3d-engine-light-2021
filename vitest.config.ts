// The six path aliases are read out of vite.config.js rather than restated here.
// They are already declared twice — once for the bundler, once for tsc — and a
// third copy is a third place to forget when one of them moves.

import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default defineConfig({
  resolve: viteConfig.resolve,
  test: {
    // The environment stays node on purpose. Every module this suite covers is
    // pure — no canvas, no markup, no browser globals — and adding an emulation
    // layer is how a suite drifts from testing the logic to testing the shim.
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
