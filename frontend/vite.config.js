import { defineConfig } from "vite";
import wails from "@wailsio/runtime/plugins/vite";

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
  // Wails v3 dev sets WAILS_VITE_PORT (default 9245). Use it when available.
  server: {
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
    host: "127.0.0.1", // Force IPv4 so Wails proxy can connect
  },
  plugins: [wails("./bindings")],
}));
