// Parity test — skill excel-parity-testing: đối chiếu src/engine/cvp.ts với
// tests/fixtures/{pipe,fitting}.json.cvp (số vàng Excel v3.4).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from '../../src/engine/fitting.js';
import { calculatePipeCvp, calculateFittingCvp } from '../../src/engine/cvp.js';
import { ContinuousKgResourceSchema, MachineHourResourceSchema } from '../../src/schemas/resource.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';
import { ScenarioOutputSchema } from '../../src/schemas/scenario.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
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

const fittingResource = MachineHourResourceSchema.parse({
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

describe('CVP Ống — khớp tuyệt đối pipe.json.cvp', () => {
  const capacity = calculatePipeCapacity(pipeResource);
  const cost = calculatePipeCostAtNormalCapacity({
    resource: pipeResource,
    capacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingFixture.capacity.estimatedProductionKgYear,
    compoundPricingPriceUsdPerKg: pipeFixture.params.compoundReplacementPriceUsdPerKg,
  });
  const cvp = calculatePipeCvp(pipeResource, capacity, cost);
  const golden = pipeFixture.cvp;

  it('variableCostPerKg (bậc 1 thang giá — variableCostFloor)', () => {
    expect(cvp.variableCostPerKg).toBeCloseTo(golden.variableCostPerKg, 6);
    expect(cvp.variableCostPerKg).toBeCloseTo(100663.420634921, 3);
  });

  it('contributionMarginPerKg, fixedCostPerYear, breakEvenKgYear, pctOfNormalCapacity', () => {
    expect(cvp.contributionMarginPerKg).toBeCloseTo(golden.contributionMarginPerKg, 6);
    expect(cvp.fixedCostPerYear).toBeCloseTo(golden.fixedCostPerYear, 3);
    expect(cvp.breakEvenKgYear).toBeCloseTo(golden.breakEvenKgYear, 6);
    expect(cvp.pctOfNormalCapacity).toBeCloseTo(golden.pctOfNormalCapacity, 6);
  });

  it('khớp đúng ScenarioOutputSchema.cvp.pipe', () => {
    expect(() => ScenarioOutputSchema.shape.cvp.shape.pipe.parse(cvp)).not.toThrow();
  });
});

describe('CVP Phụ kiện — khớp tuyệt đối fitting.json.cvp', () => {
  const fittingProducts = fittingFixture.skus.map((sku: any) => ({
    kind: 'fitting' as const,
    productName: sku.productName,
    sizeLabel: sku.sizeLabel,
    unit: sku.unit,
    moldSizeDN: sku.moldSizeDN,
    cycleTimeSec: sku.cycleTimeSec,
    cavity: sku.cavity,
    unitWeightKg: sku.unitWeightKg,
  }));
  const capacity = calculateFittingCapacity(fittingResource, fittingProducts);
  const cost = calculateFittingCostAtNormalCapacity({
    resource: fittingResource,
    capacity,
    costPool,
    otherLineNormalCapacityKgYear: pipeFixture.capacity.normalCapacityKgYear,
    compoundPricingPriceUsdPerKg: fittingFixture.params.compoundReplacementPriceUsdPerKg,
    asOfYear: 2026,
  });
  const cvp = calculateFittingCvp(fittingResource, capacity, cost);
  const golden = fittingFixture.cvp;

  it('variableCostPerKg (bậc 1 thang giá — variableCostFloor)', () => {
    expect(cvp.variableCostPerKg).toBeCloseTo(golden.variableCostPerKg, 6);
    expect(cvp.variableCostPerKg).toBeCloseTo(127939.81975261813, 3); // ADR-011 (v3.7)
  });

  it('contributionMarginPerKg, fixedCostPerYear, breakEvenKgYear, breakEvenMachineHours, pctOfUtilizedHours', () => {
    expect(cvp.contributionMarginPerKg).toBeCloseTo(golden.contributionMarginPerKg, 6);
    expect(cvp.fixedCostPerYear).toBeCloseTo(golden.fixedCostPerYear, 3);
    expect(cvp.breakEvenKgYear).toBeCloseTo(golden.breakEvenKgYear, 6);
    expect(cvp.breakEvenMachineHours).toBeCloseTo(golden.breakEvenMachineHours, 6);
    expect(cvp.pctOfUtilizedHours).toBeCloseTo(golden.pctOfUtilizedHours, 6);
  });

  it('khớp đúng ScenarioOutputSchema.cvp.fitting (code review PR #1: bắt lỗi lệch tên field pctUtilized/pctOfUtilizedHours)', () => {
    expect(() => ScenarioOutputSchema.shape.cvp.shape.fitting.parse(cvp)).not.toThrow();
  });
});
