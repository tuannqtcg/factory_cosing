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
// đầy đủ ScenarioInputSchema, rules không chạy Zod). Sau ADR-012 (2026-07-07):
// materials[] thay `inventory.pipe/fitting`, costPool.markup chỉ còn
// markupTcg/listPriceMargin (markupVfPipe/Fitting → Material.markupVf),
// costPool.currency bỏ 2 field thuế/logistics (→ Material). Fixture cũ dùng
// shape TIỀN ADR-012 khiến bug đường dẫn chết trong `firestore.rules` (M12.9a)
// không bị test này bắt được — xem "scenarios/{id} — ghi field KHÔNG khóa".
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
      hoursPerShift: 8,
    },
    fitting: {
      driverType: 'machine_hour',
      yieldRate: 0.9,
      machineTypes: [{ id: 'A', priceVnd: 500000000, count: 3 }],
      moldAssets: [],
    },
  },
  materials: [
    {
      id: 'bm-orange-pipe',
      name: 'BlazeMaster Orange (ống)',
      markupVf: 0.25,
      inventory: { lots: [{ tons: 10, priceUsdPerKg: 3.03 }], priceLock: { baseline: 1.2, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 1.2 },
    },
    {
      id: 'corzan-pipe',
      name: 'Corzan 3710 (ống)',
      markupVf: 0.25,
      inventory: { lots: [], priceLock: { baseline: 3.47, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 3.47 },
    },
  ],
  products: [{ kind: 'pipe', dn: 'DN20', materialId: 'bm-orange-pipe' }],
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
    currency: { usdVndRate: 25000, vatOutputRate: 0.08, mandatoryInsuranceRate: 0.1 },
    markup: { markupTcg: 0.15, listPriceMargin: 0.1 },
    solvent550PricePerBox: 100000,
  },
  inventory: {
    metalInsert: [
      { renType: 'trong', ptSize: '15', lots: [{ qtyOnHand: 11000, unitPriceVnd: 16200 }], priceLock: { baseline: 16200, thresholdPct: 0.05 }, replacementPriceVnd: 16200 },
    ],
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
  it('pricing sửa products[] (khóa, product.md — M12.9a vá) bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        products: [{ kind: 'pipe', dn: 'DN25', materialId: 'bm-orange-pipe' }],
      })
    );
  });
  it('admin sửa products[] được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1'), {
        products: [{ kind: 'pipe', dn: 'DN25', materialId: 'bm-orange-pipe' }],
      })
    );
  });
});

describe('scenarios/{id} — ghi field KHÔNG khóa (markup/currency/materials/resources không nằm trong danh sách)', () => {
  it('pricing sửa costPool.markup được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'costPool.markup.markupTcg': 0.3,
      })
    );
  });
  it('sales sửa costPool.markup (dù không khóa) vẫn bị từ chối — sales không có quyền ghi scenario', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1'), {
        'costPool.markup.markupTcg': 0.3,
      })
    );
  });
  // M12.9a — regression: trước khi vá, `scenarioLockedFieldsUnchanged()` đọc
  // `inventory.pipe/fitting.priceLock.thresholdPct` KHÔNG tồn tại trên document
  // thật (post ADR-012) → rules ném lỗi khi evaluate → MỌI lần pricing ghi
  // scenarios/{id} đều bị từ chối, kể cả field không khóa như dưới đây. Test
  // này lẽ ra phải đỏ trước khi vá (fixture cũ ở đây vẫn dùng shape lỗi thời
  // nên không bắt được — đã sửa fixture ở trên cho khớp thật).
  it('pricing sửa resources.pipe.hoursPerShift (không khóa) được phép — regression bug đường dẫn chết inventory.pipe/fitting', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'resources.pipe.hoursPerShift': 12,
      })
    );
  });
  it('pricing sửa materials[0] field KHÔNG khóa (markupVf/lots/replacementPriceUsdPerKg), GIỮ NGUYÊN thresholdPct → được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        materials: [
          {
            id: 'bm-orange-pipe',
            name: 'BlazeMaster Orange (ống)',
            markupVf: 0.3,
            inventory: { lots: [{ tons: 12, priceUsdPerKg: 3.1 }], priceLock: { baseline: 1.2, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 1.5 },
          },
          baseScenario.materials[1],
        ],
      })
    );
  });
});

