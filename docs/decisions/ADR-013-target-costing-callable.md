# ADR-013: HTTPS Callable `computeTargetCosting` (M12.4c) — chọn SKU cho T3, materialId cho T2, allowlist biến dò, doc `outputs/targetCosting`

Ngày: 2026-07-08 | Trạng thái: CHẤP NHẬN

## Bối cảnh
ADR-010 quyết định T2/T3 chạy qua HTTPS Callable `computeTargetCosting`
(request/response, không phải Firestore trigger) và chỉ ra khoảng trống #2:
`TargetPriceRequestSchema` (đóng băng Pha 2, `scenario.md` §4) không có cách
xác định dò giá cho SKU NÀO trong `skuPriceChains[]`. Khi bắt tay code M12.4c
lộ thêm 3 khoảng trống cùng loại (thiết kế Pha 2 viết TRƯỚC ADR-012
multi-material và trước khi solver M10 thành hình):
1. `TargetProfitRequestSchema` (T2) chỉ có `productLine` — nhưng sau ADR-012,
   CVP tính theo TỪNG (line, material): cùng dòng Ống, BlazeMaster và Corzan
   có sàn biến phí/hòa vốn khác nhau. "Lợi nhuận mục tiêu của dòng Ống" phải
   nói rõ tại nguyên liệu nào.
2. `solve()` (M10) bắt buộc `bounds` + `tol`, nhưng `TargetPriceRequestSchema`
   không có 2 field này — và KHÔNG NÊN có: client không biết dải hợp lệ của
   từng biến, và cho client tự do `freeVarPath` + bounds là lỗ hổng (goal-seek
   mọi field bất kỳ của `ScenarioInput`, kể cả field vai `pricing` không được
   ghi theo `scenario.md` §5).
3. `outputs/targetCosting` trong contract chỉ ghi "Kết quả T2/T3" — chưa chốt
   cấu trúc doc.

## Quyết định

### 1. `TargetPriceRequestSchema` thêm field `productKey` (bắt buộc) — chọn SKU cho T3
```ts
productKey: z.object({
  dn: z.string().optional(),          // Ống — bắt buộc khi productLine='pipe'
  productName: z.string().optional(), // Phụ kiện — bắt buộc khi productLine='fitting'
  sizeLabel: z.string().optional(),   // Phụ kiện — bắt buộc khi productLine='fitting'
  materialId: z.string().optional(),  // ADR-012 — bỏ trống = SKU ĐẦU TIÊN trùng khóa
})
```
Cùng hình dạng với `ScenarioOutput.skuPriceChains[].productKey` (§2) và cùng
ngữ nghĩa `materialId` optional với `PlanInputSchema` (ADR-012): bỏ trống =
khớp SKU đầu tiên theo thứ tự `products[]` (sau migration = BlazeMaster).
Mục tiêu `targetListPriceVnd` đối chiếu với `chain.listPriceBeforeVat` (giá
niêm yết trước VAT — đúng case chuẩn T3 "DN50 260.000đ/m" của skill
`inverse-solver` và test M10).

### 2. `TargetProfitRequestSchema` thêm `materialId` (optional) — T2 theo (line, material)
Bỏ trống = material THAM CHIẾU của line (material đầu tiên trong `materials[]`
được ≥1 SP của line dùng — cùng quy ước `calculateScenario()`/ADR-012).

### 3. `bounds`/`tol` KHÔNG do client cấp — allowlist biến dò phía server
Engine giữ allowlist `TARGET_PRICE_FREE_VARS` (hằng số export từ
`src/engine/target-costing.ts`); `freeVarPath` ngoài allowlist → từ chối
request. Danh sách v1 = đúng "biến giải ngược hợp lệ v1" của skill
`inverse-solver` mục 5, phần biến LIÊN TỤC, dịch sang path `ScenarioInput`:

