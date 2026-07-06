// Smoke test cho src/schemas/*.ts — xác nhận schema parse đúng số liệu thật
// trong tests/fixtures/*.json (không phải test parity công thức — đó thuộc
// skill excel-parity-testing, viết cùng lúc với src/engine ở milestone sau).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MoldAssetSchema,
  ContinuousKgResourceSchema,
  MachineHourResourceSchema,
  PipeProductSchema,
  FittingProductSchema,
  managementStatusOf,
  CostPoolSchema,
  CompoundPriceLockPolicySchema,
  MetalInsertPriceLockPolicySchema,
} from '../../src/schemas/index.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

describe('ResourceSchema', () => {
  it('parse continuous_kg từ pipe.json (Ống)', () => {
    const pipe = loadFixture<any>('pipe.json');
    const parsed = ContinuousKgResourceSchema.parse({
      driverType: 'continuous_kg',
      maxCapacityKgPerHour: pipe.params.extruderMaxCapacityKgPerHour,
      actualCapacityKgPerHour: pipe.params.extruderActualCapacityKgPerHour,
      continuousRunDaysPerBatch: pipe.params.continuousRunDaysPerBatch,
      maintenanceDaysPerBatch: pipe.params.maintenanceDaysPerBatch,
      operatingDaysPerYear: pipe.params.operatingDaysPerYear,
      hoursPerShift: pipe.params.hoursPerShift,
      normalShifts: pipe.params.normalShifts,
      yieldRate: pipe.params.yieldRate,
      extruderPriceEach: pipe.params.extruderPriceEach,
      extruderCount: pipe.params.extruderCount,
      moldPullerCutterCost: pipe.params.moldPullerCutterCost,
      depreciationYears: pipe.params.depreciationYears,
      annualMaintenance: pipe.params.annualMaintenance,
      peoplePerShift: pipe.params.peoplePerShift,
    });
    expect(parsed.normalShifts).toBe(3);
  });

  it('parse moldAssets từ mold-assets.json (ADR-007) — 66/66 khuôn hợp lệ', () => {
    const fixture = loadFixture<any>('mold-assets.json');
    expect(fixture.moldAssets).toHaveLength(66);
    for (const asset of fixture.moldAssets) {
      expect(() => MoldAssetSchema.parse(asset)).not.toThrow();
    }
  });

  it('MachineHourResourceSchema chấp nhận moldAssets thật (Phụ kiện)', () => {
    const fitting = loadFixture<any>('fitting.json');
    const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
    const parsed = MachineHourResourceSchema.parse({
      driverType: 'machine_hour',
      machineTypes: [
        { id: 'A', priceVnd: fitting.params.machineTypeAPrice, count: fitting.params.machineTypeACount },
        { id: 'B', priceVnd: fitting.params.machineTypeBPrice, count: fitting.params.machineTypeBCount },
      ],
      moldAssets,
      continuousRunDaysPerBatch: fitting.params.continuousRunDaysPerBatch,
      maintenanceDaysPerBatch: fitting.params.maintenanceDaysPerBatch,
      operatingDaysPerYear: fitting.params.operatingDaysPerYear,
      hoursPerShift: fitting.params.hoursPerShift,
      normalShifts: fitting.params.normalShifts,
      normalUtilizationFactor: fitting.params.normalUtilizationFactor,
      yieldRate: fitting.params.yieldRate,
      annualMoldMaintenance: fitting.params.annualMoldMaintenance,
      peoplePerShift: fitting.params.peoplePerShift,
    });
    expect(parsed.moldAssets).toHaveLength(66);
  });
});

