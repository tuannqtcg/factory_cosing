// M12.4b (ADR-010) — tầng orchestration cho Plan_SX (T1): 2 việc mà plan.ts
// CỐ TÌNH không tự làm (xem giả định đầu plan.ts):
//   1. `deriveMoldSetCountBySizeDN()` — dẫn xuất số BỘ khuôn theo size DN từ
//      `Resource.fitting.moldAssets` + danh mục SKU (join producesSkus →
//      FittingProduct.moldSizeDN qua productName+sizeLabel).
//   2. `calculatePlanForScenario()` — nối ScenarioInput + PlanInput →
//      calculatePlan(): TÁI DÙNG nguyên các hàm pure capacity/cost/cvp
//      (CHẤP NHẬN gọi lại thay vì moi kết quả trung gian của
//      calculateScenario() — đánh đổi đã quyết ở ADR-010 để
//      calculateScenario() không phải "biết" về Plan_SX). Đặt ở engine (pure,
//      không I/O) thay vì viết thẳng trong Cloud Function để test được bằng
//      `npm test` thường và tái dùng cho UI màn Kế Hoạch SX (M12.7).
//
// Quy ước material THAM CHIẾU của dòng Ống (cho cost/cvp →
// idleCapacityCostPipePerKg) giống hệt calculateScenario() — xem ghi chú
// ADR-012 đầu src/engine/scenario.ts.
import type { MoldAsset } from '../schemas/resource.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { FittingProduct } from '../schemas/product.js';
import type { ScenarioInput, PlanInput, PlanResult } from '../schemas/scenario.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from './pipe.js';
import { calculateFittingCapacity } from './fitting.js';
import { calculatePipeCvp } from './cvp.js';
import { calculatePlan, type PlanMaterialPricing } from './plan.js';
import { evaluatePriceLock } from './price-lock.js';
import { landedCostPerKgVnd, type MaterialPricingInput } from './cost-pool.js';
import { lastLotPriceOf } from './scenario.js';

/**
 * Số BỘ khuôn theo size DN — input `moldSetCountBySizeDN` của calculatePlan()
 * (ràng buộc khuôn BUSINESS_MODEL §6.3). 1 `MoldAsset` = 1 bộ khuôn (đúng
 * nghĩa "bộ" trong hợp đồng khuôn ADR-007): cộng 1 vào MỖI size DN DISTINCT mà
 * khuôn đó ép ra — 1 khuôn ra nhiều SKU CÙNG size chỉ đếm 1 lần; SKU trong
 * `producesSkus` không có trong danh mục `products` thì bỏ qua (không suy ra
 * được size DN — đối xứng với cách plan.ts bỏ qua entry kế hoạch không khớp
 * danh mục).
 */
export function deriveMoldSetCountBySizeDN(
  moldAssets: MoldAsset[],
  products: FittingProduct[],
): Record<number, number> {
  const sizeDnByskuKey = new Map<string, number>(
    products.map((p) => [`${p.productName}|${p.sizeLabel}`, p.moldSizeDN]),
  );
  const counts: Record<number, number> = {};
  for (const asset of moldAssets) {
    const distinctSizeDNs = new Set<number>();
    for (const sku of asset.producesSkus) {
      const sizeDN = sizeDnByskuKey.get(`${sku.productName}|${sku.sizeLabel}`);
      if (sizeDN !== undefined) distinctSizeDNs.add(sizeDN);
    }
    for (const sizeDN of distinctSizeDNs) {
      counts[sizeDN] = (counts[sizeDN] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * ScenarioInput + PlanInput → PlanResult (pure). Giá NVL cấp cho mục 4 của
 * plan.ts theo ADR-012/ADR-004: `compoundLandedPerKgVnd` tại giá ĐÃ QUA khóa
 * từng material (evaluate giống calculateScenario()); `replacementUsdPerKgRaw`
 * là replacement THÔ, KHÔNG qua khóa (kế hoạch mua ngoại tệ/LC — ADR-004 §1a).
 */
export function calculatePlanForScenario(scenario: ScenarioInput, planInput: PlanInput): PlanResult {
  const { resources, materials, products, costPool } = scenario;
  const pipeResource = resources.pipe as ContinuousKgResource;
  const fittingResource = resources.fitting as MachineHourResource;
  const pipeProducts = products.filter((p) => p.kind === 'pipe');
  const fittingProducts = products.filter((p) => p.kind === 'fitting');

  // Material tham chiếu dòng Ống = material ĐẦU TIÊN trong materials[] được
  // ≥1 SP Ống dùng (quy ước ADR-012, giống calculateScenario()).
  const pipeRefMaterial = materials.find((m) => pipeProducts.some((p) => p.materialId === m.id));
  if (!pipeRefMaterial) {
    throw new Error('Dòng Ống phải có ≥1 sản phẩm gắn material — thiếu material tham chiếu cho cost/cvp Plan_SX');
  }

  const lockedPricingPriceOf = (m: ScenarioInput['materials'][number]): number =>
    evaluatePriceLock({
      baseline: m.inventory.priceLock.baseline,
      thresholdPct: m.inventory.priceLock.thresholdPct,
      replacement: m.inventory.replacementPriceUsdPerKg,
      lastLotPrice: lastLotPriceOf(m.inventory.lots),
    }).pricingPrice;

  const pipeRefPricingInput: MaterialPricingInput = {
    materialId: pipeRefMaterial.id,
    pricingPriceUsdPerKg: lockedPricingPriceOf(pipeRefMaterial),
    importTaxRate: pipeRefMaterial.importTaxRate,
    customsLogisticsFeeRate: pipeRefMaterial.customsLogisticsFeeRate,
    markupVf: pipeRefMaterial.markupVf,
  };

  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const fittingCapacity = calculateFittingCapacity(fittingResource, fittingProducts);
  const pipeCost = calculatePipeCostAtNormalCapacity({
    resource: pipeResource,
    capacity: pipeCapacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
    material: pipeRefPricingInput,
  });
  const pipeCvp = calculatePipeCvp(pipeResource, pipeCapacity, pipeCost);

  // Bảng giá cho MỌI material trong scenario (plan.ts tự bỏ qua material
  // không xuất hiện trong kế hoạch).
  const planMaterials: PlanMaterialPricing[] = materials.map((m) => ({
    materialId: m.id,
    compoundLandedPerKgVnd: landedCostPerKgVnd(lockedPricingPriceOf(m), {
      importTaxRate: m.importTaxRate,
      customsLogisticsFeeRate: m.customsLogisticsFeeRate,
      usdVndRate: costPool.currency.usdVndRate,
    }),
    replacementUsdPerKgRaw: m.inventory.replacementPriceUsdPerKg,
  }));

  return calculatePlan(
    planInput,
    { resource: pipeResource, products: pipeProducts, cost: pipeCost, cvp: pipeCvp },
    {
      resource: fittingResource,
      products: fittingProducts,
      moldSetCountBySizeDN: deriveMoldSetCountBySizeDN(fittingResource.moldAssets, fittingProducts),
    },
    planMaterials,
  );
}
