import { defineConfig } from 'vite';

// GARDEN_BASE is the path the site is served from, e.g. /garden-of-poems/ on GitHub Pages.
export default defineConfig({
  base: process.env.GARDEN_BASE || '/',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  server: { port: 8080 },
  preview: { port: 8080 },
});
