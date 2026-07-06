// Parity test — skill excel-parity-testing: đối chiếu src/engine/fitting.ts với
// số vàng trong tests/fixtures/fitting.json (trích trực tiếp từ Excel v3.4).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from '../../src/engine/fitting.js';
import { calculatePipeCapacity } from '../../src/engine/pipe.js';
import { MachineHourResourceSchema, ContinuousKgResourceSchema } from '../../src/schemas/resource.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const fittingFixture = loadFixture<any>('fitting.json');
const pipeFixture = loadFixture<any>('pipe.json');
const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
const assumptions = loadFixture<any>('assumptions.json');

const resource = MachineHourResourceSchema.parse({
  driverType: 'machine_hour',
  machineTypes: [
    { id: 'A', priceVnd: fittingFixture.params.machineTypeAPrice, count: fittingFixture.params.machineTypeACount },
    { id: 'B', priceVnd: fittingFixture.params.machineTypeBPrice, count: fittingFixture.params.machineTypeBCount },
  ],
  moldAssets,
  continuousRunDaysPerBatch: fittingFixture.params.continuousRunDaysPerBatch,
  maintenanceDaysPerBatch: fittingFixture.params.maintenanceDaysPerBatch,
  operatingDaysPerYear: fittingFixture.params.operatingDaysPerYear,
  hoursPerShift: fittingFixture.params.hoursPerShift,
  normalShifts: fittingFixture.params.normalShifts,
  normalUtilizationFactor: fittingFixture.params.normalUtilizationFactor,
  yieldRate: fittingFixture.params.yieldRate,
  packagingCostPerKg: fittingFixture.params.packagingCostPerKg,
  avgProductivityKgPerMachineHour: fittingFixture.params.avgProductivityKgPerMachineHour,
  depreciationYears: fittingFixture.params.depreciationYears,
  annualMoldMaintenance: fittingFixture.params.annualMoldMaintenance,
  peoplePerShift: fittingFixture.params.peoplePerShift,
  avgSalaryMonthly: fittingFixture.params.avgSalaryMonthly,
  monthsSalaryPerYear: fittingFixture.params.monthsSalaryPerYear,
  electricityKwPerMachineHour: fittingFixture.params.electricityKwPerMachineHour,
  electricityPricePerKwh: fittingFixture.params.electricityPricePerKwh,
  waterM3PerMachineHour: fittingFixture.params.waterM3PerMachineHour,
  waterPricePerM3: fittingFixture.params.waterPricePerM3,
});

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

describe('fitting.ts — parity với tests/fixtures/fitting.json', () => {
  const capacity = calculateFittingCapacity(resource);

  it('§3.2 công suất ép phun — khớp tuyệt đối fitting.json.capacity', () => {
    expect(capacity.batchesPerYear).toBeCloseTo(fittingFixture.capacity.batchesPerYear, 6);
    expect(capacity.totalMachines).toBe(fittingFixture.capacity.totalMachines);
    expect(capacity.designMachineHours3Shift).toBeCloseTo(fittingFixture.capacity.designMachineHours3Shift, 6);
    expect(capacity.normalMachineHoursUtilized).toBeCloseTo(fittingFixture.capacity.normalMachineHoursUtilized, 6);
    expect(capacity.estimatedProductionKgYear).toBeCloseTo(fittingFixture.capacity.estimatedProductionKgYear, 6);
  });

  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const cost = calculateFittingCostAtNormalCapacity({
    resource,
    capacity,
    costPool,
    otherLineNormalCapacityKgYear: pipeCapacity.normalCapacityKgYear,
    compoundPricingPriceUsdPerKg: fittingFixture.params.compoundReplacementPriceUsdPerKg,
    asOfYear: 2026, // toàn bộ 66 moldAsset purchaseYear=2026 (đợt mua gốc, ADR-007) — năm đầu khấu hao
  });
  const golden = fittingFixture.costAtNormalCapacity;

  it('§3.3 MHR — khớp tuyệt đối fitting.json.costAtNormalCapacity', () => {
    expect(cost.compoundLandedPerKg).toBeCloseTo(golden.compoundLandedPerKg, 6);
    expect(cost.machineDepreciationPerYear + cost.moldDepreciationPerYear).toBeCloseTo(
      golden.machineMoldDepreciationPerYear,
      3,
    );
    expect(cost.laborPerYear).toBeCloseTo(golden.laborPerYear, 6);
    expect(cost.electricityPerYear).toBeCloseTo(golden.electricityPerYear, 6);
    expect(cost.waterPerYear).toBeCloseTo(golden.waterPerYear, 6);
    expect(cost.sharedCostAllocationRatio).toBeCloseTo(golden.sharedCostAllocationRatio, 6);
    expect(cost.sharedCostAllocated).toBeCloseTo(golden.sharedCostAllocated, 3);
    expect(cost.totalProcessingCostPerYear).toBeCloseTo(golden.totalProcessingCostPerYear, 3);
  });

  it('mhrPerMachineHour khớp số vàng 1.344.175,79 (trái tim ADR-001)', () => {
    expect(cost.mhrPerMachineHour).toBeCloseTo(golden.mhrPerMachineHour, 6);
    expect(cost.mhrPerMachineHour).toBeCloseTo(1344175.79463858, 3);
  });

  it('processingCostPerKgRef/fullCostPerKgRef/vfPricePerKgRef khớp số quy-kg tham chiếu', () => {
    expect(cost.processingCostPerKgRef).toBeCloseTo(golden.processingCostPerKgRef, 6);
    expect(cost.fullCostPerKgRef).toBeCloseTo(golden.bookFullCostPerKgRef, 3);
    expect(cost.vfPricePerKgRef).toBeCloseTo(golden.vfPricePerKgRef, 3);
  });
});
