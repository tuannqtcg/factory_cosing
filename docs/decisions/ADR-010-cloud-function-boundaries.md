# ADR-010: Ranh giới Cloud Function cho ScenarioOutput / Plan / Target Costing

Ngày: 2026-07-06 | Trạng thái: CHẤP NHẬN

## Bối cảnh
`docs/contracts/scenario.md` §5 quy định 4 doc `outputs/*` đều do Cloud
Function tính (client không ghi trực tiếp, đã khóa ở `firestore.rules` M12.3).
Nhưng 3 doc này KHÔNG cùng một "sự kiện kích hoạt":
- `outputs/internal` + `outputs/priceList`: hàm THUẦN của `ScenarioInput` —
  `calculateScenario()` (M12.1, `src/engine/scenario.ts`) đã đủ để tính cả 2,
  không cần input nào khác. Kích hoạt tự nhiên: mỗi lần `scenarios/{id}` đổi.
- `outputs/plan`: theo bảng §5, "Cloud Function tính; `production` ghi
  `PlanInput` ở doc riêng `scenarios/{id}/planInputs/{period}`" — kích hoạt
  KHÁC (ghi `planInputs/{period}`, không phải ghi `scenarios/{id}`).
- `outputs/targetCosting`: "Cloud Function tính từ request `pricing`/`admin`"
  — đây là hành động RỜI RẠC, chủ động (không phải phản ứng theo write của 1
  doc lưu trữ liên tục), giống lời gọi hàm hơn là đổi trạng thái.

Khi bắt tay code M12.4 (dự kiến làm cả 4 doc trong 1 `onScenarioWrite`), phát
hiện 2 khoảng trống KHÔNG THỂ lấp bằng cách "nối dây" đơn thuần — cần quyết
định kiến trúc thay vì tự phát minh:
1. **Plan_SX chưa được orchestrate**: `calculateScenario()` không gọi
   `calculatePlan()` (M9, `src/engine/plan.ts`). `calculatePlan()` cần
   `moldSetCountBySizeDN: Record<number, number>` — số bộ khuôn theo size DN —
   nhưng KHÔNG CÓ hàm nào trong repo dẫn xuất giá trị này từ
   `Resource.fitting.moldAssets` + `Product[]` (comment gốc ở `plan.ts` dòng
   13-16 đã nói rõ: "để tầng orchestration cấp" — nhưng tầng orchestration
   [`scenario.ts`] chưa từng làm việc này). `calculatePlan()` cũng cần
   `pipe.cost`/`fitting.cost`/`pipe.cvp` (kiểu `PipeCostAtNormalCapacity`,
   `FittingCostAtNormalCapacity`, `PipeCvp` — object NỘI BỘ của
   `calculateScenario()`, không xuất hiện trong `ScenarioOutput` công khai).
2. **T3 (`TargetPriceRequestSchema`) thiếu trường chọn SKU**: schema đóng băng
   (`scenario.md` §4) chỉ có `scenarioId, productLine, targetListPriceVnd,
   freeVarPath, isPenetrationPrice` — không có cách xác định dò giá cho SKU
   nào trong `skuPriceChains[]` (Ống: theo `dn`; Phụ kiện: theo
   `productName`+`sizeLabel`). Test `tests/parity/solver.test.ts` (M10) chỉ
   verify solver ở mức `pipe.ts`+`price-ladder.ts` trực tiếp (input tự dựng),
   CHƯA từng chạy solver trên `calculateScenario()` với SKU cụ thể.

## Quyết định
Tách M12.4 thành 3 phần độc lập, mỗi phần 1 Cloud Function riêng, KHÔNG gộp
chung 1 hàm:

1. **M12.4 (phần này)** — `onScenarioWrite` (Firestore trigger `onWrite` trên
   `scenarios/{id}`): tính `outputs/internal` + `outputs/priceList`. Đây là
   phần DUY NHẤT không có khoảng trống thiết kế — làm ngay.
2. **M12.4b (hoãn)** — `onPlanInputWrite` (Firestore trigger `onWrite` trên
   `scenarios/{id}/planInputs/{period}`): tính `outputs/plan`. Cần làm TRƯỚC
   khi code: viết hàm `deriveMoldSetCountBySizeDN(moldAssets, products):
   Record<number, number>` trong `src/engine/` (đếm số `MoldAsset` mà
   `producesSkus` trỏ tới ít nhất 1 `FittingProduct` có `moldSizeDN` = size đó
   — 1 `MoldAsset` = 1 bộ khuôn, khớp đúng ý nghĩa "bộ" trong
   `moldSetCountBySizeDN`) + export các kiểu cost/cvp trung gian cần thiết từ
   `calculateScenario()` (hoặc để `onPlanInputWrite` tự gọi lại
   `calculatePipeCostAtNormalCapacity`/`calculateFittingCostAtNormalCapacity`/
   `calculatePipeCvp` — CHẤP NHẬN gọi lại vì đây vẫn là dùng lại NGUYÊN hàm
   pure có sẵn, không viết công thức mới, chỉ là gọi 2 lần thay vì tái dùng
   kết quả `calculateScenario()` đã tính — đánh đổi hợp lý để giữ
   `calculateScenario()` không phải "biết" về Plan_SX).
3. **M12.4c (hoãn)** — HTTPS Callable `computeTargetCosting` (KHÔNG dùng
   Firestore trigger — đây là hành động rời rạc theo yêu cầu `pricing`/`admin`,
   giống lời gọi hàm request/response hơn là phản ứng theo thay đổi 1 doc lưu
   trữ liên tục, nên chọn `onCall` thay vì `onDocumentWritten` trên 1 collection
   "request" phải tự phát minh). T2 (`solveTargetProfit`, dạng đóng) làm được
   ngay vì không cần chọn SKU (chỉ cần `productLine`). T3 (`solve()`, cần chọn
   SKU) BỊ CHẶN bởi khoảng trống #2 ở trên — cần bổ sung field chọn SKU vào
   `TargetPriceRequestSchema` (đóng băng Pha 2) trước, đúng quy trình ADR-009
   (ghi vào bảng đó, không tự thêm field ngầm).

## Hệ quả
- `docs/M12_PLAN.md` bảng trạng thái: M12.4 tách 3 dòng con (M12.4/M12.4b/M12.4c).
- `firestore.rules` (M12.3) đã đúng cho cả 3 trường hợp — không cần sửa: mọi
  `outputs/*` đều `allow write: if false` cho client, bất kể Cloud Function nào
  ghi (Admin SDK bỏ qua rules).
- Khi làm M12.4b: thêm 1 dòng vào bảng ADR-009 (hàm mới
  `deriveMoldSetCountBySizeDN`) nếu cần sửa schema, hoặc ghi rõ đây là hàm
  ENGINE mới (không phải sửa schema) nên không cần dòng ADR-009.
- Khi làm M12.4c (T3): sửa `TargetPriceRequestSchema` cần ADR riêng (không
  phải chỉ ADR-009 "bổ sung field thiếu sót" — đây là bổ sung khả năng MỚI,
  chọn SKU, chưa từng có trong thiết kế Pha 2) hoặc ghi thêm vào chính ADR này.
