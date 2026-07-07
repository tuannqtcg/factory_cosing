// Test src/engine/plan.ts (Plan_SX, T1, BUSINESS_MODEL §6) — KHÁC MỌI TEST
// KHÁC TRONG REPO: Excel gốc là template input=0, KHÔNG có "số vàng" thật.
// Các số kỳ vọng dưới đây được TÍNH TAY độc lập (script Python, xem session
// log) rồi mới viết assertion — không phải trích từ Excel. Đặt ở `parity/` vì
// vẫn đối chiếu ĐÚNG quy tắc tài liệu BUSINESS_MODEL §6, chỉ khác nguồn số.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePlan } from '../../src/engine/plan.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from '../../src/engine/fitting.js';
import { calculatePipeCvp } from '../../src/engine/cvp.js';
import { ContinuousKgResourceSchema, MachineHourResourceSchema } from '../../src/schemas/resource.js';
import type { PipeProduct, FittingProduct } from '../../src/schemas/product.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';
import type { PlanInput } from '../../src/schemas/scenario.js';

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
  },
  markup: {
    markupTcg: assumptions.markupTcg,
    listPriceMargin: assumptions.listPriceMargin,
  },
  solvent550PricePerBox: assumptions.solvent550PricePerBox,
});

const pipeProducts: PipeProduct[] = pipeFixture.priceLadderByDN.map((row: any) => ({
  kind: 'pipe' as const,
  dn: row.dn,
  spec: 'SDR 13.5',
  odMm: row.odMm,
  minWallThicknessMm: row.minWallThicknessMm,
  unitWeightKgPerM: row.unitWeightKgPerM,
  materialId: 'bm-orange-pipe',
}));

const fittingProducts: FittingProduct[] = fittingFixture.skus.map((sku: any) => ({
  kind: 'fitting' as const,
  productName: sku.productName,
  sizeLabel: sku.sizeLabel,
  unit: sku.unit,
  moldSizeDN: sku.moldSizeDN,
  cycleTimeSec: sku.cycleTimeSec,
  cavity: sku.cavity,
  unitWeightKg: sku.unitWeightKg,
  materialId: 'bm-fitting',
}));

const pipeCapacity = calculatePipeCapacity(pipeResource);
const pipeCost = calculatePipeCostAtNormalCapacity({
  resource: pipeResource,
  capacity: pipeCapacity,
  costPool,
  otherLineEstimatedProductionKgYear: fittingFixture.capacity.estimatedProductionKgYear,
  material: {
    materialId: 'bm-orange-pipe',
    pricingPriceUsdPerKg: pipeFixture.params.compoundReplacementPriceUsdPerKg,
    importTaxRate: assumptions.compoundImportTaxRate,
    customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
    markupVf: assumptions.markupVfPipe,
  },
});
const pipeCvp = calculatePipeCvp(pipeResource, pipeCapacity, pipeCost);

const fittingCapacity = calculateFittingCapacity(fittingResource, fittingProducts);
const fittingCost = calculateFittingCostAtNormalCapacity({
  resource: fittingResource,
  capacity: fittingCapacity,
  costPool,
  otherLineNormalCapacityKgYear: pipeCapacity.normalCapacityKgYear,
  material: {
    materialId: 'bm-fitting',
    pricingPriceUsdPerKg: fittingFixture.params.compoundReplacementPriceUsdPerKg,
    importTaxRate: assumptions.compoundImportTaxRate,
    customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
    markupVf: assumptions.markupVfFitting,
  },
  asOfYear: 2026,
});

const planMaterials = [
  {
    materialId: 'bm-orange-pipe',
    compoundLandedPerKgVnd: pipeCost.compoundLandedPerKg,
    replacementUsdPerKgRaw: pipeFixture.params.compoundReplacementPriceUsdPerKg,
  },
  {
    materialId: 'bm-fitting',
    compoundLandedPerKgVnd: fittingCost.compoundLandedPerKg,
    replacementUsdPerKgRaw: fittingFixture.params.compoundReplacementPriceUsdPerKg,
  },
];

