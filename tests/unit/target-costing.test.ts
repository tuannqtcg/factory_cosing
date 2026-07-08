// M12.4c — test src/engine/target-costing.ts (T2/T3, ADR-013). Số vàng: T2
// đối chiếu cvp trong pipe.json/fitting.json (v3.7 — targetProfit=0 → Q hòa
// vốn CHÍNH LÀ breakEvenKgYear, cùng công thức, xem tests/parity/solver.test.ts);
// T3 là case chuẩn skill inverse-solver "DN50 mục tiêu 260.000đ/m" chạy trên
// calculateScenario() THẬT (M10 mới chạy trên pipe.ts trực tiếp — đây là lần
// đầu solver chạy trên forward function đầy đủ của app, đúng khoảng trống #2
// ADR-010 đã nêu).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeTargetProfitForScenario,
  computeTargetPriceForScenario,
  TARGET_PRICE_FREE_VARS,
} from '../../src/engine/target-costing.js';
import { calculateScenario } from '../../src/engine/scenario.js';
import { ScenarioInputSchema, TargetProfitRequestSchema, TargetPriceRequestSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const pipeGoldenCvp = loadFixture<any>('pipe.json').cvp;
const fittingGoldenCvp = loadFixture<any>('fitting.json').cvp;

describe('T2 — computeTargetProfitForScenario (dạng đóng, CVP theo line+material ADR-012)', () => {
  it('Ống, targetProfit=0, materialId bỏ trống → Q = breakEvenKgYear vàng v3.7 (material tham chiếu bm-orange-pipe)', () => {
    const result = computeTargetProfitForScenario(
      baseline,
      TargetProfitRequestSchema.parse({ scenarioId: 'baseline-v3.4', productLine: 'pipe', targetProfitVnd: 0 }),
    );
    expect(result.requiredQtyKgOrMachineHours).toBeCloseTo(pipeGoldenCvp.breakEvenKgYear, 6);
    expect(result.feasibleWithinNormalCapacity).toBe(true);
  });

  it('Phụ kiện, targetProfit=0 → Q = breakEvenKgYear vàng v3.7 (18.941,97 kg)', () => {
    const result = computeTargetProfitForScenario(
      baseline,
      TargetProfitRequestSchema.parse({ scenarioId: 'baseline-v3.4', productLine: 'fitting', targetProfitVnd: 0 }),
    );
    expect(result.requiredQtyKgOrMachineHours).toBeCloseTo(fittingGoldenCvp.breakEvenKgYear, 6);
  });

  it('multi-material (ADR-013 mục 2): materialId=corzan-fitting cho CVP KHÁC bm-fitting (giá compound khác)', () => {
    const corzanScenario = ScenarioInputSchema.parse(buildCorzanScenarioInput());
    const request = { scenarioId: 'baseline-v3.4-corzan', productLine: 'fitting' as const, targetProfitVnd: 0 };
    const bm = computeTargetProfitForScenario(corzanScenario, TargetProfitRequestSchema.parse(request));
    const corzan = computeTargetProfitForScenario(
      corzanScenario,
      TargetProfitRequestSchema.parse({ ...request, materialId: 'corzan-fitting' }),
    );
    // materialId bỏ trống = material tham chiếu (BlazeMaster đứng đầu materials[]) — khớp số vàng
    expect(bm.requiredQtyKgOrMachineHours).toBeCloseTo(fittingGoldenCvp.breakEvenKgYear, 6);
    expect(corzan.requiredQtyKgOrMachineHours).toBeGreaterThan(0);
    expect(corzan.requiredQtyKgOrMachineHours).not.toBeCloseTo(bm.requiredQtyKgOrMachineHours, 3);
  });

  it('materialId không được SP nào của line dùng → ném lỗi rõ ràng', () => {
    expect(() =>
      computeTargetProfitForScenario(
        baseline,
        TargetProfitRequestSchema.parse({
          scenarioId: 'baseline-v3.4',
          productLine: 'pipe',
          targetProfitVnd: 0,
          materialId: 'bm-fitting', // material của Phụ kiện, không SP Ống nào dùng
        }),
      ),
    ).toThrow(/Không có CVP/);
  });
});

describe('T3 — computeTargetPriceForScenario (bisection trên calculateScenario thật)', () => {
  const dn50Request = TargetPriceRequestSchema.parse({
    scenarioId: 'baseline-v3.4',
    productLine: 'pipe',
    targetListPriceVnd: 260_000,
    freeVarPath: 'materials.0.inventory.replacementPriceUsdPerKg', // materials[0] = bm-orange-pipe
    isPenetrationPrice: false,
    productKey: { dn: 'DN50' },
  });

  it('case chuẩn skill: DN50 mục tiêu 260.000đ/m → feasible, forward-verify listPriceBeforeVat = 260.000 (luật #4)', () => {
    const result = computeTargetPriceForScenario(baseline, dn50Request);
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    // Giá compound tối đa phải THẤP hơn hiện tại (3,03) — mục tiêu 260.000 < giá niêm yết hiện tại 311.000 (v3.7)
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBeLessThan(3.03);
    const dn50 = result.forwardOutput.skuPriceChains.find(
      (sku) => sku.productKey.dn === 'DN50' && sku.productKey.materialId === 'bm-orange-pipe',
    );
    expect(dn50?.chain.listPriceBeforeVat).toBe(260_000);
  });

  it('round-trip: chạy lại calculateScenario với nghiệm đã set vào đúng path → tái tạo đúng mục tiêu', () => {
    const result = computeTargetPriceForScenario(baseline, dn50Request);
    if (!result.feasible) throw new Error('unreachable');
    const verifyInput = JSON.parse(JSON.stringify(baseline));
    verifyInput.materials[0].inventory.replacementPriceUsdPerKg = result.value;
    const verifyOutput = calculateScenario(ScenarioInputSchema.parse(verifyInput));
    const dn50 = verifyOutput.skuPriceChains.find((sku) => sku.productKey.dn === 'DN50');
    expect(dn50?.chain.listPriceBeforeVat).toBe(260_000);
  });

  it('infeasible: mục tiêu dưới sàn (10.000đ/m) → feasible=false kèm achievableRange, không trả số bừa', () => {
    const result = computeTargetPriceForScenario(baseline, { ...dn50Request, targetListPriceVnd: 10_000 });
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error('unreachable');
    expect(result.achievableRange[0]).toBeGreaterThan(10_000);
    expect(result.reason).toMatch(/không khả thi/);
  });

  it('SKU Phụ kiện: Tê đều 20 goal-seek normalUtilizationFactor — feasible, forward-verify khớp mục tiêu đạt được', () => {
    // Mục tiêu = chính giá hiện tại (26.900 v3.7) để chắc chắn nằm trong khoảng đạt được của biến huy động.
    const result = computeTargetPriceForScenario(
      baseline,
      TargetPriceRequestSchema.parse({
        scenarioId: 'baseline-v3.4',
        productLine: 'fitting',
        targetListPriceVnd: 26_900,
        freeVarPath: 'resources.fitting.normalUtilizationFactor',
        isPenetrationPrice: false,
        productKey: { productName: 'Tê đều', sizeLabel: '20' },
      }),
    );
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    const sku = result.forwardOutput.skuPriceChains.find(
      (s) => s.productKey.productName === 'Tê đều' && s.productKey.sizeLabel === '20',
    );
    expect(sku?.chain.listPriceBeforeVat).toBe(26_900);
  });

  it('freeVarPath ngoài allowlist (ADR-013 mục 3) → ném lỗi, KHÔNG goal-seek field tùy tiện', () => {
    expect(() =>
      computeTargetPriceForScenario(baseline, { ...dn50Request, freeVarPath: 'costPool.currency.usdVndRate' }),
    ).toThrow(/allowlist/);
    // sanity: allowlist có đúng 5 pattern v1 (biến liên tục skill mục 5)
    expect(TARGET_PRICE_FREE_VARS).toHaveLength(5);
  });

  it('productKey không khớp SKU nào / thiếu khóa theo line → ném lỗi request thay vì chạy solver', () => {
    expect(() =>
      computeTargetPriceForScenario(baseline, { ...dn50Request, productKey: { dn: 'DN999' } }),
    ).toThrow(/Không tìm thấy SKU/);
    expect(() =>
      computeTargetPriceForScenario(baseline, { ...dn50Request, productKey: { productName: 'Tê đều' } }),
    ).toThrow(/cần productKey\.dn/);
  });
});
