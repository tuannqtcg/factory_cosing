// Parity test M10 — src/engine/solver.ts trên forward function THẬT (pipe.ts +
// cvp.ts + price-ladder.ts), khớp skill `inverse-solver` mục "Test bắt buộc":
// (1) round-trip |forward(solve(t)) − t| < tol trên fixture v3.4; (2) case
// chuẩn T3 "giá niêm yết DN50 mục tiêu 260.000đ/m — huy động phụ kiện không
// đổi, hỏi giá compound tối đa được phép" (docs/PHASE3_PLAN.md, mục việc tiếp
// theo M10); (3) case infeasible (mục tiêu dưới sàn biến phí bậc 1) → infeasible
// kèm lý do, KHÔNG trả số bừa. T2 (solveTargetProfit, dạng đóng) đối chiếu
// tuyệt đối `pipe.json.cvp.breakEvenKgYear` khi targetProfitVnd=0 (Q hòa vốn
// KHÔNG lợi nhuận CHÍNH LÀ breakEvenKgYear của CVP — cùng công thức).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { calculatePipeSkuPriceChain } from '../../src/engine/price-ladder.js';
import { solve, solveTargetProfit } from '../../src/engine/solver.js';
import { ContinuousKgResourceSchema } from '../../src/schemas/resource.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const assumptions = loadFixture<any>('assumptions.json');

const pipeResource = ContinuousKgResourceSchema.parse({
  driverType: 'continuous_kg',
  maxCapacityKgPerHour: pipeFixture.params.extruderMaxCapacityKgPerHour,
  actualCapacityKgPerHour: pipeFixture.params.extruderActualCapacityKgPerHour,
  continuousRunDaysPerBatch: pipeFixture.params.continuousRunDaysPerBatch,
  maintenanceDaysPerBatch: pipeFixture.params.maintenanceDaysPerBatch,
  operatingDaysPerYear: pipeFixture.params.operatingDaysPerYear,
  hoursPerShift: pipeFixture.params.hoursPerShift,
  normalShifts: pipeFixture.params.normalShifts,
  yieldRate: pipeFixture.params.yieldRate,
  packagingCostPerKg: pipeFixture.params.packagingCostPerKg,
  extruderPriceEach: pipeFixture.params.extruderPriceEach,
  extruderCount: pipeFixture.params.extruderCount,
  moldPullerCutterCost: pipeFixture.params.moldPullerCutterCost,
  depreciationYears: pipeFixture.params.depreciationYears,
  annualMaintenance: pipeFixture.params.annualMaintenance,
  peoplePerShift: pipeFixture.params.peoplePerShift,
  avgSalaryMonthly: pipeFixture.params.avgSalaryMonthly,
  monthsSalaryPerYear: pipeFixture.params.monthsSalaryPerYear,
  electricityKw: pipeFixture.params.electricityKw,
  electricityPricePerKwh: pipeFixture.params.electricityPricePerKwh,
  waterM3PerHour: pipeFixture.params.waterM3PerHour,
  waterPricePerM3: pipeFixture.params.waterPricePerM3,
});

const costPool = CostPoolSchema.parse({
  sharedFixedCosts: assumptions.sharedFixedCosts,
  nonProductionCosts: assumptions.nonProductionCosts,
  currency: {
    usdVndRate: assumptions.usdVndRate,
    vatOutputRate: assumptions.vatOutputRate,
    mandatoryInsuranceRate: assumptions.mandatoryInsuranceRate,
    compoundImportTaxRate: assumptions.compoundImportTaxRate,
    customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
  },
  markup: {
    markupVfPipe: assumptions.markupVfPipe,
    markupVfFitting: assumptions.markupVfFitting,
    markupTcg: assumptions.markupTcg,
    listPriceMargin: assumptions.listPriceMargin,
  },
  solvent550PricePerBox: assumptions.solvent550PricePerBox,
});

const capacity = calculatePipeCapacity(pipeResource);
const DN50_UNIT_WEIGHT_KG_PER_M = 1.26; // tests/fixtures/pipe.json.priceLadderByDN (dn: 'DN50')

/** forwardFn dùng chung 2 test dưới — Phụ kiện KHÔNG đổi (đúng case chuẩn T3: "huy động phụ kiện không đổi"). */
function forwardPipeAtCompoundPrice(input: { compoundPricingPriceUsdPerKg: number }) {
  const cost = calculatePipeCostAtNormalCapacity({
    resource: pipeResource,
    capacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingFixture.capacity.estimatedProductionKgYear,
    compoundPricingPriceUsdPerKg: input.compoundPricingPriceUsdPerKg,
  });
  const dn50Chain = calculatePipeSkuPriceChain(cost.fullCostPerKg, DN50_UNIT_WEIGHT_KG_PER_M, costPool);
  return { fullCostPerKg: cost.fullCostPerKg, dn50Chain };
}

