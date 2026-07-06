# Contract: PricingChain (src/schemas/pricing-chain.ts)

> Pha 2 — ĐÓNG BĂNG sau khi user duyệt. Sửa cấu trúc field ở đây bắt buộc phải có
> ADR mới (AGENTS.md luật #5).
> Nguồn nghiệp vụ: ADR-002 (giá vốn kép), ADR-004 (khóa bảng giá), ADR-008 (khóa
> giá + tồn kho ren kim loại), BUSINESS_MODEL.md §1a, §4, §5.

## ⚠ Phát hiện cần xử lý trước khi migrate fixture vào schema này

`assumptions.json.priceLock.thresholdPct = 0.03` (dạng THẬP PHÂN, 3%) nhưng
`metal-insert.json.insertCatalog[].priceLock.thresholdPct = 5` (dạng SỐ NGUYÊN
%, không phải 0.05). Hai fixture hiện tại dùng 2 đơn vị khác nhau cho cùng 1 tên
field. Schema này CHỐT đơn vị THẬP PHÂN cho toàn hệ thống (khớp quy ước gốc
ADR-004/Excel). Khi viết code Pha 3 đọc `metal-insert.json`, PHẢI chuyển
`thresholdPct: 5` → `0.05` tại lớp migrate fixture → domain object, không sửa
số liệu gốc trong file (giữ nguyên để đối chiếu nguồn `Gia_phu_kien_ren.pdf`).

## Nguyên tắc thiết kế: input (chính sách) tách khỏi output (đánh giá)

`baseline` + `thresholdPct` là CẤU HÌNH — chỉ đổi khi user chủ động "chốt lại
baseline" (có audit, ADR-004). `replacement`, `deviationPct`, `isLocked`,
`pricingPrice` là GIÁ TRỊ TÍNH RA mỗi lần engine chạy (phụ thuộc giá thị trường
hiện hành nhập ở tồn kho) — KHÔNG lưu, thuộc `ScenarioOutput`.

## Schema — Price Lock (dùng chung compound USD & ren kim loại VND)

```ts
import { z } from 'zod';

// amountSchema: z.number() cho USD (4 số lẻ) hoặc z.number().int() cho VND
const makePriceLockPolicySchema = <T extends z.ZodTypeAny>(amountSchema: T) =>
  z.object({
    baseline: amountSchema,
    thresholdPct: z.number().min(0).max(1), // THẬP PHÂN — 0.03 = 3%, 0.05 = 5% (xem cảnh báo trên)
  });

export const CompoundPriceLockPolicySchema = makePriceLockPolicySchema(z.number().nonnegative()); // USD/kg
export const MetalInsertPriceLockPolicySchema = makePriceLockPolicySchema(z.number().int().nonnegative()); // VND/cái

// Output — KHÔNG lưu, tính lại mỗi lần forward:
const makePriceLockEvaluationSchema = <T extends z.ZodTypeAny>(amountSchema: T) =>
  z.object({
    replacement: amountSchema,
    deviationPct: z.number(),        // replacement/baseline − 1
    isLocked: z.boolean(),
    pricingPrice: amountSchema,      // |deviation| > threshold ? replacement : baseline
    stalenessWarning: z.string().nullable(), // so với lô nhập gần nhất, null = không cảnh báo
  });
export const CompoundPriceLockEvaluationSchema = makePriceLockEvaluationSchema(z.number().nonnegative());
export const MetalInsertPriceLockEvaluationSchema = makePriceLockEvaluationSchema(z.number().int().nonnegative());
```

## Schema — Tồn kho compound (Ống/Phụ kiện, ADR-002)

```ts
export const InventoryLotSchema = z.object({
  tons: z.number().nonnegative(),
  priceUsdPerKg: z.number().nonnegative(),
});

export const CompoundInventorySchema = z.object({
  lots: z.array(InventoryLotSchema).max(5), // Excel giữ tối đa 5 đợt nhập gần nhất
  priceLock: CompoundPriceLockPolicySchema, // baseline/threshold cho bảng giá dòng SP này
});
export type CompoundInventory = z.infer<typeof CompoundInventorySchema>;
```

Output tính ra: `weightedAvgUsdPerKg = Σ(tons×priceUsdPerKg)/Σtons`,
`totalInventoryKg`, `holdingGainLossVnd` (công thức BUSINESS_MODEL.md §5),
`provisionWarning` (cảnh báo VAS 02 khi `replacement < weightedAvg`).

## Schema — Tồn kho ren kim loại (ADR-008, granularity theo `(renType, ptSize)`, KHÔNG theo SKU)

```ts
export const MetalInsertLotSchema = z.object({
  qtyOnHand: z.number().int().nonnegative(),
  unitPriceVnd: z.number().int().nonnegative(),
});

export const MetalInsertCatalogEntrySchema = z.object({
  renType: z.enum(['trong', 'ngoài']),
  ptSize: z.string(),
  lots: z.array(MetalInsertLotSchema).max(5), // đối xứng compound — nhiều đợt nhập
  priceLock: MetalInsertPriceLockPolicySchema, // ĐỘC LẬP với compound (ADR-008 mục 6)
});
export type MetalInsertCatalogEntry = z.infer<typeof MetalInsertCatalogEntrySchema>;

export const MetalInsertCatalogSchema = z.array(MetalInsertCatalogEntrySchema);
```

Output tính ra: `weightedAvgPriceVnd`, `inventoryQtyOnHand`, `inventoryValueVnd`,
`holdingGainLossVnd` — CÙNG công thức ADR-002, không viết công thức riêng
(ADR-008 mục 4). Tra cứu giá cho 1 SKU: `Product.fitting.metalInsert →
(renType, ptSize) → MetalInsertCatalogEntry` (xem `product.md`).

## Schema — Thang giá 5 bậc (BUSINESS_MODEL.md §4) — OUTPUT thuần, không lưu

```ts
export const PriceLadder5TierSchema = z.object({
  variableCostFloor: z.number(),      // bậc 1 — ranh đỏ
  cashBreakEven: z.number(),          // bậc 2 — loại khấu hao khỏi định phí
  breakEvenFullCost: z.number(),      // bậc 3 — giá vốn chuẩn TT200
  enterpriseBreakEven: z.number(),    // bậc 4 — phân bổ theo tỷ trọng DOANH THU VF, không theo kg
  targetPrice: z.number(),            // bậc 5 — = giá VF
});
```

`enterpriseBreakEven` cần `revenueShare` tính CHÉO cả 2 dòng SP tại giá VF —
KHÔNG được tách hàm riêng theo từng dòng (lưu ý đã ghi trong session log Phiên 5:
2 lỗi công thức từng phát sinh đúng ở bậc 2 và 4 vì tách nhầm).

## Schema — Chuỗi markup theo SKU (BUSINESS_MODEL.md §2.3, §3.4) — OUTPUT thuần

```ts
export const SkuPriceChainSchema = z.object({
  materialCostPerUnit: z.number(),
  processingCostPerUnit: z.number(), // = 0 hoặc N/A cho Ống (Ống tính theo /m, không theo processing riêng — xem BUSINESS_MODEL §2.3)
  breakEvenPerUnit: z.number(),
  vfPricePerUnit: z.number(),
  tcgPricePerUnit: z.number(),
  listPriceBeforeVat: z.number().int(),
  listPriceWithVat: z.number().int(),
});
```

Áp dụng cho cả `pipe` (đơn vị = mét) và `fitting` (đơn vị = cái) — cùng field
name, khác đơn vị tính đã ẩn trong `Product.unit`.

## Vai trò & phân quyền
- `PriceLadder5TierSchema` + `SkuPriceChainSchema` (chỉ 4 field cuối:
  `vfPricePerUnit`/`tcgPricePerUnit`/`listPriceBeforeVat`/`listPriceWithVat`):
  đọc được bởi MỌI vai kể cả `sales` — đây là doc "Bảng Giá" công khai nội bộ.
- `materialCostPerUnit`, `processingCostPerUnit`, `breakEvenPerUnit`, toàn bộ
  `CompoundInventory`/`MetalInsertCatalog` (giá vốn, tồn kho, dual costing):
  CẤM `sales` đọc (PROJECT_SPEC §5) — nằm ở doc riêng, xem tách doc ở
  `scenario.md`.
- Sửa `baseline` (chốt lại bảng giá sau khi mở khóa): `pricing`/`admin`, có
  audit log (ai chốt, lúc nào, giá cũ/mới).
- Sửa `thresholdPct`: `admin` only (thay đổi khẩu vị rủi ro, không phải quyết
  định giá hàng ngày).
