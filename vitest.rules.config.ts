import { defineConfig } from 'vitest/config';

// M12.3 — chỉ chạy tests/rules/**, nhắm vào Firestore Emulator. Dùng qua
// `npm run test:rules` (bọc trong `firebase emulators:exec`), KHÔNG chạy
// bằng `npm test` thường (xem vitest.config.ts).
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
