import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to the Express backend, so the client can use the
// same relative baseURL it uses in production (where Express serves the build).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    // Split the framework out so app-code changes don't invalidate the vendor
    // chunk in browsers. Rolldown wants the function form, not an object map.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')
            || id.includes('node_modules/scheduler')
            || id.includes('node_modules/@remix-run')) {
            return 'react';
          }
        },
      },
    },
  },
});