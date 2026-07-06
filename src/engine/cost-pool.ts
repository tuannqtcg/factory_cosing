// Nguồn công thức: docs/BUSINESS_MODEL.md §1 ("Chi phí chung dùng chung 2 dòng").
// Dùng chung cho pipe.ts (M2) và fitting.ts (M3) — không viết lặp lại.
import type { SharedFixedCosts } from '../schemas/cost-pool.js';

export function sharedFixedCostsTotalPerYear(pool: SharedFixedCosts): number {
  return (
    (pool.labAnnualized + pool.vnUlSetupAnnualized + pool.ulSetupAnnualized) / pool.depreciationYears +
    pool.annualComplianceFee +
    pool.annualLandRent
  );
}
