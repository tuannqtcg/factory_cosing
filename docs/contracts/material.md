# Contract: Material (src/schemas/material.ts — CHƯA TỒN TẠI, viết ở Pha 3 sau đóng băng)

> Pha 2 — **CHỜ ĐÓNG BĂNG** (user duyệt layout prototype 2026-07-07; contract
> này cần user xác nhận "đóng băng" trước khi code Pha 3). Sửa cấu trúc field
> sau đóng băng bắt buộc có ADR mới (AGENTS.md luật #5).
> Nguồn nghiệp vụ: ADR-012 (multi-material), tái dùng ADR-002 (giá vốn kép),
> ADR-004 (khóa bảng giá). Prototype tham chiếu:
> `prototype/multi-material-catalog.html`.

## Nguyên tắc

`Material` = danh tính thương mại + tham số landed cost + markup VF + tồn
kho/khóa giá của MỘT loại compound. Mọi cơ chế giá (khóa ADR-004, bình quân gia
quyền ADR-002, staleness) TÁI DÙNG nguyên schema/công thức hiện có — entity này
chỉ là CHỖ CHỨA mới theo nguyên liệu thay vì theo dòng sản xuất.

Ren kim loại (ADR-008) KHÔNG thuộc Material — giữ nguyên
`MetalInsertCatalogSchema` (granularity theo renType/ptSize, mua VND nội địa).

## Schema

```ts
import { z } from 'zod';
import { CompoundInventorySchema } from './pricing-chain.js';

export const MaterialSchema = z.object({
  id: z.string(),            // slug ổn định: 'bm-orange-pipe' | 'bm-fitting' | 'corzan-pipe' | 'corzan-fitting'
  name: z.string(),          // nhãn hiển thị: "Corzan 3710 (ống)"
  code: z.string(),          // mã nội bộ: "CZ-3710-P"
  originLabel: z.string(),   // "EU" | "Ấn Độ (AIFTA)" — nhãn hiển thị, không phải enum (nguồn nhập có thể đổi)
  // Landed cost RIÊNG từng nguyên liệu (ADR-012 quyết định #1 — trước đây là
  // CurrencyParams.compoundImportTaxRate/customsLogisticsFeeRate chung):
  importTaxRate: z.number().min(0).max(1),          // BlazeMaster 0.06 (EU); Corzan 0 (AIFTA C/O form AI)
  customsLogisticsFeeRate: z.number().min(0).max(1),// hiện cùng 0.01 cho mọi nguyên liệu, vẫn để theo material vì phí thực tế theo tuyến vận chuyển
  // Markup VF RIÊNG (ADR-012 quyết định #2 — trước đây là MarkupChain.markupVfPipe/markupVfFitting):
  markupVf: z.number().min(0), // BlazeMaster ống 0.25, phụ kiện 0.40; Corzan: CHỜ SỐ TỪ USER (tạm placeholder = BlazeMaster)
  // Tồn kho + khóa giá — TÁI DÙNG NGUYÊN schema ADR-002/004, không thêm field:
  inventory: CompoundInventorySchema, // { lots[], priceLock{baseline,thresholdPct}, replacementPriceUsdPerKg }
});
export type Material = z.infer<typeof MaterialSchema>;
```

Không có field optional nào — mọi Material bắt buộc khai đủ landed cost +
markup (anti-pattern "optional để linh hoạt" bị cấm theo skill schema-design).

## Thay đổi lan sang các contract đã đóng băng (cần duyệt cùng lúc)

| Contract | Thay đổi | Lý do |
|---|---|---|
| `product.md` | `PipeProductSchema` + `FittingProductSchema` thêm `materialId: z.string()` (bắt buộc) | ADR-012 quyết định #2 — mỗi SP trỏ về 1 compound; validate materialId tồn tại ở tầng parse ScenarioInput (refine) |
| `scenario.md` | `ScenarioInput` thêm `materials: z.array(MaterialSchema).min(1)`; BỎ `inventory.pipe` + `inventory.fitting` (tồn kho nằm trong Material); `inventory.metalInsert` GIỮ NGUYÊN | Tồn kho compound giờ theo nguyên liệu, không theo dòng SX |
| `cost-pool.md` | `CurrencyParamsSchema` BỎ `compoundImportTaxRate` + `customsLogisticsFeeRate`; `MarkupChainSchema` BỎ `markupVfPipe` + `markupVfFitting`, GIỮ `markupTcg` + `listPriceMargin` (chính sách kênh chung mọi nguyên liệu) | Chuyển vào Material; nếu user muốn TCG/margin niêm yết riêng cho Corzan → sửa TRƯỚC khi đóng băng |
| `scenario.md` (output) | `priceLock.pipe\|fitting` → `priceLock.byMaterial: [{materialId, evaluation}]`; `dualCosting.pipe\|fitting` → `dualCosting.byMaterial: [{materialId, bookCostPerKg, holdingGainLossVnd, provisionWarning}]`; `priceLadder.pipe\|fitting` → `priceLadder.byLineMaterial: [{line: 'pipe'\|'fitting', materialId, ladder}]`; `cvp` tương tự theo (line, materialId) | Mỗi nguyên liệu có khóa/kho/thang giá riêng; công thức từng bậc KHÔNG đổi (chỉ giá compound đầu vào theo material); phần chi phí gia công/định phí của line dùng chung như cũ |
| `scenario.md` (Plan) | `PlanResult.materialRequirement.pipe\|fitting` → `byMaterial: [{materialId, kgToBuy, vndValue, usdValueAtRawReplacement}]` | Kế hoạch mua/LC tách theo nguyên liệu; vẫn dùng replacement THÔ (ADR-004) |

Chi tiết công suất (`capacity`), `mhrPerMachineHour`, phân bổ chi phí chung
theo kg 2 dòng: KHÔNG ĐỔI (ADR-012 quyết định #3 — chung line).

Lưu ý tính `estimatedProductionKgYear` (ADR-011): năng suất mix bottom-up tính
từ TOÀN BỘ FittingProduct (mọi nguyên liệu) vì các SKU chạy chung giờ máy của
line — không tách theo material.

## Migration (Pha 3, kèm parity test làm cổng)

1. Sinh 2 Material mặc định từ dữ liệu hiện hành:
   `bm-orange-pipe` {3,03; 6%; 1%; markupVf 0,25; kho 10t@3,03}
   `bm-fitting` {3,85; 6%; 1%; markupVf 0,40; kho 10t@3,85}.
2. Gán `materialId` cho 8 DN ống → `bm-orange-pipe`, 91 SKU phụ kiện →
   `bm-fitting`.
3. Chạy toàn bộ parity suite: mọi số vàng v3.7 PHẢI khớp tuyệt đối (bằng chứng
   tổng quát hóa không đổi nghiệp vụ).
4. Corzan nhập vào như dữ liệu MỚI (2 Material giá 3,47/3,97, thuế 0%, kho
   rỗng) — chưa có SKU cho tới khi user cung cấp danh mục.

## Vai trò & phân quyền

- Đọc danh mục Material (kể cả giá vốn, tồn kho, khóa giá): `admin`, `pricing`,
  `production` (cần cho kế hoạch mua NVL). CẤM `sales` (PROJECT_SPEC §5 — sales
  không bao giờ thấy chi phí gốc).
- Thêm/sửa Material (giá tái tạo, thuế, markup): `pricing`/`admin`.
- Chốt lại `baseline` sau mở khóa: `pricing`/`admin`, có audit (ADR-004).
- Sửa `thresholdPct`: `admin` only.
- Đổi gán `Product.materialId`: `admin` only (đổi bản chất giá thành sản phẩm,
  không phải thao tác định giá hàng ngày).

## Còn chờ user trước khi đóng băng

1. % markup VF Corzan (ống + phụ kiện) — hiện placeholder 25%/40%.
2. Xác nhận `markupTcg` 30% + `listPriceMargin` 30% dùng CHUNG cho Corzan.
3. Xác nhận thuế NK 0% với forwarder (mã HS con Corzan 3710, C/O form AI).
4. Danh mục SKU Corzan (đơn trọng/chu kỳ/cavity/khuôn) + tồn kho ban đầu.