describe('solve() round-trip trên forward function thật (pipe.ts) — fixture v3.4', () => {
  it('|forward(solve(target)) − target| < tol, hội tụ về đúng compoundReplacementPriceUsdPerKg gốc', () => {
    const target = pipeFixture.costAtNormalCapacity.fullCostPerKg; // 106318.88168476634 (ADR-011, v3.7)
    const result = solve({
      baseInput: { compoundPricingPriceUsdPerKg: 0 }, // cố tình bắt đầu XA giá gốc để chứng minh hội tụ
      forwardFn: forwardPipeAtCompoundPrice,
      freeVarPath: 'compoundPricingPriceUsdPerKg',
      targetSelector: (o) => o.fullCostPerKg,
      target,
      bounds: [0, 10],
      tol: 1e-6,
    });

    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    expect(result.value).toBeCloseTo(pipeFixture.params.compoundReplacementPriceUsdPerKg, 4);
    expect(Math.abs(result.residual)).toBeLessThan(1e-6);
    expect(result.forwardOutput.fullCostPerKg).toBeCloseTo(target, 5);
  });
});

describe('T3 — case chuẩn skill inverse-solver: DN50 mục tiêu 260.000đ/m, hỏi giá compound tối đa', () => {
  it('solve() tìm đúng giá compound để listPriceBeforeVat(DN50) = 260.000, forward-verify khớp tuyệt đối', () => {
    const result = solve({
      baseInput: { compoundPricingPriceUsdPerKg: pipeFixture.params.compoundReplacementPriceUsdPerKg },
      forwardFn: forwardPipeAtCompoundPrice,
      freeVarPath: 'compoundPricingPriceUsdPerKg',
      targetSelector: (o) => o.dn50Chain.listPriceBeforeVat,
      target: 260000,
      bounds: [0, 5],
      tol: 1,
    });

    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    // Forward-verify (luật #4 skill): nghiệm phải tái tạo ĐÚNG mục tiêu qua forward, không chỉ gần đúng.
    expect(result.forwardOutput.dn50Chain.listPriceBeforeVat).toBe(260000);
    // Giá compound tối đa được phép phải THẤP hơn giá hiện tại (3.03 USD/kg) vì mục tiêu 260.000 < giá niêm yết hiện tại 311.000 (ADR-011, v3.7).
    expect(result.value).toBeLessThan(pipeFixture.params.compoundReplacementPriceUsdPerKg);
    expect(result.value).toBeGreaterThan(0);
  });

  it('infeasible: mục tiêu dưới sàn biến phí (thủng bậc 1 thang giá) → trả infeasible kèm achievableRange, không trả số bừa', () => {
    const result = solve({
      baseInput: { compoundPricingPriceUsdPerKg: pipeFixture.params.compoundReplacementPriceUsdPerKg },
      forwardFn: forwardPipeAtCompoundPrice,
      freeVarPath: 'compoundPricingPriceUsdPerKg',
      targetSelector: (o) => o.dn50Chain.listPriceBeforeVat,
      target: 10000, // dưới cả listPriceBeforeVat khi giá compound = 0 (~31.500)
      bounds: [0, 5],
      tol: 1,
    });

    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error('unreachable');
    expect(result.achievableRange[0]).toBeGreaterThan(10000);
    expect(result.reason).toMatch(/không khả thi/);
  });
});

describe('T2 — solveTargetProfit (dạng đóng, tái dùng cvp.ts) — khớp pipe.json.cvp', () => {
  const golden = pipeFixture.cvp;

  it('targetProfitVnd=0 → Q hòa vốn CHÍNH LÀ breakEvenKgYear của CVP (cùng công thức)', () => {
    const outcome = solveTargetProfit({
      targetProfitVnd: 0,
      fixedCostPerYear: golden.fixedCostPerYear,
      contributionMarginPerKg: golden.contributionMarginPerKg,
      normalCapacityKgYearAtNormalShifts: pipeFixture.capacity.normalCapacityKgYear,
      normalShifts: pipeFixture.params.normalShifts,
    });

    expect(outcome.requiredQtyKgOrMachineHours).toBeCloseTo(golden.breakEvenKgYear, 6);
    expect(outcome.feasibleWithinNormalCapacity).toBe(true);
  });

  it('mục tiêu lợi nhuận vượt xa công suất 3 ca → feasibleWithinNormalCapacity=false', () => {
    const outcome = solveTargetProfit({
      targetProfitVnd: golden.fixedCostPerYear * 50,
      fixedCostPerYear: golden.fixedCostPerYear,
      contributionMarginPerKg: golden.contributionMarginPerKg,
      normalCapacityKgYearAtNormalShifts: pipeFixture.capacity.normalCapacityKgYear,
      normalShifts: pipeFixture.params.normalShifts,
    });

    expect(outcome.feasibleWithinNormalCapacity).toBe(false);
    expect(outcome.requiredShifts).toBeGreaterThan(3);
  });
});
