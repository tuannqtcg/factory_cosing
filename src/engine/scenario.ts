// Orchestrator Pha 3 M12 — nối TOÀN BỘ engine (pipe/fitting/cvp/price-ladder/
// price-lock/dual-costing/metal-insert) thành 1 hàm pure duy nhất
// `calculateScenario(ScenarioInput) → ScenarioOutput` đúng contract đóng băng
// ở `docs/contracts/scenario.md` §2 (ADR-005/006). Đây là hàm DUY NHẤT mà
// tầng UI/Cloud Function được gọi — không tự lắp lại chuỗi tính toán ở nơi
// khác (PROJECT_SPEC §3: engine pure, không I/O, dùng chung mọi nơi).
//
// Từng module con (pipe.ts/fitting.ts/...) đã có parity test riêng (M2-M9) —
// file này KHÔNG lặp công thức, chỉ NỐI DÂY theo đúng thứ tự phụ thuộc chéo
// giữa 2 dòng SP (Ống cần otherLine=Phụ kiện và ngược lại), xem ghi chú đầu
// pipe.ts/fitting.ts/price-ladder.ts.
//
// ADR-012 (multi-material, 2026-07-07): mỗi dòng SX có thể chạy NHIỀU
// nguyên liệu (BlazeMaster/Corzan) — giá/khóa giá/kho theo TỪNG Material,
// chi phí gia công + MHR + phân bổ chi phí chung theo LINE (không đổi).
// Quy ước "material THAM CHIẾU" của 1 line = material ĐẦU TIÊN trong
// `input.materials[]` được ≥1 SP của line đó dùng — dùng cho: (a) doanh thu
// chéo line ở bậc 4 thang giá (chưa có dữ liệu mix sản lượng theo nguyên
// liệu — xấp xỉ CÓ CHỦ ĐÍCH, thay bằng mix thực khi có Plan/sales data cần
// ADR mới); (b) mhrPerMachineHour xuất ra ở top-level (giá trị này
// material-independent nên material nào cũng cho cùng số). Sau migration
// (BlazeMaster đứng đầu materials[]) mọi số vàng v3.7 khớp tuyệt đối.
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { Material } from '../schemas/material.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity, type PipeCostAtNormalCapacity } from './pipe.js';
import {
  calculateFittingCapacity,
  calculateFittingCostAtNormalCapacity,
  type FittingCostAtNormalCapacity,
} from './fitting.js';
import { calculatePipeCvp, calculateFittingCvp } from './cvp.js';
import {
  calculatePipePriceLadder5Tier,
  calculateFittingPriceLadder5Tier,
  calculatePipeSkuPriceChain,
  calculateFittingSkuPriceChain,
  calculateMachineHoursPerUnit,
} from './price-ladder.js';
import { evaluatePriceLock } from './price-lock.js';
import { weightedAvgUsdPerKg, totalInventoryKg, holdingGainLossVnd, provisionWarning } from './dual-costing.js';
import { materialCostPerUnitWithInsert, weightedAvgInsertPriceVnd, metalInsertHoldingGainLossVnd } from './metal-insert.js';
import { landedCostPerKgVnd, type MaterialPricingInput } from './cost-pool.js';
import { managementStatusOf } from '../schemas/product.js';

/**
 * "Lô gần nhất" cho cảnh báo staleness (ADR-004) — giả định thiết kế CHƯA có
 * Excel xác nhận thứ tự lưu trữ (comment ở CompoundInventorySchema): `lots[0]`
 * là đợt nhập MỚI NHẤT (UI nhập lô mới sẽ chèn lên đầu mảng). Đổi giả định
 * này chỉ ảnh hưởng cảnh báo staleness, KHÔNG ảnh hưởng giá thành/lãi giữ kho
 * (2 số đó dùng tổng/bình quân toàn bộ lots, không phân biệt thứ tự).
 */
function lastLotPriceOf(lots: Array<{ priceUsdPerKg: number }>): number | null {
  return lots[0]?.priceUsdPerKg ?? null;
}
function lastInsertLotPriceOf(lots: Array<{ unitPriceVnd: number }>): number | null {
  return lots[0]?.unitPriceVnd ?? null;
}

