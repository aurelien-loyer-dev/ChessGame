/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vercel Web Analytics only exists on Vercel deployments.
    __VERCEL__: JSON.stringify(!!process.env.VERCEL),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
  },
});
