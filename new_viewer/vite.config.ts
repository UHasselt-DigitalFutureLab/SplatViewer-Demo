import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  base: "/SplatViewer-Demo/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        scene: resolve(import.meta.dirname, "scene.html"),
      },
    },
  },
});
