import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const auth = getAuth(initializeApp());

const roles = ['admin', 'pricing', 'sales', 'production'];

async function run() {
  for (const role of roles) {
    const email = `${role}@demo.local`;
    const password = 'demo-password';
    
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`Tài khoản ${email} đã tồn tại. Cập nhật lại mật khẩu và quyền...`);
      await auth.updateUser(userRecord.uid, { password });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: `Demo ${role.toUpperCase()}`,
        });
        console.log(`Đã tạo mới tài khoản ${email}.`);
      } else {
        throw error;
      }
    }

    // Cấp quyền (Custom Claims) cho tài khoản
    await auth.setCustomUserClaims(userRecord.uid, { ...userRecord.customClaims, role });
    console.log(`-> Cấp quyền '${role}' thành công cho ${email}`);
  }
  
  console.log('\n✅ Đã tạo toàn bộ tài khoản demo thành công!');
}

run().catch(console.error);
