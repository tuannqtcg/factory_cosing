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
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from './pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from './fitting.js';
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
import { landedCostPerKgVnd } from './cost-pool.js';
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
  const { asOfYear, resources, products, costPool, inventory } = input;
  const pipeResource = resources.pipe as ContinuousKgResource;
  const fittingResource = resources.fitting as MachineHourResource;

  // ── 1. Khóa bảng giá compound (ADR-004) — Ống & Phụ kiện có tồn kho/policy riêng ──
  const pipePriceLock = evaluatePriceLock({
    baseline: inventory.pipe.priceLock.baseline,
    thresholdPct: inventory.pipe.priceLock.thresholdPct,
    replacement: inventory.pipe.replacementPriceUsdPerKg,
    lastLotPrice: lastLotPriceOf(inventory.pipe.lots),
  });
  const fittingPriceLock = evaluatePriceLock({
    baseline: inventory.fitting.priceLock.baseline,
    thresholdPct: inventory.fitting.priceLock.thresholdPct,
    replacement: inventory.fitting.replacementPriceUsdPerKg,
    lastLotPrice: lastLotPriceOf(inventory.fitting.lots),
  });

  // ── 2. Công suất (độc lập giá compound) ──────────────────────────────────
  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const fittingCapacity = calculateFittingCapacity(fittingResource);

  // ── 3. Chi phí SX tại CS bình thường (cross-ref công suất dòng kia + pricingPrice đã khóa) ──
  const pipeCost = calculatePipeCostAtNormalCapacity({
    resource: pipeResource,
    capacity: pipeCapacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
    compoundPricingPriceUsdPerKg: pipePriceLock.pricingPrice,
  });
  const fittingCost = calculateFittingCostAtNormalCapacity({
    resource: fittingResource,
    capacity: fittingCapacity,
    costPool,
    otherLineNormalCapacityKgYear: pipeCapacity.normalCapacityKgYear,
    compoundPricingPriceUsdPerKg: fittingPriceLock.pricingPrice,
    asOfYear,
  });

  // ── 4. CVP ────────────────────────────────────────────────────────────────
  const pipeCvp = calculatePipeCvp(pipeResource, pipeCapacity, pipeCost);
  const fittingCvp = calculateFittingCvp(fittingResource, fittingCapacity, fittingCost);

  // ── 5. Thang giá 5 bậc (cross-ref doanh thu VF chéo 2 dòng) ─────────────
  const pipeOwnRevenueVnd = pipeCapacity.normalCapacityKgYear * pipeCost.vfPricePerKg;
  const fittingOwnRevenueVnd = fittingCapacity.estimatedProductionKgYear * fittingCost.vfPricePerKgRef;
  const pipeLadder = calculatePipePriceLadder5Tier({
    capacity: pipeCapacity,
    cost: pipeCost,
    cvp: pipeCvp,
    costPool,
    otherLineRevenueVnd: fittingOwnRevenueVnd,
  });
  const fittingLadder = calculateFittingPriceLadder5Tier({
    capacity: fittingCapacity,
    cost: fittingCost,
    cvp: fittingCvp,
    costPool,
    otherLineRevenueVnd: pipeOwnRevenueVnd,
  });

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

  // ── 7. Chuỗi giá theo SKU (Ống theo DN, Phụ kiện theo product) ──────────
  const skuPriceChains = products.map((product) => {
    if (product.kind === 'pipe') {
      const chain = calculatePipeSkuPriceChain(pipeCost.fullCostPerKg, product.unitWeightKgPerM, costPool);
      return {
        productKey: { dn: product.dn },
        managementStatus: 'active' as const,
        chain,
      };
    }

    const machineHoursPerUnit = calculateMachineHoursPerUnit(product.cycleTimeSec, product.cavity, fittingResource.yieldRate);

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
        compoundPricingPriceUsdPerKg: fittingPriceLock.pricingPrice,
        yieldRate: fittingResource.yieldRate,
        packagingCostPerKg: fittingResource.packagingCostPerKg,
        insertQtyPerUnit: product.metalInsert.insertQtyPerUnit,
        insertPricingPriceVnd: insertLock.pricingPrice,
        currency: costPool.currency,
      });
    } else {
      materialCostPerUnit = materialCostPerUnitWithInsert({
        unitWeightKg: product.unitWeightKg,
        compoundPricingPriceUsdPerKg: fittingPriceLock.pricingPrice,
        yieldRate: fittingResource.yieldRate,
        packagingCostPerKg: fittingResource.packagingCostPerKg,
        insertQtyPerUnit: 0,
        insertPricingPriceVnd: 0,
        currency: costPool.currency,
      });
    }

    const chain = calculateFittingSkuPriceChain(materialCostPerUnit, machineHoursPerUnit, fittingCost.mhrPerMachineHour, costPool);
    return {
      productKey: { productName: product.productName, sizeLabel: product.sizeLabel },
      managementStatus: managementStatusOf(product, fittingResource.moldAssets),
      chain,
    };
  });

  // ── 8. Giá vốn kép (ADR-002) — sổ sách (bình quân gia quyền) vs định giá (đã tính ở trên) ──
  // CHƯA có số vàng Excel riêng cho trường hợp weightedAvg ≠ pricingPrice thật
  // (kịch bản "kho 2 đợt" trong skill excel-parity-testing chỉ verify
  // holdingGainLossVnd, không verify bookCostPerKg) — công thức tái dùng
  // NGUYÊN landedCostPerKgVnd() giống hệt materialPerKgFinished/fullCostPerKg
  // trong pipe.ts/fitting.ts, chỉ thay giá đầu vào bằng weightedAvg thay vì
  // pricingPrice (đúng ADR-002 "sổ sách = bình quân gia quyền kho"). Khi
  // weightedAvg trùng pricingPrice (kịch bản mặc định, chưa có biến động kho)
  // bookCostPerKg PHẢI khớp tuyệt đối fullCostPerKg — test tự-đối-chiếu.
  const pipeWeightedAvg = weightedAvgUsdPerKg(inventory.pipe.lots) ?? inventory.pipe.replacementPriceUsdPerKg;
  const pipeInventoryKg = totalInventoryKg(inventory.pipe.lots);
  const pipeBookMaterialPerKgFinished = landedCostPerKgVnd(pipeWeightedAvg, costPool.currency) / pipeResource.yieldRate;
  const pipeBookCostPerKg = pipeBookMaterialPerKgFinished + pipeResource.packagingCostPerKg + pipeCost.unitProcessingCostPerKg;
  const pipeHoldingGainLossVnd = holdingGainLossVnd({
    replacementPriceUsdPerKg: inventory.pipe.replacementPriceUsdPerKg,
    weightedAvgUsdPerKg: pipeWeightedAvg,
    inventoryKg: pipeInventoryKg,
    compoundImportTaxRate: costPool.currency.compoundImportTaxRate,
    customsLogisticsFeeRate: costPool.currency.customsLogisticsFeeRate,
    usdVndRate: costPool.currency.usdVndRate,
  });

  const fittingWeightedAvg = weightedAvgUsdPerKg(inventory.fitting.lots) ?? inventory.fitting.replacementPriceUsdPerKg;
  const fittingInventoryKg = totalInventoryKg(inventory.fitting.lots);
  const fittingBookMaterialPerKgFinishedRef = landedCostPerKgVnd(fittingWeightedAvg, costPool.currency) / fittingResource.yieldRate;
  const fittingBookCostPerKg =
    fittingBookMaterialPerKgFinishedRef + fittingResource.packagingCostPerKg + fittingCost.processingCostPerKgRef;
  const fittingHoldingGainLossVnd = holdingGainLossVnd({
    replacementPriceUsdPerKg: inventory.fitting.replacementPriceUsdPerKg,
    weightedAvgUsdPerKg: fittingWeightedAvg,
    inventoryKg: fittingInventoryKg,
    compoundImportTaxRate: costPool.currency.compoundImportTaxRate,
    customsLogisticsFeeRate: costPool.currency.customsLogisticsFeeRate,
    usdVndRate: costPool.currency.usdVndRate,
  });

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
    mhrPerMachineHour: fittingCost.mhrPerMachineHour,
    priceLadder: { pipe: pipeLadder, fitting: fittingLadder },
    skuPriceChains,
    priceLock: {
      pipe: pipePriceLock,
      fitting: fittingPriceLock,
      metalInsertByCatalogEntry,
    },
    cvp: {
      pipe: {
        variableCostPerKg: pipeCvp.variableCostPerKg,
        contributionMarginPerKg: pipeCvp.contributionMarginPerKg,
        fixedCostPerYear: pipeCvp.fixedCostPerYear,
        breakEvenKgYear: pipeCvp.breakEvenKgYear,
        pctOfNormalCapacity: pipeCvp.pctOfNormalCapacity,
      },
      fitting: {
        variableCostPerKg: fittingCvp.variableCostPerKg,
        contributionMarginPerKg: fittingCvp.contributionMarginPerKg,
        fixedCostPerYear: fittingCvp.fixedCostPerYear,
        breakEvenKgYear: fittingCvp.breakEvenKgYear,
        breakEvenMachineHours: fittingCvp.breakEvenMachineHours,
        pctOfUtilizedHours: fittingCvp.pctOfUtilizedHours,
      },
    },
    dualCosting: {
      pipe: {
        bookCostPerKg: pipeBookCostPerKg,
        holdingGainLossVnd: pipeHoldingGainLossVnd,
        provisionWarning: provisionWarning(pipeHoldingGainLossVnd),
      },
      fitting: {
        bookCostPerKg: fittingBookCostPerKg,
        holdingGainLossVnd: fittingHoldingGainLossVnd,
        provisionWarning: provisionWarning(fittingHoldingGainLossVnd),
      },
      metalInsert: metalInsertDualCosting,
    },
  };
}
