// M12.5 — khởi tạo Firebase client (Auth + Firestore) cho UI thật.
// Quyết định hạ tầng M12 (docs/M12_PLAN.md): CHƯA có Firebase project thật —
// mặc định chạy trên Emulator Suite (project `demo-costing-app`, port theo
// firebase.json). Khi có project thật: dán config vào `.env`
// (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_AUTH_DOMAIN)
// — KHÔNG sửa code, có API key là tự tắt chế độ emulator.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
/** true = chưa cấu hình project thật → nói chuyện với Emulator Suite. */
export const isEmulatorMode = !envApiKey;

const app = initializeApp(
  isEmulatorMode
    ? { apiKey: 'fake-api-key', authDomain: '127.0.0.1', projectId: 'demo-costing-app' }
    : {
        apiKey: envApiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      },
);

export const auth = getAuth(app);
// ADR-016: project thật dùng database Firestore đặt tên "manufacture" (không
// phải "(default)") — chỉ áp dụng khi KHÔNG chạy Emulator (Emulator vẫn dùng
// "(default)", không đổi hành vi bộ test hiện có). Đọc qua
// VITE_FIREBASE_DATABASE_ID để không hard-code tên database vào code.
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined;
export const db = isEmulatorMode || !databaseId ? getFirestore(app) : getFirestore(app, databaseId);
export const functions = getFunctions(app);

if (isEmulatorMode) {
  // Port khớp firebase.json — đổi ở đó thì đổi ở đây.
  connectAuthEmulator(auth, 'http://127.0.0.1:9100', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectFunctionsEmulator(functions, '127.0.0.1', 5002);
}

export type AppRole = 'admin' | 'pricing' | 'sales' | 'production';

/** ADR-023 — đăng nhập production thật bằng email/mật khẩu (owner + user thật). */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Đăng nhập bằng tài khoản Google (popup). Yêu cầu provider Google đã bật
 * trong Firebase Console và domain app nằm trong Authorized domains. Phân
 * quyền KHÔNG đổi: vẫn đọc custom claim `role` trên token — tài khoản Google
 * chưa được cấp vai sẽ dừng ở màn "Không có quyền truy cập".
 */
export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Gửi email đặt lại mật khẩu (Firebase Auth). Dùng khi quên mật khẩu — link
 * trong email dẫn tới trang đặt mật khẩu mới do Firebase host. Ở emulator,
 * email không gửi thật mà in ra log của Auth Emulator.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/** Đọc vai từ custom claim của user hiện tại (null nếu chưa đăng nhập/chưa có claim). */
export async function roleOf(user: User | null): Promise<AppRole | null> {
  if (!user) return null;
  const token = await user.getIdTokenResult();
  const role = token.claims.role;
  return role === 'admin' || role === 'pricing' || role === 'sales' || role === 'production' ? role : null;
}
