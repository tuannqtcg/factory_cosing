// Nguồn nghiệp vụ: docs/contracts/cost-pool.md — tests/fixtures/assumptions.json.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
import { z } from 'zod';

export const SharedFixedCostsSchema = z.object({
  labAnnualized: z.number().int().nonnegative(),
  vnUlSetupAnnualized: z.number().int().nonnegative(),
  ulSetupAnnualized: z.number().int().nonnegative(),
  depreciationYears: z.number().int().positive(),
  annualComplianceFee: z.number().int().nonnegative(),
  annualLandRent: z.number().int().nonnegative(),
  // ADR-018: CAPEX / Working Capital dynamically input by user
  factoryConstructionCost: z.number().int().nonnegative().default(0),
  factoryDepreciationYears: z.number().int().positive().default(10),
  workingCapital: z.number().int().nonnegative().default(0),
});
export type SharedFixedCosts = z.infer<typeof SharedFixedCostsSchema>;

export const NonProductionCostsSchema = z.object({
  operatingCostPerYear: z.number().int().nonnegative(),
  financialCostPerYear: z.number().int().nonnegative(),
});
export type NonProductionCosts = z.infer<typeof NonProductionCostsSchema>;

// Sửa 2026-07-07 (ADR-012, contract material.md): BỎ compoundImportTaxRate +
// customsLogisticsFeeRate — thuế NK/phí HQ chuyển vào TỪNG Material (BlazeMaster
// 6% EU, Corzan 0% AIFTA). CurrencyParams chỉ còn tham số thật sự toàn cục.
export const CurrencyParamsSchema = z.object({
  usdVndRate: z.number().positive(),
  vatOutputRate: z.number().min(0).max(1),
  mandatoryInsuranceRate: z.number().min(0).max(1),
});
export type CurrencyParams = z.infer<typeof CurrencyParamsSchema>;

// Sửa 2026-07-07 (ADR-012): BỎ markupVfPipe/markupVfFitting — markup VF chuyển
// vào TỪNG Material (Material.markupVf). GIỮ markupTcg + listPriceMargin là
// chính sách kênh phân phối CHUNG mọi nguyên liệu (user xác nhận 2026-07-07).
export const MarkupChainSchema = z.object({
  markupTcg: z.number().min(0),
  listPriceMargin: z.number().min(0).max(1),
});
export type MarkupChain = z.infer<typeof MarkupChainSchema>;

export const CostPoolSchema = z.object({
  sharedFixedCosts: SharedFixedCostsSchema,
  nonProductionCosts: NonProductionCostsSchema,
  currency: CurrencyParamsSchema,
  markup: MarkupChainSchema,
  solvent550PricePerBox: z.number().int().nonnegative(),
});
export type CostPool = z.infer<typeof CostPoolSchema>;
