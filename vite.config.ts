import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const proxy = { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } };
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  // `vite preview` serves the production build (with the offline service worker) for e2e tests.
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
});
