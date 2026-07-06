// Nguồn công thức: docs/BUSINESS_MODEL.md §1 ("Chi phí chung dùng chung 2 dòng").
// Dùng chung cho pipe.ts (M2) và fitting.ts (M3) — không viết lặp lại.
import type { CurrencyParams, SharedFixedCosts } from '../schemas/cost-pool.js';

export function sharedFixedCostsTotalPerYear(pool: SharedFixedCosts): number {
  return (
    (pool.labAnnualized + pool.vnUlSetupAnnualized + pool.ulSetupAnnualized) / pool.depreciationYears +
    pool.annualComplianceFee +
    pool.annualLandRent
  );
}

/**
 * USD/kg → VNĐ landed cost — dùng chung cho pipe.ts/fitting.ts/metal-insert.ts
 * (giá compound) và dual-costing.ts (chênh lệch giá quy đổi lãi/lỗ giữ kho) —
 * cùng 1 công thức `giá × (1+thuế NK+phí logistics) × tỷ giá`, trước đây lặp
 * lại độc lập ở 4 file (phát hiện khi code review PR #1).
 */
export function landedCostPerKgVnd(
  priceUsdPerKg: number,
  currency: Pick<CurrencyParams, 'compoundImportTaxRate' | 'customsLogisticsFeeRate' | 'usdVndRate'>,
): number {
  return priceUsdPerKg * (1 + currency.compoundImportTaxRate + currency.customsLogisticsFeeRate) * currency.usdVndRate;
}
