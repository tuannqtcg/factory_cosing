// Dựng `ScenarioInput` thật từ tests/fixtures/*.json (baseline v3.4) — TÁCH ra
// từ tests/parity/scenario.test.ts (M12.1) để dùng lại ở test tích hợp Cloud
// Function (M12.4, tests/functions/) mà không lặp lại logic ráp fixture.
//
// ADR-012 (M13.2): thêm buildCorzanScenarioInput() = baseline + 2 Material
// Corzan (corzan.json) + danh mục SKU Corzan SINH THEO RULE user cấp
// 2026-07-07 (ống = BM × 1,1 đơn trọng; phụ kiện giống hệt — xem
// corzan.json._meta.skuDerivationRule), KHÔNG chép tay 99 dòng.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

/**
 * ADR-012 — 2 Material mặc định sinh từ dữ liệu BlazeMaster hiện hành
 * (migration mục 1, contract material.md): landed cost 6%/1% (kịch bản EU) +
 * markup VF 25%/40% lấy từ assumptions.json (giá trị MarkupChain cũ).
 */
export function buildBaselineMaterials(): unknown[] {
  const assumptions = loadFixture<any>('assumptions.json');
  return [
    {
      id: 'bm-orange-pipe',
      name: 'BlazeMaster Orange (ống)',
      code: 'BM-O-P',
      originLabel: 'EU',
      importTaxRate: assumptions.compoundImportTaxRate,
      customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
      markupVf: assumptions.markupVfPipe,
      inventory: {
        lots: assumptions.inventory.pipeLots,
        priceLock: { baseline: assumptions.priceLock.pipe.baselineUsd, thresholdPct: assumptions.priceLock.thresholdPct },
        replacementPriceUsdPerKg: assumptions.priceLock.pipe.replacementUsd,
      },
    },
    {
      id: 'bm-fitting',
      name: 'BlazeMaster compound (phụ kiện)',
      code: 'BM-F',
      originLabel: 'EU',
      importTaxRate: assumptions.compoundImportTaxRate,
      customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
      markupVf: assumptions.markupVfFitting,
      inventory: {
        lots: assumptions.inventory.fittingLots,
        priceLock: { baseline: assumptions.priceLock.fitting.baselineUsd, thresholdPct: assumptions.priceLock.thresholdPct },
        replacementPriceUsdPerKg: assumptions.priceLock.fitting.replacementUsd,
      },
    },
  ];
}

/** Trả về object thô khớp `ScenarioInputSchema` — caller tự `.parse()` nếu cần validate. */
export function buildBaselineScenarioInput(): unknown {
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

  const pipeProducts = pipeFixture.priceLadderByDN.map((row: any, i: number) => ({
    kind: 'pipe' as const,
    dn: row.dn,
    spec: priceList[i].spec,
    odMm: row.odMm,
    minWallThicknessMm: row.minWallThicknessMm,
    unitWeightKgPerM: row.unitWeightKgPerM,
    materialId: 'bm-orange-pipe', // ADR-012 migration mục 2
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
      materialId: 'bm-fitting', // ADR-012 migration mục 2
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

  return {
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
        moldDepreciationYears: pipeFixture.params.moldDepreciationYears,
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
        // ADR-011: fitting.json không còn avgProductivityKgPerMachineHour (mặc
        // định bottom-up) — BỎ HẲN key thay vì ghi undefined: Zod optional chấp
        // nhận cả 2, nhưng Firestore từ chối document chứa undefined (phát hiện
        // ở test emulator M12.4 khi verify merge 2026-07-07).
        ...(fittingFixture.params.avgProductivityKgPerMachineHour !== undefined
          ? { avgProductivityKgPerMachineHour: fittingFixture.params.avgProductivityKgPerMachineHour }
          : {}),
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
    materials: buildBaselineMaterials(), // ADR-012 — BlazeMaster đứng đầu = material tham chiếu từng line
    products: [...pipeProducts, ...fittingProducts],
    costPool: {
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
    },
    inventory: {
      metalInsert: metalInsert.insertCatalog.map((entry: any) => ({
        renType: entry.renType,
        ptSize: entry.ptSize,
        lots: [{ qtyOnHand: entry.inventoryQtyOnHand, unitPriceVnd: entry.unitPriceVnd }],
        priceLock: { baseline: entry.priceLock.baselinePriceVnd, thresholdPct: entry.priceLock.thresholdPct / 100 },
        replacementPriceVnd: entry.priceLock.replacementPriceVnd,
      })),
    },
  };
}

/**
 * ADR-012 M13.2 — baseline + Corzan: materials từ corzan.json; SKU Corzan sinh
 * theo rule (ống ×1,1 đơn trọng, phụ kiện giống hệt — kể cả metalInsert BOM,
 * cùng khuôn vật lý nên managementStatus tự khớp 83 active / 8 pending_mold).
 * BlazeMaster đứng TRƯỚC trong cả materials[] lẫn products[] — giữ nguyên
 * material tham chiếu từng line (parity BM không đổi).
 */
export function buildCorzanScenarioInput(): unknown {
  const base = buildBaselineScenarioInput() as any;
  const corzan = loadFixture<any>('corzan.json');
  const factor = corzan._meta.pipeUnitWeightFactor as number;

  const corzanPipeProducts = base.products
    .filter((p: any) => p.kind === 'pipe')
    .map((p: any) => ({
      ...p,
      unitWeightKgPerM: p.unitWeightKgPerM * factor, // ống Corzan nặng hơn 10%/size (user 2026-07-07)
      materialId: 'corzan-pipe',
    }));
  const corzanFittingProducts = base.products
    .filter((p: any) => p.kind === 'fitting')
    .map((p: any) => ({ ...p, materialId: 'corzan-fitting' })); // giống hệt, chỉ đổi compound

  return {
    ...base,
    id: 'baseline-v3.7-corzan',
    materials: [...base.materials, ...corzan.materials],
    products: [...base.products, ...corzanPipeProducts, ...corzanFittingProducts],
  };
}
