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
});
export type SharedFixedCosts = z.infer<typeof SharedFixedCostsSchema>;

export const NonProductionCostsSchema = z.object({
  operatingCostPerYear: z.number().int().nonnegative(),
  financialCostPerYear: z.number().int().nonnegative(),
});
export type NonProductionCosts = z.infer<typeof NonProductionCostsSchema>;

export const CurrencyParamsSchema = z.object({
  usdVndRate: z.number().positive(),
  vatOutputRate: z.number().min(0).max(1),
  mandatoryInsuranceRate: z.number().min(0).max(1),
  compoundImportTaxRate: z.number().min(0).max(1),
  customsLogisticsFeeRate: z.number().min(0).max(1),
});
export type CurrencyParams = z.infer<typeof CurrencyParamsSchema>;

export const MarkupChainSchema = z.object({
  markupVfPipe: z.number().min(0),
  markupVfFitting: z.number().min(0),
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
