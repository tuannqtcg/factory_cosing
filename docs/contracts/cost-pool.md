# Contract: CostPool (src/schemas/cost-pool.ts)

> Pha 2 — ĐÓNG BĂNG sau khi user duyệt. Sửa cấu trúc field ở đây bắt buộc phải có
> ADR mới (AGENTS.md luật #5).
> Nguồn nghiệp vụ: `tests/fixtures/assumptions.json`, BUSINESS_MODEL.md §1, §4.

## Nguyên tắc

`CostPool` gom các định phí/chi phí KHÔNG gắn trực tiếp với 1 Resource cụ thể —
dùng chung cho cả 2 dòng sản phẩm (Ống + Phụ kiện), phân bổ theo
`sharedCostAllocationRatio` (bậc 2/3 thang giá) hoặc theo tỷ trọng doanh thu VF
(bậc 4 — xem `pricing-chain.md`).

## Schema

```ts
import { z } from 'zod';

export const SharedFixedCostsSchema = z.object({
  labAnnualized: z.number().int().nonnegative(),        // Phòng Lab — admin-only
  vnUlSetupAnnualized: z.number().int().nonnegative(),  // hiện = 0, giữ chỗ cho UL trong nước
  ulSetupAnnualized: z.number().int().nonnegative(),    // testUL — admin-only
  depreciationYears: z.number().int().positive(),
  annualComplianceFee: z.number().int().nonnegative(),  // compliance — admin-only
  annualLandRent: z.number().int().nonnegative(),       // rent — admin-only
});
export type SharedFixedCosts = z.infer<typeof SharedFixedCostsSchema>;
// totalPerYear KHÔNG lưu — tính ra = tổng 4 field trên quy về /năm (annualized đã /năm sẵn, chỉ cộng)

export const NonProductionCostsSchema = z.object({
  operatingCostPerYear: z.number().int().nonnegative(),   // dùng cho bậc 4 (hòa vốn toàn DN)
  financialCostPerYear: z.number().int().nonnegative(),   // lãi vay — dùng cho bậc 4
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
  solvent550PricePerBox: z.number().int().nonnegative(), // vật tư phụ dùng chung — không thuộc BOM SKU nào riêng
});
export type CostPool = z.infer<typeof CostPoolSchema>;
```

## Output tính ra (KHÔNG lưu — ScenarioOutput)
- `sharedFixedCosts` phân bổ vào bậc 2/3 theo `sharedCostAllocationRatio` (đã có
  trong `pipe.costAtNormalCapacity`/`fitting.costAtNormalCapacity` — tỷ lệ này
  chính nó cũng là OUTPUT, không phải input, vì phụ thuộc công suất huy động
  từng dòng — xem BUSINESS_MODEL.md §2.2/§3.3).
- `nonProductionCosts` phân bổ vào bậc 4 theo `revenueShare` (tỷ trọng doanh thu
  VF — xem `pricing-chain.md`).

## Khóa tham số theo vai
Toàn bộ `CostPool` (trừ `markup` và `currency` — pricing cần chỉnh khi đàm phán)
chỉ `admin` ghi, khớp danh sách 14 field khóa hiện có trong prototype
(`labCost`, `testUL`, `compliance`, `rent`). `markup`/`currency` cho phép
`pricing`/`admin` ghi (là biến chiến lược T2/T3, không phải hạ tầng SX).
