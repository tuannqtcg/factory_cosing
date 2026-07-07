// M12.4 — test tích hợp Cloud Function `onScenarioWrite` (functions/src/index.ts)
// trên Firestore + Functions Emulator THẬT (không mock). Ghi
// `scenarios/{id}` bằng Admin SDK (bỏ qua rules — đúng cách production dùng),
// đợi function tự chạy, rồi xác nhận `outputs/internal`/`outputs/priceList`
// được ghi đúng — bao gồm xác nhận `outputs/priceList` KHÔNG lộ giá vốn
// (đúng ranh giới sales-safe, scenario.md §5).
//
// KHÔNG chạy trong `npm test` (cần Functions+Firestore Emulator) — chạy qua
// `npm run test:functions` (firebase emulators:exec), tách biệt
// `vitest.functions.config.ts` giống pattern `tests/rules/` (M12.3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { calculateScenario } from '../../src/engine/scenario.js';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 15000, intervalMs = 250): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result !== undefined) return result;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor() timeout sau ${timeoutMs}ms — Cloud Function onScenarioWrite chưa chạy xong?`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('Cloud Function onScenarioWrite (emulator thật)', () => {
  let app: App;
  let db: Firestore;
  const scenarioId = 'baseline-v3.4-functions-test';

  beforeAll(() => {
    // Đọc trực tiếp firebase.json/.firebaserc để lấy đúng port + projectId —
    // BẮT BUỘC dùng ĐÚNG projectId mà Functions Emulator đang chạy (khác
    // Firestore Emulator độc lập ở tests/rules/ — ở đó project nào cũng được
    // vì @firebase/rules-unit-testing chỉ nói chuyện trực tiếp với Firestore
    // Emulator, không cần Functions Emulator lắng nghe trigger).
    const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
    const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firebaseJson.emulators.firestore.port}`;
    app = initializeApp({ projectId: firebaserc.projects.default });
    db = getFirestore(app);
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection('scenarios'));
    await deleteApp(app);
  });

  it('ghi scenarios/{id} → Cloud Function tự tính outputs/internal + outputs/priceList', async () => {
    const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());
    const expectedOutput = calculateScenario(scenarioInput);
    const expectedFirstChain = expectedOutput.skuPriceChains[0];
    if (!expectedFirstChain) throw new Error('Fixture rỗng — không có skuPriceChains để đối chiếu.');

    await db.doc(`scenarios/${scenarioId}`).set({ ...scenarioInput, id: scenarioId });

    const internal = await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/internal`).get();
      return snap.exists ? snap.data() : undefined;
    });
    expect(internal?.mhrPerMachineHour).toBeCloseTo(expectedOutput.mhrPerMachineHour, 6);
    expect(internal?.skuPriceChains).toHaveLength(expectedOutput.skuPriceChains.length);
    // outputs/internal PHẢI có field giá vốn (đúng vai admin/pricing được đọc) —
    // xác nhận Cloud Function không lược field như priceList.
    expect(internal?.skuPriceChains[0].chain.materialCostPerUnit).toBeTypeOf('number');

    const priceList = await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/priceList`).get();
      return snap.exists ? snap.data() : undefined;
    });
    expect(priceList?.skuPriceChains).toHaveLength(expectedOutput.skuPriceChains.length);
    expect(priceList?.skuPriceChains[0].chain.listPriceWithVat).toBe(expectedFirstChain.chain.listPriceWithVat);
    // Ranh giới sales-safe (scenario.md §5) — priceList KHÔNG được có giá vốn.
    expect(priceList?.skuPriceChains[0].chain.materialCostPerUnit).toBeUndefined();
    expect(priceList?.skuPriceChains[0].chain.breakEvenPerUnit).toBeUndefined();
    // ADR-012 — thang giá theo (line, materialId)
    const expectedPipeLadder = expectedOutput.priceLadder.byLineMaterial.find(
      (e) => e.line === 'pipe' && e.materialId === 'bm-orange-pipe',
    )!.ladder;
    const actualPipeLadder = priceList?.priceLadder.byLineMaterial.find(
      (e: any) => e.line === 'pipe' && e.materialId === 'bm-orange-pipe',
    )?.ladder;
    expect(actualPipeLadder.targetPrice).toBeCloseTo(expectedPipeLadder.targetPrice, 3);
  }, 20000);

  it('xóa scenarios/{id} → Cloud Function dọn outputs/internal + outputs/priceList', async () => {
    await db.doc(`scenarios/${scenarioId}`).delete();

    await waitFor(async () => {
      const snap = await db.doc(`scenarios/${scenarioId}/outputs/internal`).get();
      return snap.exists ? undefined : true;
    });
    const priceListSnap = await db.doc(`scenarios/${scenarioId}/outputs/priceList`).get();
    expect(priceListSnap.exists).toBe(false);
  }, 20000);
});
