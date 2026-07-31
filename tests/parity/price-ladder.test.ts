// Parity test — skill excel-parity-testing: thang giá 5 bậc (dashboard.json)
// + chuỗi markup 99 dòng (8 ống + 91 phụ kiện). Bậc 2/4 đặc biệt quan trọng —
// xem cảnh báo đầu src/engine/price-ladder.ts (2 lỗi công thức thật ở Pha 1).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from '../../src/engine/fitting.js';
import { calculatePipeCvp, calculateFittingCvp } from '../../src/engine/cvp.js';
import { calculateFittingMaterialCostPerUnit } from '../../src/engine/metal-insert.js';
import {
  calculatePipePriceLadder5Tier,
  calculateFittingPriceLadder5Tier,
  calculatePipeSkuPriceChain,
  calculateFittingSkuPriceChain,
  calculateMachineHoursPerUnit,
} from '../../src/engine/price-ladder.js';
import { ContinuousKgResourceSchema, MachineHourResourceSchema } from '../../src/schemas/resource.js';
import { CostPoolSchema } from '../../src/schemas/cost-pool.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
const assumptions = loadFixture<any>('assumptions.json');
const dashboard = loadFixture<any>('dashboard.json');
const metalInsert = loadFixture<any>('metal-insert.json');
const skusWithoutMold: Set<string> = new Set(
  loadFixture<any>('mold-assets.json').skusWithoutMold.map((s: any) => `${s.productName}|${s.sizeLabel}`),
);

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
const fittingCvp = calculateFittingCvp(fittingResource, fittingCapacity, fittingCost);

describe('Thang giá 5 bậc — khớp tuyệt đối dashboard.json.priceLadder5Tier (bậc 2/4 tham chiếu chéo)', () => {
  const pipeOwnRevenue = pipeCapacity.normalCapacityKgYear * pipeCost.vfPricePerKg;
  const fittingOwnRevenue = fittingCapacity.estimatedProductionKgYear * fittingCost.vfPricePerKgRef;

  const pipeLadder = calculatePipePriceLadder5Tier({
    capacity: pipeCapacity,
    cost: pipeCost,
    cvp: pipeCvp,
    costPool,
    otherLineRevenueVnd: fittingOwnRevenue,
  });
  const fittingLadder = calculateFittingPriceLadder5Tier({
    capacity: fittingCapacity,
    cost: fittingCost,
    cvp: fittingCvp,
    costPool,
    otherLineRevenueVnd: pipeOwnRevenue,
  });

  const golden = dashboard.priceLadder5Tier;

  it('Ống: 5 bậc khớp tuyệt đối', () => {
    expect(pipeLadder.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.pipe, 3);
    expect(pipeLadder.cashBreakEven).toBeCloseTo(golden.tier2_cashBreakEven.pipe, 3);
    expect(pipeLadder.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.pipe, 3);
    expect(pipeLadder.enterpriseBreakEven).toBeCloseTo(golden.tier4_enterpriseBreakEven.pipe, 3);
    expect(pipeLadder.targetPrice).toBeCloseTo(golden.tier5_targetPrice.pipe, 3);
  });

  it('Phụ kiện: 5 bậc khớp tuyệt đối', () => {
    expect(fittingLadder.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.fitting, 3);
    expect(fittingLadder.cashBreakEven).toBeCloseTo(golden.tier2_cashBreakEven.fitting, 3);
    expect(fittingLadder.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.fitting, 3);
    expect(fittingLadder.enterpriseBreakEven).toBeCloseTo(golden.tier4_enterpriseBreakEven.fitting, 3);
    expect(fittingLadder.targetPrice).toBeCloseTo(golden.tier5_targetPrice.fitting, 3);
  });
});

