import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// M12.3/M12.4 — `npm test` (engine, Node-only) KHÔNG được phụ thuộc Firestore/
// Functions Emulator. `tests/rules/**`/`tests/functions/**` loại trừ ở đây,
// chạy riêng qua `npm run test:rules`/`npm run test:functions`
// (vitest.rules.config.ts/vitest.functions.config.ts + firebase emulators:exec).
export default defineConfig({
  // Alias `@` → src/ (khớp vite.config.ts + tsconfig paths) để test UI (nếu có)
  // import được component shadcn qua `@/components/...`.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**', 'tests/functions/**'],
  },
});
