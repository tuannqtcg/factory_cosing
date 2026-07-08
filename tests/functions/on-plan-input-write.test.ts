// M12.4b — test tích hợp Cloud Function `onPlanInputWrite`
// (functions/src/index.ts) trên Firestore + Functions Emulator THẬT, giống
// pattern tests/functions/on-scenario-write.test.ts (M12.4): ghi
// `scenarios/{id}` + `planInputs/{period}` bằng Admin SDK, đợi function tự
// chạy, xác nhận `outputs/plan` khớp KẾT QUẢ engine pure
// `calculatePlanForScenario()` (đã có test số tính tay riêng ở
// tests/unit/plan-support.test.ts — ở đây chỉ verify đường ống Firestore).
//
// KHÔNG chạy trong `npm test` (cần Functions+Firestore Emulator) — chạy qua
// `npm run test:functions` (firebase emulators:exec).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { calculatePlanForScenario } from '../../src/engine/plan-support.js';
import { ScenarioInputSchema, PlanInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 15000, intervalMs = 250): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result !== undefined) return result;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor() timeout sau ${timeoutMs}ms — Cloud Function onPlanInputWrite chưa chạy xong?`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('Cloud Function onPlanInputWrite (emulator thật)', () => {
  let app: App;
  let db: Firestore;
  const scenarioId = 'baseline-v3.4-plan-functions-test';

  beforeAll(() => {
    const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
    const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firebaseJson.emulators.firestore.port}`;
    app = initializeApp({ projectId: firebaserc.projects.default }, 'on-plan-input-write-test');
    db = getFirestore(app);
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection('scenarios'));
    await deleteApp(app);
  });

  const planInput = PlanInputSchema.parse({
    scenarioId,
    period: '2026-Q3',
    periodMonths: 3,
    currentLaborHeadcount: { pipe: 4, fitting: 1 },
    pipePlan: [{ dn: 'DN50', meters: 50_000 }],
    fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 20_000 }],
    materialSafetyStockFactor: 0.05,
  });

  it('ghi planInputs/{period} → Cloud Function tính outputs/plan khớp engine pure', async () => {
    const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());
    const expected = calculatePlanForScenario(scenarioInput, planInput);

    await db.doc(`scenarios/${scenarioId}`).set({ ...scenarioInput, id: scenarioId });
    await db.doc(`scenarios/${scenarioId}/planInputs/2026-Q3`).set(planInput);

    const plan = await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/plan`).get();
      return snap.exists ? snap.data() : undefined;
    });

    expect(plan?.shiftsNeeded).toEqual(expected.shiftsNeeded);
    expect(plan?.moldConstraintWarnings).toEqual(expected.moldConstraintWarnings);
    expect(plan?.laborToHire).toEqual(expected.laborToHire);
    expect(plan?.idleCapacityCostPipePerKg).toBeCloseTo(expected.idleCapacityCostPipePerKg!, 6);
    const pipeReq = plan?.materialRequirement.find((r: any) => r.materialId === 'bm-orange-pipe');
    const expectedPipeReq = expected.materialRequirement.find((r) => r.materialId === 'bm-orange-pipe')!;
    expect(pipeReq.kgToBuy).toBeCloseTo(expectedPipeReq.kgToBuy, 6);
    expect(pipeReq.vndValue).toBeCloseTo(expectedPipeReq.vndValue, 3);
    expect(pipeReq.usdValueAtRawReplacement).toBeCloseTo(expectedPipeReq.usdValueAtRawReplacement, 6);
  }, 20000);

  it('ghi lại planInputs với kế hoạch khác → outputs/plan GHI ĐÈ (1 doc duy nhất, ADR-010)', async () => {
    const doubled = { ...planInput, pipePlan: [{ dn: 'DN50', meters: 100_000 }], fittingPlan: [] };
    await db.doc(`scenarios/${scenarioId}/planInputs/2026-Q3`).set(doubled);

    const plan = await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/plan`).get();
      const data = snap.data();
      // đợi bản GHI ĐÈ: fittingPlan rỗng → không còn dòng NVL bm-fitting
      return data && !data.materialRequirement.some((r: any) => r.materialId === 'bm-fitting') ? data : undefined;
    });
    const pipeReq = plan.materialRequirement.find((r: any) => r.materialId === 'bm-orange-pipe');
    expect(pipeReq.kgToBuy).toBeCloseTo(147_000, 6); // 2× kịch bản đầu (73.500)
  }, 20000);

  it('xóa planInputs/{period} → Cloud Function dọn outputs/plan', async () => {
    await db.doc(`scenarios/${scenarioId}/planInputs/2026-Q3`).delete();

    await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/plan`).get();
      return snap.exists ? undefined : true;
    });
  }, 20000);
});
