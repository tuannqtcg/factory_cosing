// "Nối dây" M5 (xem docs/PHASE3_PLAN.md): compoundPricingPriceUsdPerKg ở
// pipe.ts/fitting.ts KHÔNG đổi signature — chỉ thay NGUỒN giá trị đầu vào ở
// tầng gọi (orchestration) bằng evaluatePriceLock(...).pricingPrice. Test này
// chứng minh toàn chuỗi khóa giá → giá thành khớp đúng cả 5 kịch bản ADR-004
// (price-lock-scenarios.json), không chỉ mỗi evaluatePriceLock() đơn lẻ.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePriceLock } from '../../src/engine/price-lock.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import type { ContinuousKgResource } from '../../src/schemas/resource.js';
import type { CostPool } from '../../src/schemas/cost-pool.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const assumptions = loadFixture<any>('assumptions.json');
const lockScenarios = loadFixture<any>('price-lock-scenarios.json');

const resource: ContinuousKgResource = {
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
};

const costPool: CostPool = {
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
};

describe('Nối dây price-lock → pipe.ts — 5 kịch bản ADR-004 khớp breakEvenFullCost', () => {
  const capacity = calculatePipeCapacity(resource);

  for (const scenario of lockScenarios.scenarios) {
    it(`kịch bản ${scenario.id}: ${scenario.label} → fullCostPerKg = ${scenario.expectedBreakEvenFullCostPerKg}`, () => {
      const lockEvaluation = evaluatePriceLock({
        baseline: lockScenarios.baselineUsd,
        thresholdPct: lockScenarios.thresholdPct,
        replacement: scenario.replacementUsd,
        lastLotPrice: scenario.lastLotPriceUsd ?? null,
      });

      const cost = calculatePipeCostAtNormalCapacity({
        resource,
        capacity,
        costPool,
        otherLineEstimatedProductionKgYear: fittingFixture.capacity.estimatedProductionKgYear,
        compoundPricingPriceUsdPerKg: lockEvaluation.pricingPrice,
      });

      // Kịch bản 5 không có expectedBreakEvenFullCostPerKg riêng trong fixture
      // (trọng tâm là staleness warning) — vì KHÓA với cùng pricingPrice=baseline
      // như kịch bản 1, BE phải khớp đúng số của kịch bản 1.
      const expectedFullCost =
        scenario.expectedBreakEvenFullCostPerKg ??
        lockScenarios.scenarios.find((s: any) => s.id === 1).expectedBreakEvenFullCostPerKg;

      // Tolerance ±0,5đ trước làm tròn (skill excel-parity-testing).
      expect(cost.fullCostPerKg).toBeCloseTo(expectedFullCost, 0);
    });
  }
});
