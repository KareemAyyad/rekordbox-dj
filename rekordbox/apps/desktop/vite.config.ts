import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Electron loads the built UI via file://, so assets must use relative paths.
  base: "./",
  server: { 
    port: 5173, 
    strictPort: true,
    proxy: {
      "/settings": "http://localhost:8787",
      "/queue": "http://localhost:8787",
      "/classify": "http://localhost:8787",
      "/library": "http://localhost:8787",
      "/events": "http://localhost:8787",
      "/shell": "http://localhost:8787",
    }
  }
});
