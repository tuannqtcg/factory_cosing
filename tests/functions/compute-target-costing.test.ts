// M12.4c — test tích hợp HTTPS Callable `computeTargetCosting`
// (functions/src/index.ts, ADR-013) trên Firestore + Functions + AUTH Emulator
// THẬT: tạo user với custom claim `role` qua Admin SDK, đổi custom token lấy
// idToken thật từ Auth Emulator, gọi callable qua giao thức HTTP onCall
// (POST {data}, header Authorization: Bearer) — verify CẢ kết quả tính lẫn
// ranh giới quyền (pricing/admin được, sales bị chặn, chưa đăng nhập bị chặn),
// không chỉ tin code đọc claim đúng.
//
// KHÔNG chạy trong `npm test` — chạy qua `npm run test:functions`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  computeTargetProfitForScenario,
  computeTargetPriceForScenario,
} from '../../src/engine/target-costing.js';
import { ScenarioInputSchema, TargetProfitRequestSchema, TargetPriceRequestSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('HTTPS Callable computeTargetCosting (emulator thật, ADR-013)', () => {
  let app: App;
  let db: Firestore;
  let auth: Auth;
  let projectId: string;
  let authPort: number;
  let functionsPort: number;
  const scenarioId = 'baseline-v3.4-target-costing-test';
  const idTokenByRole = new Map<string, string>();

  /** Đổi custom token (Admin SDK) lấy idToken THẬT từ Auth Emulator — idToken mang custom claim `role`. */
  async function idTokenFor(role: 'pricing' | 'admin' | 'sales'): Promise<string> {
    const cached = idTokenByRole.get(role);
    if (cached) return cached;
    const uid = `tc-user-${role}`;
    await auth.createUser({ uid }).catch(() => undefined); // đã tồn tại từ lần chạy trước → bỏ qua
    await auth.setCustomUserClaims(uid, { role });
    const customToken = await auth.createCustomToken(uid);
    const res = await fetch(
      `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    const body = (await res.json()) as { idToken?: string };
    if (!body.idToken) throw new Error(`Auth Emulator không trả idToken cho role=${role}: ${JSON.stringify(body)}`);
    idTokenByRole.set(role, body.idToken);
    return body.idToken;
  }

  /** Gọi callable theo đúng giao thức onCall: POST {data}, trả {status, json}. */
  async function callComputeTargetCosting(data: unknown, idToken?: string) {
    const res = await fetch(`http://127.0.0.1:${functionsPort}/${projectId}/us-central1/computeTargetCosting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ data }),
    });
    return { status: res.status, json: (await res.json()) as any };
  }

  beforeAll(async () => {
    const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
    const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));
    projectId = firebaserc.projects.default;
    authPort = firebaseJson.emulators.auth.port;
    functionsPort = firebaseJson.emulators.functions.port;
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firebaseJson.emulators.firestore.port}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`;
    app = initializeApp({ projectId }, 'compute-target-costing-test');
    db = getFirestore(app);
    auth = getAuth(app);

    const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());
    await db.doc(`scenarios/${scenarioId}`).set({ ...scenarioInput, id: scenarioId });
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection('scenarios'));
    await deleteApp(app);
  });

  it('T2 (vai pricing): targetProfit=0 dòng Ống → kết quả khớp engine pure + ghi outputs/targetCosting', async () => {
    const request = { scenarioId, productLine: 'pipe', targetProfitVnd: 0 };
    const expected = computeTargetProfitForScenario(
      ScenarioInputSchema.parse(buildBaselineScenarioInput()),
      TargetProfitRequestSchema.parse(request),
    );

    const { status, json } = await callComputeTargetCosting(request, await idTokenFor('pricing'));
    expect(status).toBe(200);
    expect(json.result.kind).toBe('targetProfit');
    expect(json.result.result.requiredQtyKgOrMachineHours).toBeCloseTo(expected.requiredQtyKgOrMachineHours, 6);
    expect(json.result.result.feasibleWithinNormalCapacity).toBe(expected.feasibleWithinNormalCapacity);

    const doc = await db.doc(`scenarios/${scenarioId}/outputs/targetCosting`).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.kind).toBe('targetProfit');
    expect(doc.data()?.result.requiredQtyKgOrMachineHours).toBeCloseTo(expected.requiredQtyKgOrMachineHours, 6);
  }, 20000);

  it('T3 (vai admin): DN50 mục tiêu 260.000đ/m → feasible, khớp engine pure, GHI ĐÈ outputs/targetCosting', async () => {
    const request = {
      scenarioId,
      productLine: 'pipe',
      targetListPriceVnd: 260_000,
      freeVarPath: 'materials.0.inventory.replacementPriceUsdPerKg',
      isPenetrationPrice: false,
      productKey: { dn: 'DN50' },
    };
    const expected = computeTargetPriceForScenario(
      ScenarioInputSchema.parse(buildBaselineScenarioInput()),
      TargetPriceRequestSchema.parse(request),
    );
    if (!expected.feasible) throw new Error('Kỳ vọng case chuẩn phải feasible — xem tests/unit/target-costing.test.ts');

    const { status, json } = await callComputeTargetCosting(request, await idTokenFor('admin'));
    expect(status).toBe(200);
    expect(json.result.kind).toBe('targetPrice');
    expect(json.result.result.feasible).toBe(true);
    expect(json.result.result.value).toBeCloseTo(expected.value, 6);
    // forward-verify qua dây HTTP (luật #4 skill inverse-solver)
    const dn50 = json.result.result.forwardOutput.skuPriceChains.find((s: any) => s.productKey.dn === 'DN50');
    expect(dn50.chain.listPriceBeforeVat).toBe(260_000);

    // GHI ĐÈ: doc giờ là request T3 gần nhất (trước đó là T2 của test trên)
    const doc = await db.doc(`scenarios/${scenarioId}/outputs/targetCosting`).get();
    expect(doc.data()?.kind).toBe('targetPrice');
  }, 30000);

  it('vai sales → permission-denied; chưa đăng nhập → unauthenticated (bảng scenario.md §6)', async () => {
    const request = { scenarioId, productLine: 'pipe', targetProfitVnd: 0 };

    const salesCall = await callComputeTargetCosting(request, await idTokenFor('sales'));
    expect(salesCall.status).toBe(403);
    expect(salesCall.json.error.status).toBe('PERMISSION_DENIED');

    const anonCall = await callComputeTargetCosting(request);
    expect(anonCall.status).toBe(401);
    expect(anonCall.json.error.status).toBe('UNAUTHENTICATED');
  }, 20000);

  it('freeVarPath ngoài allowlist (ADR-013 mục 3) → invalid-argument, không goal-seek field tùy tiện', async () => {
    const { status, json } = await callComputeTargetCosting(
      {
        scenarioId,
        productLine: 'pipe',
        targetListPriceVnd: 260_000,
        freeVarPath: 'costPool.currency.usdVndRate',
        isPenetrationPrice: false,
        productKey: { dn: 'DN50' },
      },
      await idTokenFor('pricing'),
    );
    expect(status).toBe(400);
    expect(json.error.status).toBe('INVALID_ARGUMENT');
    expect(json.error.message).toMatch(/allowlist/);
  }, 20000);
});
