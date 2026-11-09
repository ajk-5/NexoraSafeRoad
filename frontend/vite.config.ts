import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

// The dev server forwards API calls and incident clips to the backend, so the
// browser only ever talks to one origin. Set BACKEND_URL to point elsewhere.
export default defineConfig(({ mode }) => {
  const envDir = resolve(process.cwd(), "..");
  const backend = loadEnv(mode, envDir, "").BACKEND_URL ?? "http://localhost:8000";
  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": { target: backend, ws: true }, "/media": backend },
    },
  };
});