export function calculateScenario(input: ScenarioInput): ScenarioOutput {
  const { asOfYear, resources, materials, products, costPool, inventory } = input;
  const pipeResource = resources.pipe as ContinuousKgResource;
  const fittingResource = resources.fitting as MachineHourResource;

  const materialById = new Map<string, Material>(materials.map((m) => [m.id, m]));
  const requireMaterial = (id: string): Material => {
    const m = materialById.get(id);
    if (!m) throw new Error(`materialId "${id}" không có trong materials[] — ScenarioInputSchema.parse() phải chặn từ trước`);
    return m;
  };

  const pipeProducts = products.filter((p) => p.kind === 'pipe');
  const fittingProducts = products.filter((p) => p.kind === 'fitting');
  // Material theo line, GIỮ THỨ TỰ materials[] (phần tử đầu = material tham chiếu — xem ghi chú đầu file)
  const pipeMaterialIds = materials.filter((m) => pipeProducts.some((p) => p.materialId === m.id)).map((m) => m.id);
  const fittingMaterialIds = materials
    .filter((m) => fittingProducts.some((p) => p.materialId === m.id))
    .map((m) => m.id);
  if (pipeMaterialIds.length === 0 || fittingMaterialIds.length === 0) {
    throw new Error('Mỗi dòng SX (pipe/fitting) phải có ≥1 sản phẩm gắn material — thiếu material tham chiếu cho thang giá');
  }

  // ── 1. Khóa bảng giá compound (ADR-004) — theo TỪNG material (ADR-012) ────
  const priceLockByMaterial = new Map<string, ReturnType<typeof evaluatePriceLock>>();
  for (const m of materials) {
    priceLockByMaterial.set(
      m.id,
      evaluatePriceLock({
        baseline: m.inventory.priceLock.baseline,
        thresholdPct: m.inventory.priceLock.thresholdPct,
        replacement: m.inventory.replacementPriceUsdPerKg,
        lastLotPrice: lastLotPriceOf(m.inventory.lots),
      }),
    );
  }
  const pricingInputOf = (id: string): MaterialPricingInput => {
    const m = requireMaterial(id);
    const lock = priceLockByMaterial.get(id);
    if (!lock) throw new Error(`chưa evaluate price lock cho material "${id}"`);
    return {
      materialId: id,
      pricingPriceUsdPerKg: lock.pricingPrice,
      importTaxRate: m.importTaxRate,
      customsLogisticsFeeRate: m.customsLogisticsFeeRate,
      markupVf: m.markupVf,
    };
  };

  // ── 2. Công suất (độc lập giá compound; năng suất mix từ TOÀN BỘ SKU phụ kiện — ADR-011) ──
  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const fittingCapacity = calculateFittingCapacity(fittingResource, fittingProducts);

  // ── 3. Chi phí SX tại CS bình thường — 1 lần cho MỖI (line, material) ──────
  // Cross-ref công suất dòng kia là số kg (material-independent) nên tính 1 lần.
  const pipeCostByMaterial = new Map<string, PipeCostAtNormalCapacity>();
  for (const id of pipeMaterialIds) {
    pipeCostByMaterial.set(
      id,
      calculatePipeCostAtNormalCapacity({
        resource: pipeResource,
        capacity: pipeCapacity,
        costPool,
        otherLineEstimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
        material: pricingInputOf(id),
      }),
    );
  }
  const fittingCostByMaterial = new Map<string, FittingCostAtNormalCapacity>();
  for (const id of fittingMaterialIds) {
    fittingCostByMaterial.set(
      id,
      calculateFittingCostAtNormalCapacity({
        resource: fittingResource,
        capacity: fittingCapacity,
        costPool,
        otherLineNormalCapacityKgYear: pipeCapacity.normalCapacityKgYear,
        material: pricingInputOf(id),
        asOfYear,
      }),
    );
  }
  const pipeRefCost = pipeCostByMaterial.get(pipeMaterialIds[0]!)!;
  const fittingRefCost = fittingCostByMaterial.get(fittingMaterialIds[0]!)!;

  // ── 4. CVP — theo (line, material) ─────────────────────────────────────────
  const pipeCvpByMaterial = new Map(
    pipeMaterialIds.map((id) => [id, calculatePipeCvp(pipeResource, pipeCapacity, pipeCostByMaterial.get(id)!)]),
  );
  const fittingCvpByMaterial = new Map(
    fittingMaterialIds.map((id) => [
      id,
      calculateFittingCvp(fittingResource, fittingCapacity, fittingCostByMaterial.get(id)!),
    ]),
  );

  // ── 5. Thang giá 5 bậc — theo (line, material); doanh thu chéo dùng material
  //       THAM CHIẾU của dòng kia (xem ghi chú đầu file) ──────────────────────
  const pipeRefRevenueVnd = pipeCapacity.normalCapacityKgYear * pipeRefCost.vfPricePerKg;
  const fittingRefRevenueVnd = fittingCapacity.estimatedProductionKgYear * fittingRefCost.vfPricePerKgRef;
  const priceLadderByLineMaterial: ScenarioOutput['priceLadder']['byLineMaterial'] = [
    ...pipeMaterialIds.map((id) => ({
      line: 'pipe' as const,
      materialId: id,
      ladder: calculatePipePriceLadder5Tier({
        capacity: pipeCapacity,
        cost: pipeCostByMaterial.get(id)!,
        cvp: pipeCvpByMaterial.get(id)!,
        costPool,
        otherLineRevenueVnd: fittingRefRevenueVnd,
      }),
    })),
    ...fittingMaterialIds.map((id) => ({
      line: 'fitting' as const,
      materialId: id,
      ladder: calculateFittingPriceLadder5Tier({
        capacity: fittingCapacity,
        cost: fittingCostByMaterial.get(id)!,
        cvp: fittingCvpByMaterial.get(id)!,
        costPool,
        otherLineRevenueVnd: pipeRefRevenueVnd,
      }),
    })),
  ];

  // ── 6. Khóa giá ren kim loại (ADR-008) — theo (renType, ptSize), ĐỘC LẬP compound ──
  const metalInsertLockByKey = new Map<string, ReturnType<typeof evaluatePriceLock>>();
  const metalInsertByCatalogEntry = inventory.metalInsert.map((entry) => {
    const evaluation = evaluatePriceLock({
      baseline: entry.priceLock.baseline,
      thresholdPct: entry.priceLock.thresholdPct,
      replacement: entry.replacementPriceVnd,
      lastLotPrice: lastInsertLotPriceOf(entry.lots),
    });
    metalInsertLockByKey.set(`${entry.renType}|${entry.ptSize}`, evaluation);
    return { renType: entry.renType, ptSize: entry.ptSize, evaluation };
  });

  // ── 7. Chuỗi giá theo SKU (Ống theo DN, Phụ kiện theo product) — giá vật
  //       liệu theo material của TỪNG SP; MHR/chi phí gia công theo line ──────
  const skuPriceChains = products.map((product) => {
    const material = requireMaterial(product.materialId);
    const lock = priceLockByMaterial.get(product.materialId)!;

    if (product.kind === 'pipe') {
      const cost = pipeCostByMaterial.get(product.materialId)!;
      const chain = calculatePipeSkuPriceChain(cost.fullCostPerKg, product.unitWeightKgPerM, material.markupVf, costPool);
      return {
        productKey: { dn: product.dn, materialId: product.materialId },
        managementStatus: 'active' as const,
        chain,
      };
    }

    const machineHoursPerUnit = calculateMachineHoursPerUnit(product.cycleTimeSec, product.cavity, fittingResource.yieldRate);
    const landedRates = {
      importTaxRate: material.importTaxRate,
      customsLogisticsFeeRate: material.customsLogisticsFeeRate,
      usdVndRate: costPool.currency.usdVndRate,
    };

    // 80/91 SKU không ren: gọi materialCostPerUnitWithInsert() với insert=0 —
    // TÁI DÙNG nguyên công thức (verify khớp tuyệt đối 80/91 SKU, xem
    // tests/parity/price-ladder.test.ts), KHÔNG viết công thức "vật liệu
    // thuần nhựa" riêng để tránh trùng lặp logic đã kiểm chứng.
    let materialCostPerUnit: number;
    if (product.metalInsert) {
      const insertLock = metalInsertLockByKey.get(`${product.metalInsert.renType}|${product.metalInsert.ptSize}`);
      if (!insertLock) {
        throw new Error(
          `Thiếu MetalInsertCatalogEntry cho (${product.metalInsert.renType}, ${product.metalInsert.ptSize}) — SKU ${product.productName} ${product.sizeLabel}`,
        );
      }
      materialCostPerUnit = materialCostPerUnitWithInsert({
        unitWeightKg: product.unitWeightKg,
        compoundPricingPriceUsdPerKg: lock.pricingPrice,
        yieldRate: fittingResource.yieldRate,
        packagingCostPerKg: fittingResource.packagingCostPerKg,
        insertQtyPerUnit: product.metalInsert.insertQtyPerUnit,
        insertPricingPriceVnd: insertLock.pricingPrice,
        landedRates,
      });
    } else {
      materialCostPerUnit = materialCostPerUnitWithInsert({
        unitWeightKg: product.unitWeightKg,
        compoundPricingPriceUsdPerKg: lock.pricingPrice,
        yieldRate: fittingResource.yieldRate,
        packagingCostPerKg: fittingResource.packagingCostPerKg,
        insertQtyPerUnit: 0,
        insertPricingPriceVnd: 0,
        landedRates,
      });
    }

    // MHR material-independent — dùng bản tính tại material tham chiếu của line.
    const chain = calculateFittingSkuPriceChain(
      materialCostPerUnit,
      machineHoursPerUnit,
      fittingRefCost.mhrPerMachineHour,
      material.markupVf,
      costPool,
    );
    return {
      productKey: { productName: product.productName, sizeLabel: product.sizeLabel, materialId: product.materialId },
      managementStatus: managementStatusOf(product, fittingResource.moldAssets),
      chain,
    };
  });

  // ── 8. Giá vốn kép (ADR-002) — theo (material, line): bookCostPerKg cần chi
  //       phí gia công của line; holdingGainLoss thuộc material (xem schema) ──
  const dualCostingByMaterial: ScenarioOutput['dualCosting']['byMaterial'] = [];
  const pushDualCosting = (materialId: string, line: 'pipe' | 'fitting') => {
    const m = requireMaterial(materialId);
    const weightedAvg = weightedAvgUsdPerKg(m.inventory.lots) ?? m.inventory.replacementPriceUsdPerKg;
    const inventoryKg = totalInventoryKg(m.inventory.lots);
    const rates = {
      importTaxRate: m.importTaxRate,
      customsLogisticsFeeRate: m.customsLogisticsFeeRate,
      usdVndRate: costPool.currency.usdVndRate,
    };
    const bookMaterialPerKgFinished = landedCostPerKgVnd(weightedAvg, rates) / (line === 'pipe' ? pipeResource : fittingResource).yieldRate;
    const bookCostPerKg =
      line === 'pipe'
        ? bookMaterialPerKgFinished + pipeResource.packagingCostPerKg + pipeCostByMaterial.get(materialId)!.unitProcessingCostPerKg
        : bookMaterialPerKgFinished +
          fittingResource.packagingCostPerKg +
          fittingCostByMaterial.get(materialId)!.processingCostPerKgRef;
    const gainLoss = holdingGainLossVnd({
      replacementPriceUsdPerKg: m.inventory.replacementPriceUsdPerKg,
      weightedAvgUsdPerKg: weightedAvg,
      inventoryKg,
      importTaxRate: m.importTaxRate,
      customsLogisticsFeeRate: m.customsLogisticsFeeRate,
      usdVndRate: costPool.currency.usdVndRate,
    });
    dualCostingByMaterial.push({
      materialId,
      line,
      bookCostPerKg,
      holdingGainLossVnd: gainLoss,
      provisionWarning: provisionWarning(gainLoss),
    });
  };
  for (const id of pipeMaterialIds) pushDualCosting(id, 'pipe');
  for (const id of fittingMaterialIds) pushDualCosting(id, 'fitting');

  const metalInsertDualCosting = inventory.metalInsert.map((entry) => {
    const weightedAvg = weightedAvgInsertPriceVnd(entry.lots) ?? entry.replacementPriceVnd;
    const gainLoss = metalInsertHoldingGainLossVnd(
      entry.replacementPriceVnd,
      weightedAvg,
      entry.lots.reduce((sum, lot) => sum + lot.qtyOnHand, 0),
    );
    return {
      renType: entry.renType,
      ptSize: entry.ptSize,
      holdingGainLossVnd: gainLoss,
      provisionWarning: provisionWarning(gainLoss),
    };
  });

  return {
    capacity: {
      pipe: { normalCapacityKgYear: pipeCapacity.normalCapacityKgYear, batchesPerYear: pipeCapacity.batchesPerYear },
      fitting: {
        normalMachineHoursUtilized: fittingCapacity.normalMachineHoursUtilized,
        estimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
      },
    },
    mhrPerMachineHour: fittingRefCost.mhrPerMachineHour,
    priceLadder: { byLineMaterial: priceLadderByLineMaterial },
    skuPriceChains,
    priceLock: {
      byMaterial: materials.map((m) => ({ materialId: m.id, evaluation: priceLockByMaterial.get(m.id)! })),
      metalInsertByCatalogEntry,
    },
    cvp: {
      byLineMaterial: [
        ...pipeMaterialIds.map((id) => {
          const cvp = pipeCvpByMaterial.get(id)!;
          return {
            line: 'pipe' as const,
            materialId: id,
            variableCostPerKg: cvp.variableCostPerKg,
            contributionMarginPerKg: cvp.contributionMarginPerKg,
            fixedCostPerYear: cvp.fixedCostPerYear,
            breakEvenKgYear: cvp.breakEvenKgYear,
            pctOfNormalCapacity: cvp.pctOfNormalCapacity,
          };
        }),
        ...fittingMaterialIds.map((id) => {
          const cvp = fittingCvpByMaterial.get(id)!;
          return {
            line: 'fitting' as const,
            materialId: id,
            variableCostPerKg: cvp.variableCostPerKg,
            contributionMarginPerKg: cvp.contributionMarginPerKg,
            fixedCostPerYear: cvp.fixedCostPerYear,
            breakEvenKgYear: cvp.breakEvenKgYear,
            breakEvenMachineHours: cvp.breakEvenMachineHours,
            pctOfUtilizedHours: cvp.pctOfUtilizedHours,
          };
        }),
      ],
    },
    dualCosting: {
      byMaterial: dualCostingByMaterial,
      metalInsert: metalInsertDualCosting,
    },
  };
}
