// Parity test M12.1 — src/engine/scenario.ts: `calculateScenario()` nối TOÀN
// BỘ engine (M2-M9) qua 1 cửa ngõ duy nhất đúng contract ScenarioInput/Output
// (scenario.md §1-2). Test này KHÔNG lặp lại từng công thức con (đã có
// parity test riêng M2-M9) — chỉ xác nhận: (1) wiring đúng thứ tự phụ thuộc
// chéo 2 dòng SP tái tạo đúng số vàng đã biết, (2) output khớp
// ScenarioOutputSchema, (3) bookCostPerKg (ADR-002, chưa có số vàng Excel
// riêng cho trường hợp AVG≠pricingPrice) tự-đối-chiếu đúng fullCostPerKg khi
// weightedAvg trùng pricingPrice (kịch bản mặc định, chưa có biến động kho).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateScenario } from '../../src/engine/scenario.js';
import { ScenarioInputSchema, ScenarioOutputSchema } from '../../src/schemas/scenario.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const assumptions = loadFixture<any>('assumptions.json');
const moldAssetsFixture = loadFixture<any>('mold-assets.json');
const metalInsert = loadFixture<any>('metal-insert.json');
const priceList = loadFixture<any[]>('price-list.json');

const insertBySkuKey = new Map<string, any>(
  metalInsert.skuToInsertMap.map((m: any) => [`${m.productName}|${m.sizeLabel}`, m]),
);
const insertQtyBySkuKey = new Map<string, number>(
  metalInsert.metalInsertSkus.map((m: any) => [`${m.productName}|${m.sizeLabel}`, m.insertQtyPerUnit]),
);
const skusWithoutMold = new Set(
  moldAssetsFixture.skusWithoutMold.map((s: any) => `${s.productName}|${s.sizeLabel}`),
);

const pipeProducts = pipeFixture.priceLadderByDN.map((row: any, i: number) => ({
  kind: 'pipe' as const,
  dn: row.dn,
  spec: priceList[i].spec,
  odMm: row.odMm,
  minWallThicknessMm: row.minWallThicknessMm,
  unitWeightKgPerM: row.unitWeightKgPerM,
}));

const fittingProducts = fittingFixture.skus.map((sku: any) => {
  const key = `${sku.productName}|${sku.sizeLabel}`;
  const insertRef = insertBySkuKey.get(key);
  return {
    kind: 'fitting' as const,
    productName: sku.productName,
    sizeLabel: sku.sizeLabel,
    unit: sku.unit,
    schedule: sku.schedule,
    moldSizeDN: sku.moldSizeDN,
    cycleTimeSec: sku.cycleTimeSec,
    cavity: sku.cavity,
    unitWeightKg: sku.unitWeightKg,
    ...(insertRef
      ? {
          metalInsert: {
            renType: insertRef.renType,
            ptSize: insertRef.ptSize,
            insertQtyPerUnit: insertQtyBySkuKey.get(key),
          },
        }
      : {}),
  };
});

const scenarioInput = ScenarioInputSchema.parse({
  id: 'baseline-v3.4',
  asOfYear: 2026,
  resources: {
    pipe: {
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
    },
    fitting: {
      driverType: 'machine_hour',
      machineTypes: [
        { id: 'A', priceVnd: fittingFixture.params.machineTypeAPrice, count: fittingFixture.params.machineTypeACount },
        { id: 'B', priceVnd: fittingFixture.params.machineTypeBPrice, count: fittingFixture.params.machineTypeBCount },
      ],
      moldAssets: moldAssetsFixture.moldAssets,
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
    },
  },
  products: [...pipeProducts, ...fittingProducts],
  costPool: {
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
  },
  inventory: {
    pipe: {
      lots: assumptions.inventory.pipeLots,
      priceLock: { baseline: assumptions.priceLock.pipe.baselineUsd, thresholdPct: assumptions.priceLock.thresholdPct },
      replacementPriceUsdPerKg: assumptions.priceLock.pipe.replacementUsd,
    },
    fitting: {
      lots: assumptions.inventory.fittingLots,
      priceLock: { baseline: assumptions.priceLock.fitting.baselineUsd, thresholdPct: assumptions.priceLock.thresholdPct },
      replacementPriceUsdPerKg: assumptions.priceLock.fitting.replacementUsd,
    },
    metalInsert: metalInsert.insertCatalog.map((entry: any) => ({
      renType: entry.renType,
      ptSize: entry.ptSize,
      lots: [{ qtyOnHand: entry.inventoryQtyOnHand, unitPriceVnd: entry.unitPriceVnd }],
      priceLock: { baseline: entry.priceLock.baselinePriceVnd, thresholdPct: entry.priceLock.thresholdPct / 100 },
      replacementPriceVnd: entry.priceLock.replacementPriceVnd,
    })),
  },
});

const output = calculateScenario(scenarioInput);

