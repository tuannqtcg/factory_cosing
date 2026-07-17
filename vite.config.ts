import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// M12.2 — scaffold frontend thật (AGENTS.md stack: React 18 + TS strict +
// Tailwind + Recharts). KHÔNG có `test` field ở đây — `npm test` (vitest)
// chạy độc lập trên `tests/` (engine, Node-only), không phụ thuộc config này.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  root: '.',
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
});
