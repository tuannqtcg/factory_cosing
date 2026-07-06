// Parity test — skill excel-parity-testing: đối chiếu src/engine/pipe.ts với
// số vàng trong tests/fixtures/pipe.json (trích trực tiếp từ Excel v3.4).
// Tolerance ±0,5đ trước làm tròn (skill mục "Cách viết test" #2).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { ContinuousKgResourceSchema } from '../../src/schemas/resource.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const assumptions = loadFixture<any>('assumptions.json');

const resource = ContinuousKgResourceSchema.parse({
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

describe('pipe.ts — parity với tests/fixtures/pipe.json', () => {
  const capacity = calculatePipeCapacity(resource);

  it('§2.1 công suất — khớp tuyệt đối pipe.json.capacity', () => {
    expect(capacity.batchesPerYear).toBeCloseTo(pipeFixture.capacity.batchesPerYear, 6);
    expect(capacity.designHours3ShiftHours).toBeCloseTo(pipeFixture.capacity.designHours3Shift, 6);
    expect(capacity.designCapacity3ShiftKgYear).toBeCloseTo(pipeFixture.capacity.designCapacity3ShiftKgYear, 6);
    expect(capacity.normalOperatingHours).toBeCloseTo(pipeFixture.capacity.normalOperatingHours, 6);
    expect(capacity.normalCapacityKgYear).toBeCloseTo(pipeFixture.capacity.normalCapacityKgYear, 6);
  });

  const cost = calculatePipeCostAtNormalCapacity({
    resource,
    capacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingFixture.capacity.estimatedProductionKgYear,
    compoundPricingPriceUsdPerKg: pipeFixture.params.compoundReplacementPriceUsdPerKg,
  });
  const golden = pipeFixture.costAtNormalCapacity;

  it('§2.2 chi phí sản xuất — khớp tuyệt đối pipe.json.costAtNormalCapacity', () => {
    expect(cost.compoundLandedPerKg).toBeCloseTo(golden.compoundLandedPerKg, 6);
    expect(cost.materialPerKgFinished).toBeCloseTo(golden.materialPerKgFinished, 6);
    expect(cost.extruderDepreciationPerYear).toBeCloseTo(golden.extruderDepreciationPerYear, 6);
    expect(cost.maintenancePerYear).toBeCloseTo(golden.maintenancePerYear, 6);
    expect(cost.laborPerYear).toBeCloseTo(golden.laborPerYear, 6);
    expect(cost.electricityPerYear).toBeCloseTo(golden.electricityPerYear, 6);
    expect(cost.waterPerYear).toBeCloseTo(golden.waterPerYear, 6);
    expect(cost.sharedCostAllocationRatio).toBeCloseTo(golden.sharedCostAllocationRatio, 6);
    expect(cost.sharedCostAllocated).toBeCloseTo(golden.sharedCostAllocated, 3);
    expect(cost.totalProcessingCostPerYear).toBeCloseTo(golden.totalProcessingCostPerYear, 3);
    expect(cost.unitProcessingCostPerKg).toBeCloseTo(golden.unitProcessingCostPerKg, 6);
  });

  it('fullCostPerKg (bậc 3 thang giá — breakEvenFullCost) khớp số vàng 106.204,73', () => {
    expect(cost.fullCostPerKg).toBeCloseTo(golden.fullCostPerKg, 6);
    expect(cost.fullCostPerKg).toBeCloseTo(106204.729733113, 3);
  });

  it('vfPricePerKg (bậc 5 thang giá — targetPrice) khớp số vàng 132.755,91', () => {
    expect(cost.vfPricePerKg).toBeCloseTo(golden.vfPricePerKg, 6);
    expect(cost.vfPricePerKg).toBeCloseTo(132755.912166391, 3);
  });
});
