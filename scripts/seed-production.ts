// ADR-016/017 — seed dữ liệu THẬT (baseline BlazeMaster v3.4, cùng số liệu
// đã dùng làm "số vàng" đối chiếu Excel trong toàn bộ test suite) vào
// Firestore project THẬT (KHÔNG phải Emulator). CHỈ ghi `scenarios/{id}` —
// KHÔNG đụng Firebase Auth, KHÔNG tạo user demo (khác `seed-emulator.ts` —
// user thật tạo qua Console Authentication + cấp role qua Cloud Function
// `setUserRole`, xem ADR-017). Cloud Function `onScenarioWrite` (đã deploy)
// tự tính `outputs/internal`/`outputs/priceList`/`outputs/productCatalog`
// sau khi ghi — không cần script này tính gì thêm.
//
// Cách chạy (Cloud Shell hoặc máy có Application Default Credentials, xem
// scripts/bootstrap-admin.ts cho 2 cách xác thực):
//   npm run seed:production -- [scenarioId, mặc định baseline-v3.4]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ScenarioInputSchema } from '../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../tests/helpers/scenario-fixture.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    'Script này CHỈ dùng cho project THẬT — bỏ FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST ' +
      '(dùng scripts/seed-emulator.ts cho Emulator).',
  );
  process.exit(1);
}

const projectId: string | undefined = firebaserc.projects?.production;
if (!projectId) {
  console.error('.firebaserc thiếu alias "production" — không biết seed vào project nào.');
  process.exit(1);
}
const databaseId: string | undefined = firebaseJson.firestore?.database;
if (!databaseId) {
  console.error('firebase.json thiếu firestore.database — không biết seed vào database nào.');
  process.exit(1);
}

const scenarioId = process.argv[2] ?? 'baseline-v3.4';

const app = initializeApp({ projectId });
const db = getFirestore(app, databaseId);

const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());
console.log(`Ghi scenarios/${scenarioId} vào project "${projectId}", database "${databaseId}"...`);
await db.doc(`scenarios/${scenarioId}`).set({ ...scenarioInput, id: scenarioId });
console.log(
  `✓ Xong. Cloud Function onScenarioWrite sẽ tự tính outputs/internal, outputs/priceList, ` +
    `outputs/productCatalog trong vài giây — kiểm tra lại Console Firestore (database "${databaseId}").`,
);
