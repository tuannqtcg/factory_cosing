// M12.5 — seed Emulator Suite cho phiên dev UI thật (`npm run seed:emulator`,
// chạy bằng vite-node TRONG LÚC `firebase emulators:start` đang chạy):
// 1. Tạo 4 user demo theo vai (admin/pricing/sales/production@demo.local,
//    mật khẩu `demo-password`) + custom claim `role` — đúng cơ chế
//    firestore.rules M12.3 đọc.
// 2. Ghi `scenarios/baseline-v3.4` từ fixture thật (tests/helpers) — Cloud
//    Function onScenarioWrite (M12.4) tự tính outputs/internal + priceList.
// Idempotent: chạy lại chỉ ghi đè, không nhân đôi.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ScenarioInputSchema } from '../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../tests/helpers/scenario-fixture.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));

process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${firebaseJson.emulators.firestore.port}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `127.0.0.1:${firebaseJson.emulators.auth.port}`;

const app = initializeApp({ projectId: firebaserc.projects.default });
const auth = getAuth(app);
const db = getFirestore(app);

const ROLES = ['admin', 'pricing', 'sales', 'production'] as const;
const SCENARIO_ID = 'baseline-v3.4';

// Chủ app (owner) mặc định — vai `admin` = toàn quyền (ADR-020 view CEO). Đăng
// nhập bằng email/mật khẩu demo trên emulator; production dùng chính email này.
const OWNER_EMAIL = 'tuannq6886@gmail.com';

async function seedUsers(): Promise<void> {
  for (const role of ROLES) {
    const email = `${role}@demo.local`;
    const existing = await auth.getUserByEmail(email).catch(() => null);
    const user =
      existing ?? (await auth.createUser({ uid: `demo-${role}`, email, password: 'demo-password' }));
    await auth.setCustomUserClaims(user.uid, { role });
    console.log(`✓ user ${email} (role=${role})`);
  }
  // Owner app — role admin.
  const owner = (await auth.getUserByEmail(OWNER_EMAIL).catch(() => null))
    ?? (await auth.createUser({ uid: 'owner', email: OWNER_EMAIL, password: 'demo-password' }));
  await auth.setCustomUserClaims(owner.uid, { role: 'admin' });
  console.log(`✓ OWNER ${OWNER_EMAIL} (role=admin)`);
}

async function seedScenario(): Promise<void> {
  // ADR-044 — baseline BlazeMaster sạch; Corzan nhập tay trong app (chuẩn hóa).
  const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());

  // DEMO ONLY (không đụng fixture parity — tests dựng scenario riêng): làm giàu
  // tồn kho nguyên liệu Ống BlazeMaster thành 3 lô KHÁC GIÁ + giá tái tạo LỆCH
  // vượt ngưỡng, để màn "Giá Vốn Theo Lô" (ADR-024) minh hoạ đúng câu hỏi:
  // 5 lô khác giá → giá vốn bình quân, lãi/lỗ giữ kho, có cần chốt lại giá không.
  const bmPipe = scenarioInput.materials.find((m) => m.id === 'bm-orange-pipe');
  if (bmPipe) {
    bmPipe.inventory.lots = [
      { tons: 10, priceUsdPerKg: 3.03 }, // lô cũ, giá thấp
      { tons: 8, priceUsdPerKg: 2.80 }, // lô mua đáy
      { tons: 6, priceUsdPerKg: 3.25 }, // lô gần đây
    ];
    bmPipe.inventory.replacementPriceUsdPerKg = 3.4; // giá thị trường hiện tại (lệch +12% so baseline 3.03)
  }

  await db.doc(`scenarios/${SCENARIO_ID}`).set({ ...scenarioInput, id: SCENARIO_ID });
  console.log(`✓ scenarios/${SCENARIO_ID} (demo 3 lô Ống BM khác giá — Cloud Function tự tính outputs/*)`);
}

await seedUsers();
await seedScenario();
console.log('Seed xong. Mở http://localhost:5173 (npm run dev) và chọn vai trên sidebar.');
