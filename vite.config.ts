import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    watch: {
      ignored: ["**/work/**", "**/outputs/**"]
    }
  },
  build: {
    target: "chrome74",
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false
  }
});