function makeInput(overrides: Partial<PlanInput>): PlanInput {
  return {
    scenarioId: 's1',
    period: '2026-Q3',
    periodMonths: 3,
    currentLaborHeadcount: { pipe: 4, fitting: 1 },
    pipePlan: [],
    fittingPlan: [],
    materialSafetyStockFactor: 0.05,
    ...overrides,
  };
}

describe('Plan_SX — kịch bản A: kế hoạch vừa công suất (1 ca đủ cho Phụ kiện, 2 ca cho Ống)', () => {
  const input = makeInput({
    pipePlan: [{ dn: 'DN50', meters: 50000 }],
    fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 20000 }],
  });

  const result = calculatePlan(
    input,
    { resource: pipeResource, products: pipeProducts, cost: pipeCost, cvp: pipeCvp },
    { resource: fittingResource, products: fittingProducts, moldSetCountBySizeDN: { 20: 1 } },
    planMaterials,
  );

  it('Ống cần đúng 2 ca (500 giờ máy > 410 giờ khả dụng 1 ca, ≤ 820 giờ khả dụng 2 ca)', () => {
    expect(result.shiftsNeeded.pipe).toBe(2);
  });

  it('Phụ kiện chỉ cần 1 ca (54 giờ máy « 492 giờ khả dụng 1 ca)', () => {
    expect(result.shiftsNeeded.fitting).toBe(1);
  });

  it('không cảnh báo thiếu khuôn (54 giờ « 738 giờ khả dụng/bộ khuôn)', () => {
    expect(result.moldConstraintWarnings).toHaveLength(0);
  });

  it('nguyên liệu Ống (bm-orange-pipe): kgToBuy=73.500, vndValue và usdValueAtRawReplacement khớp tính tay', () => {
    const pipeReq = result.materialRequirement.find((r) => r.materialId === 'bm-orange-pipe')!;
    expect(pipeReq.kgToBuy).toBeCloseTo(73500, 6);
    expect(pipeReq.vndValue).toBeCloseTo(73500 * pipeCost.compoundLandedPerKg, 3);
    expect(pipeReq.usdValueAtRawReplacement).toBeCloseTo(222705, 3);
  });

  it('nhân công Ống: cần 2 ca × 2 người = 4, đã có 4 → không cần tuyển thêm', () => {
    expect(result.laborToHire.pipe).toBe(0);
  });

  it('chi phí/kg thực tế Ống dương (đang gánh công suất nhàn rỗi) — khớp tính tay 8.256,97 (ADR-011, v3.7)', () => {
    expect(result.idleCapacityCostPipePerKg).toBeCloseTo(8256.973132775121, 3);
  });
});

describe('Plan_SX — kịch bản B: kế hoạch Phụ kiện VƯỢT công suất (thiếu ca + thiếu khuôn)', () => {
  const input = makeInput({
    fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 1_000_000 }],
  });

  const result = calculatePlan(
    input,
    { resource: pipeResource, products: pipeProducts, cost: pipeCost, cvp: pipeCvp },
    { resource: fittingResource, products: fittingProducts, moldSetCountBySizeDN: { 20: 1 } },
    planMaterials,
  );

  it('thiếu cả 3 ca → insufficient, cần thêm đúng 1 máy (2700,6 giờ cần, 1476 giờ khả dụng 3 ca)', () => {
    expect(result.shiftsNeeded.fitting).toEqual({ status: 'insufficient', extraMachinesNeeded: 1 });
  });

  it('cảnh báo thiếu khuôn size DN20, cần thêm đúng 3 bộ', () => {
    expect(result.moldConstraintWarnings).toHaveLength(1);
    expect(result.moldConstraintWarnings[0]).toMatchObject({ sizeDN: 20, extraMoldSetsNeeded: 3 });
  });

  it('Ống không có kế hoạch → idleCapacityCostPipePerKg = null (tránh chia 0)', () => {
    expect(result.idleCapacityCostPipePerKg).toBeNull();
  });
});