describe('Bảng giá Ống theo DN — khớp tuyệt đối 8/8 dòng pipe.json.priceLadderByDN', () => {
  for (const row of pipeFixture.priceLadderByDN) {
    it(`${row.dn}`, () => {
      const chain = calculatePipeSkuPriceChain(pipeCost.fullCostPerKg, row.unitWeightKgPerM, assumptions.markupVfPipe, costPool);
      expect(chain.breakEvenPerUnit).toBeCloseTo(row.breakEvenPerM, 3);
      expect(chain.vfPricePerUnit).toBeCloseTo(row.vfPricePerM, 3);
      expect(chain.tcgPricePerUnit).toBeCloseTo(row.tcgPricePerM, 3);
      expect(chain.listPriceBeforeVat).toBe(row.listPriceBeforeVat);
      expect(chain.listPriceWithVat).toBeCloseTo(row.listPriceWithVat, 6);
    });
  }
});

describe('Bảng giá Phụ kiện theo SKU — khớp tuyệt đối 91/91 dòng fitting.json.skus', () => {
  for (const sku of fittingFixture.skus) {
    it(`${sku.productName} ${sku.sizeLabel}`, () => {
      const machineHoursPerUnit = calculateMachineHoursPerUnit(sku.cycleTimeSec, sku.cavity, fittingResource.yieldRate);
      expect(machineHoursPerUnit).toBeCloseTo(sku.machineHoursPerUnit, 9);

      // 11 SKU họ ren (có trong metalInsertSkus) → materialCostPerUnit PHẢI gồm
      // insert (M6); 80 SKU còn lại dùng nguyên materialCostPerUnit fixture.
      const insertSku = metalInsert.metalInsertSkus.find(
        (m: any) => m.productName === sku.productName && m.sizeLabel === sku.sizeLabel,
      );
      let materialCostPerUnit = sku.materialCostPerUnit;
      if (insertSku) {
        materialCostPerUnit = calculateFittingMaterialCostPerUnit({
          unitWeightKg: sku.unitWeightKg,
          compoundPricingPriceUsdPerKg: fittingFixture.params.compoundReplacementPriceUsdPerKg,
          yieldRate: fittingResource.yieldRate,
          packagingCostPerKg: fittingResource.packagingCostPerKg,
          insertQtyPerUnit: insertSku.insertQtyPerUnit,
          insertPricingPriceVnd: insertSku.insertPricingCostVndPerUnit,
          landedRates: {
            importTaxRate: assumptions.compoundImportTaxRate,
            customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
            usdVndRate: assumptions.usdVndRate,
          },
        });
      }

      const chain = calculateFittingSkuPriceChain(materialCostPerUnit, machineHoursPerUnit, fittingCost.mhrPerMachineHour, assumptions.markupVfFitting, costPool);

      // breakEvenPerUnit fixture = materialCostPerUnit + processingCostPerUnit + brassInsertCost (thiết kế CŨ, cộng riêng)
      // — TỔNG phải khớp dù ren được gập vào materialCostPerUnit (thiết kế MỚI, ADR-008).
      // NGOẠI LỆ: 7 SKU `pending_mold` (Cút/Tê ren trong, xem mold-assets.json.skusWithoutMold)
      // CÓ brassInsertCost trong fixture nhưng đây là số CHƯA XÁC NHẬN (ADR-008
      // "stillOpen") — engine KHÔNG được cộng, nên bỏ qua brassInsertCost khi so.
      const skuKey = `${sku.productName}|${sku.sizeLabel}`;
      const expectedBreakEven = skusWithoutMold.has(skuKey)
        ? sku.materialCostPerUnit + sku.processingCostPerUnit
        : sku.materialCostPerUnit + sku.processingCostPerUnit + sku.brassInsertCost;
      expect(chain.breakEvenPerUnit).toBeCloseTo(expectedBreakEven, 3);
      expect(chain.vfPricePerUnit).toBeCloseTo(expectedBreakEven * (1 + assumptions.markupVfFitting), 3);
      if (!skusWithoutMold.has(skuKey)) {
        // listPrice fixture (làm tròn từ breakEven CÓ brassInsertCost) chỉ còn ý
        // nghĩa đối chiếu cho SKU active — pending_mold có breakEven khác fixture
        // nên listPrice cũng khác, không so trực tiếp.
        expect(chain.listPriceBeforeVat).toBe(sku.listPriceBeforeVat);
        expect(chain.listPriceWithVat).toBeCloseTo(sku.listPriceWithVat, 6);
      }
    });
  }
});