describe('scenarios/{id} — ADR-015: thresholdPct khóa TRONG TỪNG phần tử materials[]/metalInsert[]', () => {
  it('pricing đổi materials[0].inventory.priceLock.thresholdPct bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        materials: [
          { ...baseScenario.materials[0]!, inventory: { ...baseScenario.materials[0]!.inventory, priceLock: { baseline: 1.2, thresholdPct: 0.1 } } },
          baseScenario.materials[1]!,
        ],
      })
    );
  });
  it('pricing đổi materials[1].inventory.priceLock.thresholdPct (index thứ 2, không phải index 0) bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        materials: [
          baseScenario.materials[0]!,
          { ...baseScenario.materials[1]!, inventory: { ...baseScenario.materials[1]!.inventory, priceLock: { baseline: 3.47, thresholdPct: 0.1 } } },
        ],
      })
    );
  });
  it('admin đổi materials[1].inventory.priceLock.thresholdPct được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1'), {
        materials: [
          baseScenario.materials[0]!,
          { ...baseScenario.materials[1]!, inventory: { ...baseScenario.materials[1]!.inventory, priceLock: { baseline: 3.47, thresholdPct: 0.1 } } },
        ],
      })
    );
  });
  it('pricing đổi inventory.metalInsert[0].priceLock.thresholdPct bị từ chối', async () => {
    await assertFails(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'inventory.metalInsert': [{ ...baseScenario.inventory.metalInsert[0]!, priceLock: { baseline: 16200, thresholdPct: 0.1 } }],
      })
    );
  });
  it('admin đổi inventory.metalInsert[0].priceLock.thresholdPct được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1'), {
        'inventory.metalInsert': [{ ...baseScenario.inventory.metalInsert[0]!, priceLock: { baseline: 16200, thresholdPct: 0.1 } }],
      })
    );
  });
  it('pricing sửa inventory.metalInsert[0].lots (không khóa), GIỮ NGUYÊN thresholdPct → được phép', async () => {
    await assertSucceeds(
      updateDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1'), {
        'inventory.metalInsert': [{ ...baseScenario.inventory.metalInsert[0]!, lots: [{ qtyOnHand: 12000, unitPriceVnd: 16500 }] }],
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

describe('priceLockAudit/{entryId} — M12.10 (security-review): audit log "Chốt Baseline Mới"', () => {
  const entry = {
    materialId: 'bm-orange-pipe',
    materialName: 'BlazeMaster Orange (ống)',
    oldBaselineUsdPerKg: 3.03,
    newBaselineUsdPerKg: 3.1,
    changedByUid: 'user-pricing',
    changedByEmail: 'pricing@demo.local',
    changedByRole: 'pricing',
  };
  it('pricing tạo entry được phép', async () => {
    await assertSucceeds(setDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/priceLockAudit/entry-1'), entry));
  });
  it('admin tạo entry được phép', async () => {
    await assertSucceeds(setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/priceLockAudit/entry-2'), entry));
  });
  it('sales KHÔNG tạo được', async () => {
    await assertFails(setDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/priceLockAudit/entry-3'), entry));
  });
  it('production KHÔNG tạo được', async () => {
    await assertFails(setDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/priceLockAudit/entry-4'), entry));
  });
  it('admin/pricing đọc được lịch sử', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/priceLockAudit/entry-5'), entry);
    });
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/priceLockAudit/entry-5')));
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/priceLockAudit/entry-5')));
  });
  it('sales KHÔNG đọc được lịch sử', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/priceLockAudit/entry-6'), entry);
    });
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/priceLockAudit/entry-6')));
  });
  it('KHÔNG ai được SỬA entry đã ghi (append-only), kể cả admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/priceLockAudit/entry-7'), entry);
    });
    await assertFails(updateDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/priceLockAudit/entry-7'), { newBaselineUsdPerKg: 999 }));
  });
  it('KHÔNG ai được XÓA entry đã ghi, kể cả admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/priceLockAudit/entry-8'), entry);
    });
    await assertFails(deleteDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/priceLockAudit/entry-8')));
  });
});

describe('roleAudit/{entryId} — ADR-017: audit log cấp/thu hồi custom claim role (top-level, chỉ Cloud Function ghi)', () => {
  const entry = {
    targetUid: 'uid-target',
    targetEmail: 'target@demo.local',
    oldRole: null,
    newRole: 'pricing',
    changedByUid: 'uid-admin',
    changedByEmail: 'admin@demo.local',
  };
  it('admin đọc được lịch sử cấp role', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'roleAudit/entry-1'), entry);
    });
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'roleAudit/entry-1')));
  });
  it('pricing/sales/production KHÔNG đọc được', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'roleAudit/entry-2'), entry);
    });
    await assertFails(getDoc(doc(ctxFor('pricing').firestore(), 'roleAudit/entry-2')));
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'roleAudit/entry-2')));
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'roleAudit/entry-2')));
  });
  it('KHÔNG ai ghi trực tiếp được, kể cả admin (chỉ Cloud Function qua Admin SDK)', async () => {
    await assertFails(setDoc(doc(ctxFor('admin').firestore(), 'roleAudit/entry-3'), entry));
  });
});

describe('adviceAudit/{entryId} — ADR-022: dấu vết gọi AI tư vấn (chỉ Cloud Function ghi)', () => {
  const entry = { uid: 'uid-pricing', email: 'pricing@demo.local', role: 'pricing', model: 'mock' };
  it('admin/pricing đọc được dấu vết', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/adviceAudit/entry-1'), entry);
    });
    await assertSucceeds(getDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/adviceAudit/entry-1')));
    await assertSucceeds(getDoc(doc(ctxFor('pricing').firestore(), 'scenarios/scn-1/adviceAudit/entry-1')));
  });
  it('sales/production KHÔNG đọc được (tầng chiến lược ADR-006)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'scenarios/scn-1/adviceAudit/entry-2'), entry);
    });
    await assertFails(getDoc(doc(ctxFor('sales').firestore(), 'scenarios/scn-1/adviceAudit/entry-2')));
    await assertFails(getDoc(doc(ctxFor('production').firestore(), 'scenarios/scn-1/adviceAudit/entry-2')));
  });
  it('KHÔNG ai ghi trực tiếp được, kể cả admin (chỉ Cloud Function qua Admin SDK)', async () => {
    await assertFails(setDoc(doc(ctxFor('admin').firestore(), 'scenarios/scn-1/adviceAudit/entry-3'), entry));
  });
});

describe('path không khai báo — mặc định từ chối', () => {
  it('admin cũng không đọc được path lạ', async () => {
    await assertFails(getDoc(doc(ctxFor('admin').firestore(), 'someOtherCollection/doc1')));
  });
});
