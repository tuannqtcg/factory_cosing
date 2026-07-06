// Nguồn nghiệp vụ: docs/contracts/pricing-chain.md — ADR-002, ADR-004, ADR-008.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
//
// ⚠ Khi migrate tests/fixtures/metal-insert.json: field `insertCatalog[].priceLock.thresholdPct`
// trong fixture đang ở dạng SỐ NGUYÊN % (vd 5), phải chuyển sang THẬP PHÂN (0.05)
// trước khi parse qua MetalInsertPriceLockPolicySchema — xem cảnh báo đầu contract .md.
import { z } from 'zod';

function makePriceLockPolicySchema<T extends z.ZodTypeAny>(amountSchema: T) {
  return z.object({
    baseline: amountSchema,
    thresholdPct: z.number().min(0).max(1),
  });
}

function makePriceLockEvaluationSchema<T extends z.ZodTypeAny>(amountSchema: T) {
  return z.object({
    replacement: amountSchema,
    deviationPct: z.number(),
    isLocked: z.boolean(),
    pricingPrice: amountSchema,
    stalenessWarning: z.string().nullable(),
  });
}

const UsdAmount = z.number().nonnegative();
const VndUnitPrice = z.number().int().nonnegative();

export const CompoundPriceLockPolicySchema = makePriceLockPolicySchema(UsdAmount);
export type CompoundPriceLockPolicy = z.infer<typeof CompoundPriceLockPolicySchema>;

export const MetalInsertPriceLockPolicySchema = makePriceLockPolicySchema(VndUnitPrice);
export type MetalInsertPriceLockPolicy = z.infer<typeof MetalInsertPriceLockPolicySchema>;

export const CompoundPriceLockEvaluationSchema = makePriceLockEvaluationSchema(UsdAmount);
export type CompoundPriceLockEvaluation = z.infer<typeof CompoundPriceLockEvaluationSchema>;

export const MetalInsertPriceLockEvaluationSchema = makePriceLockEvaluationSchema(VndUnitPrice);
export type MetalInsertPriceLockEvaluation = z.infer<typeof MetalInsertPriceLockEvaluationSchema>;

export const InventoryLotSchema = z.object({
  tons: z.number().nonnegative(),
  priceUsdPerKg: z.number().nonnegative(),
});
export type InventoryLot = z.infer<typeof InventoryLotSchema>;

export const CompoundInventorySchema = z.object({
  lots: z.array(InventoryLotSchema).max(5),
  priceLock: CompoundPriceLockPolicySchema,
});
export type CompoundInventory = z.infer<typeof CompoundInventorySchema>;

export const MetalInsertLotSchema = z.object({
  qtyOnHand: z.number().int().nonnegative(),
  unitPriceVnd: z.number().int().nonnegative(),
});
export type MetalInsertLot = z.infer<typeof MetalInsertLotSchema>;

export const MetalInsertCatalogEntrySchema = z.object({
  renType: z.enum(['trong', 'ngoài']),
  ptSize: z.string(),
  lots: z.array(MetalInsertLotSchema).max(5),
  priceLock: MetalInsertPriceLockPolicySchema,
});
export type MetalInsertCatalogEntry = z.infer<typeof MetalInsertCatalogEntrySchema>;

export const MetalInsertCatalogSchema = z.array(MetalInsertCatalogEntrySchema);
export type MetalInsertCatalog = z.infer<typeof MetalInsertCatalogSchema>;

export const PriceLadder5TierSchema = z.object({
  variableCostFloor: z.number(),
  cashBreakEven: z.number(),
  breakEvenFullCost: z.number(),
  enterpriseBreakEven: z.number(),
  targetPrice: z.number(),
});
export type PriceLadder5Tier = z.infer<typeof PriceLadder5TierSchema>;

export const SkuPriceChainSchema = z.object({
  materialCostPerUnit: z.number(),
  processingCostPerUnit: z.number(),
  breakEvenPerUnit: z.number(),
  vfPricePerUnit: z.number(),
  tcgPricePerUnit: z.number(),
  listPriceBeforeVat: z.number().int(),
  listPriceWithVat: z.number().int(),
});
export type SkuPriceChain = z.infer<typeof SkuPriceChainSchema>;
