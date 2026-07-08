// M12.3 — test firestore.rules trên Firestore Emulator (@firebase/rules-unit-testing).
// KHÔNG chạy trong `npm test` (vitest.config.ts loại trừ `tests/rules/**`) —
// cần emulator đang chạy, xem script `npm run test:rules` (firebase emulators:exec).
// Test tối thiểu mỗi vai (admin/pricing/sales/production) × mỗi vùng dữ liệu
// trong bảng phân quyền scenario.md §6: 1 test ĐƯỢC phép, 1 test BỊ từ chối.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

let testEnv: RulesTestEnvironment;

// Fixture tối giản — chỉ đủ field mà firestore.rules đọc tới (không cần khớp
// đầy đủ ScenarioInputSchema, rules không chạy Zod).
const baseScenario = {
  id: 'scn-1',
  asOfYear: 2026,
  resources: {
    pipe: {
      driverType: 'continuous_kg',
      actualCapacityKgPerHour: 100,
      extruderPriceEach: 1000000000,
      extruderCount: 2,
      moldPullerCutterCost: 50000000,
      yieldRate: 0.95,
    },
    fitting: {
      driverType: 'machine_hour',
      yieldRate: 0.9,
      machineTypes: [{ id: 'A', priceVnd: 500000000, count: 3 }],
      moldAssets: [],
    },
  },
  products: [],
  costPool: {
    sharedFixedCosts: {
      labAnnualized: 1,
      vnUlSetupAnnualized: 0,
      ulSetupAnnualized: 1,
      depreciationYears: 5,
      annualComplianceFee: 1,
      annualLandRent: 1,
    },
    nonProductionCosts: { operatingCostPerYear: 1, financialCostPerYear: 1 },
    currency: {
      usdVndRate: 25000,
      vatOutputRate: 0.08,
      mandatoryInsuranceRate: 0.1,
      compoundImportTaxRate: 0.03,
      customsLogisticsFeeRate: 0.01,
    },
    markup: { markupVfPipe: 0.2, markupVfFitting: 0.25, markupTcg: 0.15, listPriceMargin: 0.1 },
    solvent550PricePerBox: 100000,
  },
  inventory: {
    pipe: { lots: [], priceLock: { baseline: 1.2, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 1.2 },
    fitting: { lots: [], priceLock: { baseline: 1.3, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 1.3 },
    metalInsert: [],
  },
};

function ctxFor(role: 'admin' | 'pricing' | 'sales' | 'production') {
  return testEnv.authenticatedContext(`user-${role}`, { role });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-costing-app-rules-test',
    firestore: {
      rules: readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'scenarios/scn-1'), baseScenario);
    await setDoc(doc(db, 'scenarios/scn-1/outputs/internal'), { fullCostPerKg: 12345 });
    await setDoc(doc(db, 'scenarios/scn-1/outputs/priceList'), { priceLadder: { targetPrice: 1 } });
    await setDoc(doc(db, 'scenarios/scn-1/outputs/plan'), { laborToHire: { pipe: 0, fitting: 0 } });
    await setDoc(doc(db, 'scenarios/scn-1/outputs/productCatalog'), { pipes: [], fittings: [] });
    await setDoc(doc(db, 'scenarios/scn-1/outputs/targetCosting'), { feasible: true, value: 1 });
    await setDoc(doc(db, 'scenarios/scn-1/moldAssets/mold-1'), { id: 'mold-1', label: 'Cút 90º' });
  });
});

describe('scenarios/{id} — đọc (ScenarioInput)', () => {
  it('admin đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1')));
  });
  it('pricing đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1')));
  });
  it('sales KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1')));
  });
  it('production KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1')));
  });
  it('chưa đăng nhập KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'scenarios/scn-1')));
  });
});

describe('scenarios/{id} — ghi field KHÓA (resource.md/cost-pool.md)', () => {
  it('pricing sửa resources.pipe.yieldRate (khóa) bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), { 'resources.pipe.yieldRate': 0.5 })
    );
  });
  it('admin sửa resources.pipe.yieldRate (khóa) được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1'), { 'resources.pipe.yieldRate': 0.5 })
    );
  });
  it('pricing sửa costPool.sharedFixedCosts (khóa) bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'costPool.sharedFixedCosts.labAnnualized': 999,
      })
    );
  });
});

