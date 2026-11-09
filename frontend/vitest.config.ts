import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit and component tests (npm test). jsdom stands in for the browser; CSS is not loaded.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
