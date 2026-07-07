# Contract: Material (src/schemas/material.ts)

> Pha 2 — **ĐÓNG BĂNG 2026-07-07** (user: "duyệt đóng băng, markup như đề
> xuất"). Sửa cấu trúc field bắt buộc có ADR mới (AGENTS.md luật #5).
> Nguồn nghiệp vụ: ADR-012 (multi-material), tái dùng ADR-002 (giá vốn kép),
> ADR-004 (khóa bảng giá). Prototype tham chiếu:
> `prototype/multi-material-catalog.html`.
>
> **Bổ sung khi code Pha 3 M13 (cùng ngày, kỷ luật ADR-009 — ghi tại chỗ thay
> vì ADR mới vì cùng phạm vi ADR-012):**
> 1. `PlanInputSchema.pipePlan[]/fittingPlan[]` thêm `materialId` optional —
>    khóa `(dn)` và `(productName, sizeLabel)` KHÔNG còn duy nhất khi
>    BlazeMaster/Corzan trùng tên/size (cùng khuôn); bỏ trống = khớp SP đầu
>    tiên theo thứ tự `products[]` (= BlazeMaster sau migration).
> 2. `ScenarioOutput` chốt hình dạng cuối: `cvp.byLineMaterial` là
>    discriminatedUnion theo `line` (2 bộ field pipe/fitting khác nhau — giữ
>    nguyên field cũ); `dualCosting.byMaterial` entry theo CẶP (materialId,
>    line) vì `bookCostPerKg` cần chi phí gia công line — `holdingGainLossVnd`
>    thuộc material, lặp nếu 1 material dùng 2 line (đọc theo materialId,
>    không cộng dồn qua line).
> 3. Quy ước "material THAM CHIẾU" của 1 line = material ĐẦU TIÊN trong
>    `materials[]` được ≥1 SP line đó dùng — dùng cho doanh thu chéo bậc 4
>    thang giá + `mhrPerMachineHour` top-level (giá trị material-independent).
>    Xấp xỉ CÓ CHỦ ĐÍCH khi chưa có mix sản lượng theo nguyên liệu — thay bằng
>    mix thực cần ADR mới.

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
  markupVf: z.number().min(0), // BlazeMaster ống 0.25, phụ kiện 0.40; Corzan: user duyệt "như đề xuất" 2026-07-07 = 0.25/0.40 (field riêng — đổi độc lập được)
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

## Trạng thái các câu hỏi (đã chốt 2026-07-07)

1. ✅ % markup VF Corzan: "như đề xuất" = ống 25% / phụ kiện 40% (field riêng
   theo Material).
2. ✅ `markupTcg` 30% + `listPriceMargin` 30% dùng CHUNG (nằm lại MarkupChain).
3. ✅ Thuế NK 0% — user XÁC NHẬN 2026-07-07 (AIFTA, C/O form AI, NĐ 122/2022).
   Vận hành: mỗi lô nhập vẫn cần C/O form AI hợp lệ để hưởng 0%.
4. ✅ Danh mục SKU Corzan: cùng tên/kích cỡ/thông số BlazeMaster; ỐNG đơn trọng
   × 1,1 theo size; PHỤ KIỆN giống hệt (chung khuôn) — rule sinh chương trình,
   xem `tests/fixtures/corzan.json._meta`. Tồn kho ban đầu = 0.
5. ✅ Nguồn chân lý Corzan: user xác nhận 2026-07-07 KHÔNG cần Excel riêng —
   logic BlazeMaster (BUSINESS_MODEL.md) áp nguyên, engine forward + rule
   corzan.json là chuẩn; đối chiếu độc lập bằng số tính tay ở corzan.test.ts.
