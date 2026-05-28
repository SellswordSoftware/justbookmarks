import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Keep dev aligned with the stock Wails+Vite template, but force relative
  // asset paths for packaged desktop builds.
  base: command === "build" ? "./" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