| Biến (skill mục 5) | Path pattern | Bounds | Ghi chú |
|---|---|---|---|
| utilizationFactor | `resources.fitting.normalUtilizationFactor` | [0.05, 1] | chỉ Phụ kiện có field này |
| compoundPriceUsd | `materials.{i}.inventory.replacementPriceUsdPerKg` | [0, 20] | đi QUA khóa giá ADR-004 khi forward → f là hàm bậc thang ĐƠN ĐIỆU (phẳng trong ngưỡng ±threshold quanh baseline) — bisection vẫn đúng; nghiệm rơi vào dải khóa thì không duy nhất, `forwardOutput` là chân lý để duyệt (luật #4 skill) |
| markup từng tầng | `materials.{i}.markupVf` | [0, 2] | ADR-012 — markup VF theo material |
| markup từng tầng | `costPool.markup.markupTcg` | [0, 2] | |
| markup từng tầng | `costPool.markup.listPriceMargin` | [0, 0.9] | công thức chia `(1 − margin)` — chặn dưới 1 |

`tol` cố định 0,5 đ (< bước làm tròn 100 đ của `listPriceBeforeVat`) — mục
tiêu không rơi đúng bậc làm tròn thì `solve()` vẫn trả `feasible` với nghiệm
gần nhất, `forwardOutput` cho thấy giá thật đạt được; UI duyệt trên forward
(luật #4), không duyệt trên số solver trơ trọi.

Biến NGUYÊN `shifts` (1–3, cần `solveDiscrete()`) **HOÃN** — chưa màn hình nào
yêu cầu (M12.8 Target Costing sẽ quyết khi dựng UI), thêm sau chỉ là thêm
entry allowlist + nhánh gọi `solveDiscrete()`, không đổi cấu trúc request.

### 4. Doc `outputs/targetCosting`: GHI ĐÈ 1 doc duy nhất `{ kind, request, result }`
- `kind: 'targetProfit' | 'targetPrice'` (T2/T3), `request` = request đã parse,
  `result` = `TargetProfitResultSchema` / `TargetPriceResultSchema`.
- GHI ĐÈ mỗi request mới (đối xứng `outputs/plan` ADR-010): doc = kết quả của
  request GẦN NHẤT, phục vụ vai `admin`/`pricing` mở lại app thấy lần chạy
  cuối. Callable đồng thời TRẢ kết quả trực tiếp trong response (đúng bản chất
  request/response của ADR-010 mục 3) — client đang mở không cần đọc lại doc.
- Callable phân biệt T2/T3 bằng field đặc thù của request
  (`targetProfitVnd` ⇔ T2; `targetListPriceVnd` ⇔ T3) — 2 schema vốn rời
  nhau, KHÔNG phát minh envelope mới.

### 5. Quyền: custom claim `role` ∈ {`pricing`, `admin`}
Kiểm tra ngay đầu callable từ `request.auth.token.role` (khớp bảng
`scenario.md` §6 — cột `outputs/targetCosting` "Đọc+Ghi request" chỉ 2 vai
này). Chưa đăng nhập → `unauthenticated`; sai vai → `permission-denied`;
request sai schema/freeVarPath ngoài allowlist/SKU không tồn tại →
`invalid-argument`; scenario không tồn tại → `not-found`.

## Hệ quả
- `src/schemas/scenario.ts` + `docs/contracts/scenario.md` §4: 2 field bổ sung
  (mục 1, 2) — thêm dòng #6, #7 vào bảng ADR-009 trỏ về ADR này.
- Orchestration T2/T3 đặt ở engine pure `src/engine/target-costing.ts`
  (`computeTargetProfitForScenario`/`computeTargetPriceForScenario`) — cùng
  pattern `plan-support.ts` M12.4b: test bằng `npm test` không cần emulator,
  M12.8 (màn Target Costing) tái dùng nguyên; Cloud Function chỉ làm
  auth + I/O + parse Zod.
- `firestore.rules` không đổi: `outputs/*` đã `allow write: if false` cho
  client (M12.3), callable dùng Admin SDK.
- Khi cần biến `shifts` (M12.8): thêm entry allowlist + nhánh
  `solveDiscrete()`, ghi bổ sung vào ADR này — không cần ADR mới.
