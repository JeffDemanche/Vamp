import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Listen on all interfaces so the dev server is reachable when running in
    // a container (e.g. `docker compose watch`).
    host: true,
    // Polling makes file-change detection reliable inside Docker on macOS.
    watch: {
      usePolling: true,
    },
  },
});