describe('calculateScenario() — khớp ScenarioOutputSchema', () => {
  it('parse không lỗi', () => {
    expect(() => ScenarioOutputSchema.parse(output)).not.toThrow();
  });
});

describe('calculateScenario() — khớp tuyệt đối số vàng đã biết (M2-M9, đối chiếu qua 1 cửa ngõ)', () => {
  it('capacity + mhrPerMachineHour', () => {
    expect(output.capacity.pipe.normalCapacityKgYear).toBeCloseTo(pipeFixture.capacity.normalCapacityKgYear, 6);
    expect(output.capacity.fitting.estimatedProductionKgYear).toBeCloseTo(fittingFixture.capacity.estimatedProductionKgYear, 6);
    expect(output.mhrPerMachineHour).toBeCloseTo(1344175.79463858, 3);
  });

  it('thang giá 5 bậc — khớp dashboard.json', () => {
    const dashboard = loadFixture<any>('dashboard.json');
    const golden = dashboard.priceLadder5Tier;
    expect(output.priceLadder.pipe.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.pipe, 3);
    expect(output.priceLadder.pipe.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.pipe, 3);
    expect(output.priceLadder.pipe.targetPrice).toBeCloseTo(golden.tier5_targetPrice.pipe, 3);
    expect(output.priceLadder.fitting.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.fitting, 3);
    expect(output.priceLadder.fitting.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.fitting, 3);
    expect(output.priceLadder.fitting.targetPrice).toBeCloseTo(golden.tier5_targetPrice.fitting, 3);
  });

  it('CVP — khớp pipe.json/fitting.json.cvp', () => {
    expect(output.cvp.pipe.breakEvenKgYear).toBeCloseTo(pipeFixture.cvp.breakEvenKgYear, 6);
    expect(output.cvp.fitting.breakEvenMachineHours).toBeCloseTo(fittingFixture.cvp.breakEvenMachineHours, 6);
  });

  it('8/8 SKU Ống — listPriceBeforeVat khớp price-list.json', () => {
    const pipeChains = output.skuPriceChains.filter((c) => 'dn' in c.productKey);
    expect(pipeChains).toHaveLength(8);
    pipeChains.forEach((c, i) => {
      expect(c.chain.listPriceBeforeVat).toBe(priceList[i].priceBeforeVat);
      expect(c.managementStatus).toBe('active');
    });
  });

  it('83/91 SKU Phụ kiện active — listPriceBeforeVat khớp price-list.json', () => {
    const fittingChains = output.skuPriceChains.filter((c) => 'productName' in c.productKey);
    expect(fittingChains).toHaveLength(91);
    let activeChecked = 0;
    let pendingMoldCount = 0;
    fittingChains.forEach((c, i) => {
      const key = `${c.productKey.productName}|${c.productKey.sizeLabel}`;
      if (skusWithoutMold.has(key)) {
        expect(c.managementStatus).toBe('pending_mold');
        pendingMoldCount += 1;
        return;
      }
      expect(c.managementStatus).toBe('active');
      expect(c.chain.listPriceBeforeVat).toBe(priceList[8 + i].priceBeforeVat);
      activeChecked += 1;
    });
    expect(activeChecked).toBe(83);
    expect(pendingMoldCount).toBe(8);
  });

  it('bookCostPerKg tự-đối-chiếu fullCostPerKg khi weightedAvg trùng pricingPrice (chưa có kịch bản kho lệch giá thật)', () => {
    expect(output.dualCosting.pipe.bookCostPerKg).toBeCloseTo(pipeFixture.costAtNormalCapacity.fullCostPerKg, 3);
    // fitting.json chỉ có `bookFullCostPerKgRef` (không có field `fullCostPerKgRef`
    // riêng) — do kịch bản mặc định replacement=baseline=weightedAvg nên Excel
    // export ra 1 giá trị duy nhất, khác pipe.json (có cả 2 field, cùng giá trị).
    expect(output.dualCosting.fitting.bookCostPerKg).toBeCloseTo(fittingFixture.costAtNormalCapacity.bookFullCostPerKgRef, 3);
    expect(output.dualCosting.pipe.holdingGainLossVnd).toBeCloseTo(0, 3);
    expect(output.dualCosting.pipe.provisionWarning).toBe('Giá tái tạo ≥ bình quân kho — không cần dự phòng');
  });

  it('priceLock — Ống/Phụ kiện KHÓA (lệch 0%, đúng ADR-004 kịch bản mặc định)', () => {
    expect(output.priceLock.pipe.isLocked).toBe(true);
    expect(output.priceLock.pipe.pricingPrice).toBeCloseTo(3.03, 6);
    expect(output.priceLock.fitting.isLocked).toBe(true);
    expect(output.priceLock.metalInsertByCatalogEntry).toHaveLength(10);
    expect(output.priceLock.metalInsertByCatalogEntry.every((e) => e.evaluation.isLocked)).toBe(true);
  });
});
