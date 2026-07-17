import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const auth = getAuth(initializeApp());

// Owner app (chủ) + 4 tài khoản demo theo vai. Owner = role admin (toàn quyền,
// ADR-020 view CEO). Đổi mật khẩu owner ngay sau lần đăng nhập đầu ở production.
const OWNER_EMAIL = 'tuannq6886@gmail.com';
const accounts: Array<{ email: string; role: string; label: string }> = [
  { email: OWNER_EMAIL, role: 'admin', label: 'OWNER' },
  { email: 'admin@demo.local', role: 'admin', label: 'Demo ADMIN' },
  { email: 'pricing@demo.local', role: 'pricing', label: 'Demo PRICING' },
  { email: 'sales@demo.local', role: 'sales', label: 'Demo SALES' },
  { email: 'production@demo.local', role: 'production', label: 'Demo PRODUCTION' },
];

async function run() {
  for (const { email, role, label } of accounts) {
    const password = 'demo-password';

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`Tài khoản ${email} đã tồn tại. Cập nhật lại mật khẩu và quyền...`);
      await auth.updateUser(userRecord.uid, { password });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({ email, password, displayName: label });
        console.log(`Đã tạo mới tài khoản ${email}.`);
      } else {
        throw error;
      }
    }

    // Cấp quyền (Custom Claims) cho tài khoản
    await auth.setCustomUserClaims(userRecord.uid, { ...userRecord.customClaims, role });
    console.log(`-> Cấp quyền '${role}' thành công cho ${email}${label === 'OWNER' ? ' (OWNER)' : ''}`);
  }

  console.log('\n✅ Đã tạo owner + toàn bộ tài khoản demo thành công!');
}

run().catch(console.error);