describe('scenarios/{id} — ghi field KHÔNG khóa (markup/currency)', () => {
  it('pricing sửa costPool.markup được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'costPool.markup.markupVfPipe': 0.3,
      })
    );
  });
  it('sales sửa costPool.markup (dù không khóa) vẫn bị từ chối — sales không có quyền ghi scenario', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1'), {
        'costPool.markup.markupVfPipe': 0.3,
      })
    );
  });
});

describe('scenarios/{id} — tạo mới / xóa', () => {
  it('admin tạo scenario mới được phép', async () => {
    await assertSucceeds(setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-new'), baseScenario));
  });
  it('pricing tạo scenario mới bị từ chối', async () => {
    await assertFails(setDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-new'), baseScenario));
  });
  it('admin xóa scenario được phép', async () => {
    await assertSucceeds(deleteDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1')));
  });
  it('pricing xóa scenario bị từ chối', async () => {
    await assertFails(deleteDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1')));
  });
});

describe('outputs/internal (ScenarioOutput đầy đủ — giá vốn)', () => {
  it('admin đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/outputs/internal')));
  });
  it('pricing đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/outputs/internal')));
  });
  it('sales KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/outputs/internal')));
  });
  it('production KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/internal')));
  });
  it('admin cũng KHÔNG ghi trực tiếp được — chỉ Cloud Function (Admin SDK)', async () => {
    await assertFails(setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/outputs/internal'), { x: 1 }));
  });
});

describe('outputs/priceList (bảng giá bán — sales-safe)', () => {
  it('sales đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/outputs/priceList')));
  });
  it('production KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/priceList')));
  });
});

describe('outputs/plan (T1 vận hành)', () => {
  it('production đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/plan')));
  });
  it('sales KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/outputs/plan')));
  });
});

describe('planInputs/{period} (production ghi input kế hoạch)', () => {
  it('production ghi được', async () => {
    await assertSucceeds(
      setDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/planInputs/2026-Q3'), {
        scenarioId: 'scn-1',
        period: '2026-Q3',
      })
    );
  });
  it('pricing KHÔNG ghi được (chỉ đọc)', async () => {
    await assertFails(
      setDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/planInputs/2026-Q3'), {
        scenarioId: 'scn-1',
        period: '2026-Q3',
      })
    );
  });
  it('pricing đọc được', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/planInputs/2026-Q3'), { scenarioId: 'scn-1' });
    });
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/planInputs/2026-Q3')));
  });
});

describe('outputs/productCatalog (danh mục SP cho production — ADR-014, KHÔNG giá)', () => {
  it('production đọc được (nguồn dựng form Kế Hoạch SX)', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/productCatalog')));
  });
  it('admin + pricing đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/outputs/productCatalog')));
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/outputs/productCatalog')));
  });
  it('sales KHÔNG đọc được (không màn nào cần — ADR-014 mục 2)', async () => {
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/outputs/productCatalog')));
  });
  it('client KHÔNG ghi được, kể cả admin/production (Cloud Function only)', async () => {
    await assertFails(setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/outputs/productCatalog'), { pipes: [] }));
    await assertFails(setDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/productCatalog'), { pipes: [] }));
  });
});

describe('outputs/targetCosting (T2/T3 chiến lược)', () => {
  it('pricing đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/outputs/targetCosting')));
  });
  it('production KHÔNG đọc được (ADR-006)', async () => {
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/outputs/targetCosting')));
  });
});

describe('moldAssets/{moldId}', () => {
  it('admin ghi (thêm khuôn mới) được phép', async () => {
    await assertSucceeds(
      setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/moldAssets/mold-2'), {
        id: 'mold-2',
        label: 'Nối giảm',
      })
    );
  });
  it('pricing ghi bị từ chối (chỉ đọc)', async () => {
    await assertFails(
      setDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/moldAssets/mold-2'), {
        id: 'mold-2',
        label: 'Nối giảm',
      })
    );
  });
  it('pricing đọc được', async () => {
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/moldAssets/mold-1')));
  });
  it('sales KHÔNG đọc được', async () => {
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/moldAssets/mold-1')));
  });
});

describe('path không khai báo — mặc định từ chối', () => {
  it('admin cũng không đọc được path lạ', async () => {
    await assertFails(getDoc(doc(ctxFor('admin').firestore(), 'someOtherCollection/doc1')));
  });
});
