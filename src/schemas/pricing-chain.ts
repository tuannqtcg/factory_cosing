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
  // ADR-058 — thuế NK/phí logistics RIÊNG từng lô (optional — bỏ trống thì lấy
  // theo material, ADR-012). Mỗi lô có thể xuất xứ khác nhau (vd lô có C/O
  // AIFTA 0% xen giữa các lô chịu thuế MFN của cùng 1 nguyên liệu).
  importTaxRate: z.number().min(0).max(1).optional(),
  customsLogisticsFeeRate: z.number().min(0).max(1).optional(),
});
export type InventoryLot = z.infer<typeof InventoryLotSchema>;

// Bổ sung 2026-07-06 (Pha 3 M12, orchestrator scenario.ts) — xem ADR-009 bảng
// bổ sung field, dòng #5: `replacementPriceUsdPerKg` (giá tái tạo thị trường
// HIỆN HÀNH, admin/pricing tự cập nhật khi có báo giá mới — ĐỘC LẬP với `lots`
// là lịch sử đã MUA). Không có field này thì evaluatePriceLock() không có
// "replacement" để so với baseline (pricing-chain.md dòng 21-23: replacement
// "phụ thuộc giá thị trường hiện hành NHẬP Ở TỒN KHO" — nhưng schema gốc chỉ
// có lots (lịch sử) + priceLock policy (baseline/threshold), thiếu đúng chỗ
// nhập giá thị trường hiện hành).
export const CompoundInventorySchema = z.object({
  // ADR-064 — [length-1] (PHẦN TỬ CUỐI) = lô GẦN NHẤT: UI thêm lô mới APPEND
  // vào cuối, số thứ tự hiển thị tăng dần theo thời gian nhập (Lô 1 = nhập
  // đầu tiên/cũ nhất, Lô N = nhập sau cùng/gần nhất) — khớp trực giác người
  // dùng (số cao hơn = gần đây hơn). TRƯỚC ADR-064: [0] = gần nhất (UI PREPEND
  // lô mới lên đầu) — đổi vì gây lẫn lộn thứ tự khi sửa/thêm lô không theo
  // đúng trình tự bấm "+Thêm lô rồi điền ngay". Lô có `tons` = 0 (placeholder
  // chưa điền / dữ liệu fixture cũ) bị BỎ QUA khi tìm "lô gần nhất" — xem
  // `lastLotPriceOf` (scenario.ts).
  lots: z.array(InventoryLotSchema).max(5),
  priceLock: CompoundPriceLockPolicySchema,
  replacementPriceUsdPerKg: z.number().nonnegative(),
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
  lots: z.array(MetalInsertLotSchema).max(5), // [length-1] = lô GẦN NHẤT (ADR-064), đối xứng CompoundInventorySchema
  priceLock: MetalInsertPriceLockPolicySchema,
  replacementPriceVnd: z.number().int().nonnegative(), // đối xứng replacementPriceUsdPerKg — xem comment CompoundInventorySchema
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
