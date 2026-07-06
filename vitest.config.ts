import { defineConfig } from 'vitest/config';

// M12.3 — `npm test` (engine, Node-only) KHÔNG được phụ thuộc Firestore
// Emulator. `tests/rules/**` loại trừ ở đây, chạy riêng qua
// `npm run test:rules` (vitest.rules.config.ts + firebase emulators:exec).
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
  },
});
