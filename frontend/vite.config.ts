import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/images": "http://localhost:5000"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
