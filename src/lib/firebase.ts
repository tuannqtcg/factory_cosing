// M12.5 — khởi tạo Firebase client (Auth + Firestore) cho UI thật.
// Quyết định hạ tầng M12 (docs/M12_PLAN.md): CHƯA có Firebase project thật —
// mặc định chạy trên Emulator Suite (project `demo-costing-app`, port theo
// firebase.json). Khi có project thật: dán config vào `.env`
// (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_AUTH_DOMAIN)
// — KHÔNG sửa code, có API key là tự tắt chế độ emulator.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
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
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export type AppRole = 'admin' | 'pricing' | 'sales' | 'production';

/**
 * Nút đổi vai trên sidebar (prototype Pha 1 đã duyệt có role switcher) = đăng
 * nhập bằng user demo tương ứng do `npm run seed:emulator` tạo sẵn (custom
 * claim `role` — firestore.rules M12.3 đọc claim này). CHỈ có nghĩa ở chế độ
 * emulator; với project thật, đăng nhập/cấp vai là việc của security-review
 * Pha 4 (cơ chế cấp claim chưa thiết kế — xem scenario.md §6 "Còn treo").
 */
export async function signInAsRole(role: AppRole): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, `${role}@demo.local`, 'demo-password');
  return credential.user;
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

/** Đọc vai từ custom claim của user hiện tại (null nếu chưa đăng nhập/chưa có claim). */
export async function roleOf(user: User | null): Promise<AppRole | null> {
  if (!user) return null;
  const token = await user.getIdTokenResult();
  const role = token.claims.role;
  return role === 'admin' || role === 'pricing' || role === 'sales' || role === 'production' ? role : null;
}
