import { defineConfig } from 'vitest/config';

// M12.4 — chỉ chạy tests/functions/**, nhắm vào Firestore + Functions
// Emulator. Dùng qua `npm run test:functions` (bọc trong `firebase
// emulators:exec`), KHÔNG chạy bằng `npm test` thường (xem vitest.config.ts).
export default defineConfig({
  test: {
    include: ['tests/functions/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // M12.4b — 2 file test dùng CHUNG 1 Firestore Emulator và afterAll đều
    // recursiveDelete collection `scenarios`: chạy song song sẽ xóa dữ liệu
    // của nhau giữa chừng → bắt buộc chạy tuần tự từng file.
    fileParallelism: false,
  },
});
