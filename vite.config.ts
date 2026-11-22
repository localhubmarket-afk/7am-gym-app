import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ['src/d3ChartBridge.ts']
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true,
    hmr: false
  },
  preview: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true
  }
});
