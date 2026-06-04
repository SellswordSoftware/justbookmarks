import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Keep dev aligned with the stock Wails+Vite template, but force relative
  // asset paths for packaged desktop builds.
  base: command === "build" ? "./" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Inject __TEST_MODE__ constant: true in dev, false in production.
  // Vite replaces the global at build time so test code is tree-shaken away.
  define: {
    __TEST_MODE__: JSON.stringify(command === "serve"),
  },
}));
