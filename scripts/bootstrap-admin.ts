// ADR-017 — cấp quyền admin ĐẦU TIÊN trên Firebase project THẬT (không phải
// Emulator). Vấn đề con-gà-quả-trứng: Cloud Function `setUserRole` (admin-only)
// cần MỘT admin gọi, nhưng chưa có admin nào thì không ai gọi được. Script
// này chạy TRỰC TIẾP bằng Admin SDK (bỏ qua Cloud Function/rules), dùng MỘT
// LẦN cho admin đầu tiên — từ đó về sau dùng chính `setUserRole` trong app để
// cấp thêm admin/đổi role user khác, KHÔNG chạy lại script này trừ khi mất hết
// admin.
//
// Cách chạy (trên máy bạn, KHÔNG chạy trong phiên có Emulator đang mở):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/tới/service-account.json \
//     npm run bootstrap-admin -- <email-hoặc-uid>
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const target = process.argv[2];
if (!target) {
  console.error('Cách dùng: npm run bootstrap-admin -- <email-hoặc-uid>');
  process.exit(1);
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    'Script này CHỈ dùng cho project THẬT — bỏ biến FIREBASE_AUTH_EMULATOR_HOST trước khi chạy ' +
      '(scripts/seed-emulator.ts đã lo phần cấp role trên Emulator, không cần script này).',
  );
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Thiếu biến GOOGLE_APPLICATION_CREDENTIALS — trỏ tới file service account key thật ' +
      '(Console Firebase → Project settings → Service accounts → Generate new private key).',
  );
  process.exit(1);
}

const auth = getAuth(initializeApp());
const user = target.includes('@') ? await auth.getUserByEmail(target) : await auth.getUser(target);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' });
console.log(
  `✓ ${user.email ?? user.uid} (uid=${user.uid}) giờ có role=admin. ` +
    'Đăng xuất/đăng nhập lại trong app để claim có hiệu lực (Firebase ID token cache tối đa 1 giờ).',
);
