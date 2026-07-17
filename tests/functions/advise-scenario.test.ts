// ADR-022 — test tích hợp HTTPS Callable `adviseScenario` trên Functions + Auth
// + Firestore Emulator THẬT. Không set ANTHROPIC_API_KEY → callable rơi về mock
// rule-based (generateCeoAdviceMock). Verify: ranh giới quyền (admin/pricing gọi
// được, sales/production/anon bị chặn), trả CeoAdviceResult hợp lệ, và ghi audit
// scenarios/{id}/adviceAudit (dấu vết, không nội dung).
//
// KHÔNG chạy trong `npm test` — chạy qua `npm run test:functions`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCENARIO_ID = 'advise-test-scenario';

// CeoPlannerResult hợp lệ tối thiểu (đúng schema src/schemas/ceo-planner.ts).
const ladder = { variableCostFloor: 100663, cashBreakEven: 104240, fullCost: 108712, enterpriseBreakEven: 113477, targetVf: 135890 };
const line = (l: 'pipe' | 'fitting') => ({
  line: l,
  materialId: l === 'pipe' ? 'bm-orange-pipe' : 'bm-fitting',
  materialName: 'BlazeMaster',
  sellingPriceVndPerKg: 135890,
  fullCostVndPerKg: 108712,
  materialCostVndPerKg: 95462,
  processingCostVndPerKg: 11750,
  packagingCostVndPerKg: 1500,
  marginOnPricePct: 20,
  ladder,
  annualProductionKg: 619920,
  annualMachineHours: 4920,
  breakEvenPctOfCapacity: 22.8,
  annualGrossProfitVnd: 16_800_000_000,
  compoundNeedKgPerYear: 688800,
});
const plannerResult = {
  request: {
    scenarioId: SCENARIO_ID,
    marginMode: 'markup_on_cost',
    fxRateUsdVnd: 26500,
    annualPremiseLeaseVnd: 525_000_000,
    pipe: { materialId: 'bm-orange-pipe', compoundPriceUsdPerKg: 3.03, desiredMargin: 0.25, normalShifts: 3 },
    fitting: { materialId: 'bm-fitting', compoundPriceUsdPerKg: 3.85, desiredMargin: 0.4, normalShifts: 1, machineHourUtilization: 0.6 },
  },
  pipe: line('pipe'),
  fitting: line('fitting'),
  summary: {
    revenueVfVnd: 95_600_000_000,
    grossProfitVnd: 20_100_000_000,
    preTaxProfitVnd: 16_700_000_000,
    corporateIncomeTaxVnd: 3_340_000_000,
    netProfitVnd: 13_360_000_000,
    preTaxProfitMarginPct: 17.5,
    cashPerYearVnd: 19_900_000_000,
    paybackYears: 1.24,
    totalInvestedVnd: 26_700_000_000,
  },
  pipeDnPrices: [],
  fittingSkuPrices: [],
};

describe('HTTPS Callable adviseScenario (emulator thật, ADR-022)', () => {
  let app: App;
  let db: Firestore;
  let auth: Auth;
  let projectId: string;
  let authPort: number;
  let functionsPort: number;
  const idTokenByUid = new Map<string, string>();

  async function idTokenFor(uid: string, role?: string): Promise<string> {
    const cached = idTokenByUid.get(uid);
    if (cached) return cached;
    await auth.createUser({ uid }).catch(() => undefined);
    if (role) await auth.setCustomUserClaims(uid, { role });
    const customToken = await auth.createCustomToken(uid);
    const res = await fetch(
      `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
    );
    const body = (await res.json()) as { idToken?: string };
    if (!body.idToken) throw new Error(`Auth Emulator không trả idToken cho uid=${uid}: ${JSON.stringify(body)}`);
    idTokenByUid.set(uid, body.idToken);
    return body.idToken;
  }

  async function callAdvise(data: unknown, idToken?: string) {
    const res = await fetch(`http://127.0.0.1:${functionsPort}/${projectId}/us-central1/adviseScenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
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
    app = initializeApp({ projectId }, 'advise-scenario-test');
    db = getFirestore(app);
    auth = getAuth(app);
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection(`scenarios/${SCENARIO_ID}/adviceAudit`));
    await deleteApp(app);
  });

  it('pricing gọi → trả CeoAdviceResult (mock, chưa set key) + ghi adviceAudit', async () => {
    const { status, json } = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult }, await idTokenFor('adv-pricing', 'pricing'));
    expect(status).toBe(200);
    expect(json.result.generatedByModel).toBe('mock'); // chưa cấu hình ANTHROPIC_API_KEY → fallback
    expect(Array.isArray(json.result.items)).toBe(true);
    expect(json.result.items.length).toBeGreaterThan(0);

    // Audit ghi đúng — dấu vết ai/khi nào/model, KHÔNG lưu nội dung tư vấn.
    const auditSnap = await db.collection(`scenarios/${SCENARIO_ID}/adviceAudit`).where('uid', '==', 'adv-pricing').get();
    expect(auditSnap.size).toBe(1);
    const audit = auditSnap.docs[0]!.data();
    expect(audit).toMatchObject({ uid: 'adv-pricing', role: 'pricing', model: 'mock' });
    expect(audit.items).toBeUndefined(); // KHÔNG lưu nội dung
    expect(audit.at).toBeDefined();
  }, 25000);

  it('admin gọi được; sales/production bị permission-denied; anon unauthenticated', async () => {
    const adminCall = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult }, await idTokenFor('adv-admin', 'admin'));
    expect(adminCall.status).toBe(200);

    const salesCall = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult }, await idTokenFor('adv-sales', 'sales'));
    expect(salesCall.status).toBe(403);
    expect(salesCall.json.error.status).toBe('PERMISSION_DENIED');

    const prodCall = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult }, await idTokenFor('adv-production', 'production'));
    expect(prodCall.status).toBe(403);

    const anonCall = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult });
    expect(anonCall.status).toBe(401);
    expect(anonCall.json.error.status).toBe('UNAUTHENTICATED');
  }, 25000);

  it('request sai schema → invalid-argument', async () => {
    const { status, json } = await callAdvise({ scenarioId: SCENARIO_ID, plannerResult: { bad: true } }, await idTokenFor('adv-admin', 'admin'));
    expect(status).toBe(400);
    expect(json.error.status).toBe('INVALID_ARGUMENT');
  }, 25000);
});