describe('ProductSchema', () => {
  it('parse 8 SKU ống từ pipe.json.priceLadderByDN', () => {
    const pipe = loadFixture<any>('pipe.json');
    expect(pipe.priceLadderByDN).toHaveLength(8);
    for (const row of pipe.priceLadderByDN) {
      const parsed = PipeProductSchema.parse({
        kind: 'pipe',
        dn: row.dn,
        spec: 'SDR 13.5',
        odMm: row.odMm,
        minWallThicknessMm: row.minWallThicknessMm,
        unitWeightKgPerM: row.unitWeightKgPerM,
      });
      expect(parsed.dn).toBe(row.dn);
    }
  });

  it('parse 91 SKU phụ kiện từ fitting.json.skus', () => {
    const fitting = loadFixture<any>('fitting.json');
    expect(fitting.skus).toHaveLength(91);
    for (const sku of fitting.skus) {
      expect(() =>
        FittingProductSchema.parse({
          kind: 'fitting',
          productName: sku.productName,
          sizeLabel: sku.sizeLabel,
          unit: sku.unit,
          schedule: sku.schedule ?? undefined,
          moldSizeDN: sku.moldSizeDN,
          cycleTimeSec: sku.cycleTimeSec,
          cavity: sku.cavity,
          unitWeightKg: sku.unitWeightKg,
        }),
      ).not.toThrow();
    }
  });

  it('managementStatusOf: SKU trong skusWithoutMold → pending_mold', () => {
    const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
    const cutRenTrong20 = FittingProductSchema.parse({
      kind: 'fitting',
      productName: 'Cút ren trong',
      sizeLabel: '20xPT15',
      unit: 'Cái',
      moldSizeDN: 20,
      cycleTimeSec: 35,
      cavity: 4,
      unitWeightKg: 0.05,
    });
    expect(managementStatusOf(cutRenTrong20, moldAssets)).toBe('pending_mold');
  });

  it('managementStatusOf: SKU có khuôn thật → active', () => {
    const moldAssets = loadFixture<any>('mold-assets.json').moldAssets;
    const teDeu20 = FittingProductSchema.parse({
      kind: 'fitting',
      productName: 'Tê đều',
      sizeLabel: '20',
      unit: 'Cái',
      moldSizeDN: 20,
      cycleTimeSec: 35,
      cavity: 4,
      unitWeightKg: 0.055,
    });
    expect(managementStatusOf(teDeu20, moldAssets)).toBe('active');
  });
});

describe('CostPoolSchema', () => {
  it('parse toàn bộ assumptions.json vào CostPool', () => {
    const a = loadFixture<any>('assumptions.json');
    const parsed = CostPoolSchema.parse({
      sharedFixedCosts: {
        labAnnualized: a.sharedFixedCosts.labAnnualized,
        vnUlSetupAnnualized: a.sharedFixedCosts.vnUlSetupAnnualized,
        ulSetupAnnualized: a.sharedFixedCosts.ulSetupAnnualized,
        depreciationYears: a.sharedFixedCosts.depreciationYears,
        annualComplianceFee: a.sharedFixedCosts.annualComplianceFee,
        annualLandRent: a.sharedFixedCosts.annualLandRent,
      },
      nonProductionCosts: a.nonProductionCosts,
      currency: {
        usdVndRate: a.usdVndRate,
        vatOutputRate: a.vatOutputRate,
        mandatoryInsuranceRate: a.mandatoryInsuranceRate,
        compoundImportTaxRate: a.compoundImportTaxRate,
        customsLogisticsFeeRate: a.customsLogisticsFeeRate,
      },
      markup: {
        markupVfPipe: a.markupVfPipe,
        markupVfFitting: a.markupVfFitting,
        markupTcg: a.markupTcg,
        listPriceMargin: a.listPriceMargin,
      },
      solvent550PricePerBox: a.solvent550PricePerBox,
    });
    expect(parsed.currency.usdVndRate).toBe(26500);
  });
});

describe('PriceLockPolicy — cảnh báo lệch đơn vị thresholdPct (ADR-004 vs ADR-008)', () => {
  it('assumptions.json (ADR-004) đã đúng đơn vị thập phân — parse thẳng được', () => {
    const a = loadFixture<any>('assumptions.json');
    const parsed = CompoundPriceLockPolicySchema.parse({
      baseline: a.priceLock.pipe.baselineUsd,
      thresholdPct: a.priceLock.thresholdPct,
    });
    expect(parsed.thresholdPct).toBeCloseTo(0.03);
  });

  it('metal-insert.json (ADR-008) SAI đơn vị (số nguyên %) — phải bị schema từ chối để bắt buộc chuẩn hóa', () => {
    const mi = loadFixture<any>('metal-insert.json');
    const rawThresholdPct = mi.insertCatalog[0].priceLock.thresholdPct; // = 5, không phải 0.05
    expect(rawThresholdPct).toBe(5);
    expect(() =>
      MetalInsertPriceLockPolicySchema.parse({
        baseline: mi.insertCatalog[0].priceLock.baselinePriceVnd,
        thresholdPct: rawThresholdPct,
      }),
    ).toThrow();
    // Chuẩn hóa đúng (chia 100) thì parse được — đây là bước migrate bắt buộc ở Pha 3.
    const normalized = MetalInsertPriceLockPolicySchema.parse({
      baseline: mi.insertCatalog[0].priceLock.baselinePriceVnd,
      thresholdPct: rawThresholdPct / 100,
    });
    expect(normalized.thresholdPct).toBeCloseTo(0.05);
  });
});
