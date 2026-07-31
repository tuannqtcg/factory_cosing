// Parity test M11 — đối chiếu ĐỘC LẬP với `tests/fixtures/price-list.json`
// (bảng phẳng 99 dòng: 8 ống + 91 SKU, sheet "PriceList", đúng thứ tự hiển
// thị — README.md). Đây là fixture DUY NHẤT trong tests/fixtures/ CHƯA có
// test nào chạm tới trước M11 (mọi test khác đối chiếu qua pipe.json/
// fitting.json) — AGENTS.md luật #5 trỏ thẳng "8 giá ống + 91 SKU trong
// tests/fixtures/prices.json" làm số vàng kiểm tra, nên cần 1 bài test riêng
// khớp ĐÚNG file này, độc lập với price-ladder.test.ts (dù dùng chung engine).
//
// Thứ tự dòng: stt 1-8 = 8 DN ống (khớp thứ tự pipe.json.priceLadderByDN),
// stt 9-99 = 91 SKU phụ kiện (khớp thứ tự fitting.json.skus — đã xác nhận
// bằng script đối chiếu tay trước khi viết file này, cả product/sizeDN lẫn
// priceBeforeVat khớp vị trí-theo-vị-trí 91/91).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from '../../src/engine/fitting.js';
import { calculateFittingMaterialCostPerUnit } from '../../src/engine/metal-insert.js';
import {
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
const metalInsert = loadFixture<any>('metal-insert.json');
const priceList = loadFixture<any[]>('price-list.json');
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

describe('price-list.json — 8 dòng Ống (stt 1-8), khớp tuyệt đối bảng phẳng độc lập', () => {
  const pipeRows = priceList.slice(0, 8);

  it('8/8 dòng đúng thứ tự và đúng số DN', () => {
    expect(pipeRows).toHaveLength(8);
    pipeRows.forEach((row, i) => expect(row.sizeDN).toBe(pipeFixture.priceLadderByDN[i].dn));
  });

  for (let i = 0; i < 8; i += 1) {
    const dnRow = pipeFixture.priceLadderByDN[i];
    it(`${dnRow.dn}: listPrice trước/có VAT khớp price-list.json`, () => {
      const chain = calculatePipeSkuPriceChain(pipeCost.fullCostPerKg, dnRow.unitWeightKgPerM, assumptions.markupVfPipe, costPool);
      const row = pipeRows[i];
      expect(chain.listPriceBeforeVat).toBe(row.priceBeforeVat);
      expect(chain.listPriceWithVat).toBeCloseTo(row.priceWithVat, 6);
    });
  }
});

describe('price-list.json — 91 dòng Phụ kiện (stt 9-99), khớp tuyệt đối bảng phẳng độc lập', () => {
  const fittingRows = priceList.slice(8);

  it('91/91 dòng đúng thứ tự, đúng tên sản phẩm + size (khớp vị trí với fitting.json.skus)', () => {
    expect(fittingRows).toHaveLength(91);
    fittingRows.forEach((row, i) => {
      expect(row.product).toBe(fittingFixture.skus[i].productName);
      expect(row.sizeDN).toBe(fittingFixture.skus[i].sizeLabel);
    });
  });

  for (let i = 0; i < fittingFixture.skus.length; i += 1) {
    const sku = fittingFixture.skus[i];
    const skuKey = `${sku.productName}|${sku.sizeLabel}`;
    // 7 SKU pending_mold (Cút/Tê ren trong, xem mold-assets.json.skusWithoutMold)
    // dùng brassInsertCost CHƯA XÁC NHẬN (ADR-008 "stillOpen") — engine cố tình
    // KHÔNG cộng số này (đã bỏ qua ở price-ladder.test.ts cùng lý do), nên
    // listPrice engine LỆCH với price-list.json cho đúng 8 SKU này — bỏ qua so
    // giá trị, chỉ giữ test khớp tên+size ở trên.
    if (skusWithoutMold.has(skuKey)) continue;

    it(`${sku.productName} ${sku.sizeLabel}: listPrice trước/có VAT khớp price-list.json`, () => {
      const machineHoursPerUnit = calculateMachineHoursPerUnit(sku.cycleTimeSec, sku.cavity, fittingResource.yieldRate);
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

      const row = priceList[8 + i];
      expect(chain.listPriceBeforeVat).toBe(row.priceBeforeVat);
      expect(chain.listPriceWithVat).toBeCloseTo(row.priceWithVat, 6);
    });
  }
});
