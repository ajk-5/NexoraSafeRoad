import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The dev server forwards API calls and incident clips to the backend, so the
// browser only ever talks to one origin. Set BACKEND_URL to point elsewhere.
export default defineConfig(({ mode }) => {
  const backend = loadEnv(mode, process.cwd(), "").BACKEND_URL ?? "http://localhost:8000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": backend, "/media": backend },
    },
  };
});
