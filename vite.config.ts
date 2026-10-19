import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// "preview" mode builds one self-contained HTML file for review outside GitHub.
export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __PREVIEW__: JSON.stringify(mode === "preview") },
  plugins: mode === "preview" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "preview" ? "dist-preview" : "dist",
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: mode === "preview" ? 100_000_000 : 4096,
  },
}));
