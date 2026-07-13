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
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../tests/helpers/scenario-fixture.js';

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

async function seedUsers(): Promise<void> {
  for (const role of ROLES) {
    const email = `${role}@demo.local`;
    const existing = await auth.getUserByEmail(email).catch(() => null);
    const user =
      existing ?? (await auth.createUser({ uid: `demo-${role}`, email, password: 'demo-password' }));
    await auth.setCustomUserClaims(user.uid, { role });
    console.log(`✓ user ${email} (role=${role})`);
  }
}

async function seedScenario(): Promise<void> {
  const scenarioInput = ScenarioInputSchema.parse(buildCorzanScenarioInput());
  await db.doc(`scenarios/${SCENARIO_ID}`).set({ ...scenarioInput, id: SCENARIO_ID });
  console.log(`✓ scenarios/${SCENARIO_ID} (Cloud Function sẽ tự tính outputs/*)`);
}

await seedUsers();
await seedScenario();
console.log('Seed xong. Mở http://localhost:5173 (npm run dev) và chọn vai trên sidebar.');
