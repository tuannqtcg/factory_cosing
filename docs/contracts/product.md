# Contract: Product (src/schemas/product.ts)

> Pha 2 — ĐÓNG BĂNG sau khi user duyệt. Sửa cấu trúc field ở đây bắt buộc phải có
> ADR mới (AGENTS.md luật #5).
> Nguồn nghiệp vụ: ADR-001 (driver theo loại SP), ADR-007 (managementStatus —
> quyết định bổ sung), ADR-008 (BOM ren kim loại).

## Nguyên tắc

`Product` = 1 SKU bán được, discriminated union theo `kind`. Ống định danh theo
`dn` (8 size); Phụ kiện định danh theo `(productName, sizeLabel)` — KHÔNG dùng
1 id số nguyên, vì Excel/PDF gốc và mọi fixture đều tra cứu theo cặp tên+size.

## Schema

```ts
import { z } from 'zod';

// ── pipe (Ống) ────────────────────────────────────────────────────────────
export const PipeProductSchema = z.object({
  kind: z.literal('pipe'),
  dn: z.string(),                 // "DN20".."DN100" — 8 giá trị cố định v1
  spec: z.string(),               // "SDR 13.5" — nhãn kỹ thuật, hiển thị PriceList
  odMm: z.number().positive(),
  minWallThicknessMm: z.number().positive(),
  unitWeightKgPerM: z.number().positive(),
});
export type PipeProduct = z.infer<typeof PipeProductSchema>;

// ── fitting (Phụ kiện) ────────────────────────────────────────────────────
// BOM ren kim loại (ADR-008) — CHỈ có ở SKU họ "Nối ren trong/ngoài" (11/91
// hiện tại). optional vì 80 SKU còn lại không có dòng nguyên liệu thứ 2.
const MetalInsertBomSchema = z.object({
  renType: z.enum(['trong', 'ngoài']),
  ptSize: z.string(),             // tra tới PricingChain.metalInsertCatalog[renType,ptSize]
  insertQtyPerUnit: z.number().int().positive(), // = 1 cho toàn bộ 11 SKU hiện có (xác nhận ADR-008); KHÔNG mặc định = 1 ngầm, phải ghi rõ khi thêm SKU ren mới
});

export const FittingProductSchema = z.object({
  kind: z.literal('fitting'),
  productName: z.string(),        // "Tê đều", "Nối ren trong"...
  sizeLabel: z.string(),          // "20", "25xPT15"...
  unit: z.string(),                // "Cái"
  schedule: z.string().optional(), // "SCH40" — optional: không phải mọi SKU đều cần ghi lại (đã ngụ ý trong mold)
  moldSizeDN: z.number().int().positive(),
  cycleTimeSec: z.number().positive(),
  cavity: z.number().int().positive(),
  unitWeightKg: z.number().positive(),
  metalInsert: MetalInsertBomSchema.optional(),
});
export type FittingProduct = z.infer<typeof FittingProductSchema>;

export const ProductSchema = z.discriminatedUnion('kind', [
  PipeProductSchema,
  FittingProductSchema,
]);
export type Product = z.infer<typeof ProductSchema>;
```

## `managementStatus` — KHÔNG phải field lưu trữ (ADR-007 quyết định bổ sung)

```ts
type ManagementStatus = 'active' | 'pending_mold';

function managementStatusOf(product: FittingProduct, moldAssets: MoldAsset[]): ManagementStatus {
  const hasMold = moldAssets.some(m =>
    m.producesSkus.some(s => s.productName === product.productName && s.sizeLabel === product.sizeLabel)
  );
  return hasMold ? 'active' : 'pending_mold';
}
```

Lý do KHÔNG lưu field này trên `Product`: nếu lưu, mọi lần thêm/xóa `MoldAsset`
phải nhớ đồng bộ tay field này ở 1 chỗ khác → đúng lỗi kép mà prototype Pha 1
đang mắc phải (`EXCLUDED_SKUS` phải sửa tay song song `mold-assets.json`, ghi rõ
trong ADR-007 "còn treo"). Đưa vào Pha 3 = tính toán 1 lần trong engine (pure
function trên `moldAssets` + `products`), không phải trạng thái đồng bộ tay.
`pipe` không cần hàm này — 8 DN ống đều `active` (ống không có khái niệm khuôn
theo SKU, xem `resource.md`).

**Áp dụng**: mọi UI/API liệt kê danh mục Phụ kiện đang vận hành (Bảng Giá, Kế
Hoạch SX, bảng giá SKU) PHẢI lọc `managementStatus === 'active'` — thay thế
đúng cơ chế `EXCLUDED_SKUS` thủ công trong prototype Pha 1.

## Vai trò & phân quyền
`Product` (BOM/master data) chỉ `admin` ghi. Đọc: mọi vai đọc được phần
non-cost (`productName`, `sizeLabel`, `unit`, `dn`...) — các field liên quan chi
phí (`unitWeightKg`, `cycleTimeSec`, `cavity`, `moldSizeDN`) KHÔNG lộ ra ngoài
doc mà `sales` có quyền đọc (xem tách doc ở `scenario.md`).
