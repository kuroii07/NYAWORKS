import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

type NodeProcessLike = {
  env: Record<string, string | undefined>;
};

const nodeProcess = (globalThis as typeof globalThis & { process?: NodeProcessLike }).process;
const cepDevOutput = nodeProcess?.env.NYAWORKS_CEP_DEV_OUT_DIR;
const isCepDev = nodeProcess?.env.NYAWORKS_CEP_DEV === "1";

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __NYAWORKS_CEP_DEV__: JSON.stringify(isCepDev)
  },
  server: {
    watch: {
      ignored: ["**/work/**", "**/outputs/**"]
    }
  },
  build: {
    target: "chrome74",
    outDir: cepDevOutput || "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false
  }
});
