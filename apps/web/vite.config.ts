import { defineConfig } from 'vite';

/**
 * The built app (dist/) is served by the API itself (WEB_ROOT), so production needs no CORS.
 * During development the Vite server forwards /api to the local API on port 4000.
 */
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
