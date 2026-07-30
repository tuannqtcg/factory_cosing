// Nguồn công thức: docs/BUSINESS_MODEL.js §1 ("Chi phí chung dùng chung 2 dòng").
// Dùng chung cho pipe.ts (M2) và fitting.ts (M3) — không viết lặp lại.
import type { SharedFixedCosts } from '../schemas/cost-pool.js';

export function sharedFixedCostsTotalPerYear(pool: SharedFixedCosts): number {
  return (
    (pool.labAnnualized + pool.vnUlSetupAnnualized + pool.ulSetupAnnualized) / pool.depreciationYears +
    (pool.factoryConstructionCost) / pool.factoryDepreciationYears +
    pool.annualComplianceFee +
    pool.annualLandRent
  );
}

/**
 * Thuế NK + phí HQ theo TỪNG nguyên liệu (ADR-012 — trước đây nằm chung trong
 * CurrencyParams) + tỷ giá toàn cục. Mọi chỗ tính landed cost nhận đúng bộ 3
 * này thay vì cả CurrencyParams.
 */
export interface LandedCostRates {
  importTaxRate: number;
  customsLogisticsFeeRate: number;
  usdVndRate: number;
}

/**
 * USD/kg → VNĐ landed cost — dùng chung cho pipe.ts/fitting.ts/metal-insert.ts
 * (giá compound) và dual-costing.ts (chênh lệch giá quy đổi lãi/lỗ giữ kho) —
 * cùng 1 công thức `giá × (1+thuế NK+phí logistics) × tỷ giá`, trước đây lặp
 * lại độc lập ở 4 file (phát hiện khi code review PR #1).
 */
export function landedCostPerKgVnd(priceUsdPerKg: number, rates: LandedCostRates): number {
  return priceUsdPerKg * (1 + rates.importTaxRate + rates.customsLogisticsFeeRate) * rates.usdVndRate;
}

/**
 * Nghịch đảo `landedCostPerKgVnd` (ADR-058) — dùng khi đã có landed cost VND/kg
 * tính đúng theo THUẾ/PHÍ TỪNG LÔ (vd `weightedAvgLandedCostPerKgVnd`, mỗi lô 1
 * mức thuế khác nhau) và cần "giá USD/kg tương đương" để giá trị đó chảy đúng
 * qua các hàm chỉ nhận 1 mức thuế/phí DUY NHẤT của material (vd
 * `scenarioWithCostBasis`, ép `replacementPriceUsdPerKg` để tái dùng nguyên
 * pipeline landed cost hiện có).
 */
export function usdPerKgForLandedCostVnd(landedCostVnd: number, rates: LandedCostRates): number {
  const divisor = (1 + rates.importTaxRate + rates.customsLogisticsFeeRate) * rates.usdVndRate;
  return divisor > 0 ? landedCostVnd / divisor : 0;
}

/**
 * Bộ tham số THEO NGUYÊN LIỆU mà pipe.ts/fitting.ts cần để tính giá thành
 * (ADR-012): giá ĐÃ QUA khóa (ADR-004, tầng scenario evaluate rồi truyền vào),
 * thuế/phí landed riêng, markup VF riêng. KHÔNG truyền cả Material vào engine
 * dòng SP — giữ 2 module độc lập với schema tồn kho.
 */
export interface MaterialPricingInput {
  materialId: string;
  pricingPriceUsdPerKg: number; // ADR-004 — pricingPrice sau khóa, KHÔNG phải replacement thô
  importTaxRate: number;
  customsLogisticsFeeRate: number;
  markupVf: number;
}
