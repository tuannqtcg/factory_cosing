# ADR-063 — Tốc độ hiệu dụng dòng Ống có TRỌNG SỐ theo tỷ lệ đáy khi ≥2 material chạy chung máy

- **Ngày**: 2026-07-31
- **Trạng thái**: Chấp nhận (user phiên 2026-07-31)
- **Kế thừa**: ADR-047/048/054 (`pipeCostMethod: 'kg' | 'meters'`, tốc độ hiệu dụng suy từ `capacityMetersPerHour × unitWeightKgPerM`), ADR-055 (tỷ lệ đáy `productionMixPipePrimaryPct` — % thời gian máy dành cho material chính)

## Bối cảnh

Nhà máy dùng CHUNG 1 dây chuyền đùn để sản xuất cả BlazeMaster và Corzan (2 dòng SP khác material, cùng máy). User chỉ ra: ống Corzan các Schedule SCH40/SCH80 có đơn trọng (kg/m) khác BlazeMaster ở cùng size DN ⇒ với cùng tốc độ đùn (m/giờ), 2 material cho ra sản lượng kg/giờ KHÁC NHAU. Trước ADR này, `effectivePipeFinishedKgPerHour()` (method `'meters'`) chỉ tính bình quân đơn giản tốc độ (m/giờ × đơn trọng) trên TOÀN BỘ SKU của MỌI material gộp chung — không phản ánh máy đang thực sự dành bao nhiêu % thời gian cho material nào. Trong khi đó, slider tỷ lệ đáy (`productionMixPipePrimaryPct`, ADR-055, đã có sẵn ở CeoPlannerScreen) mới chỉ dùng để chia DOANH THU/chi phí giữa 2 material theo % kg, chưa hề tác động ngược lại tốc độ hiệu dụng của máy — tức đổi slider không làm đổi công suất (kg/năm), chỉ đổi cách chia số đã cố định. User yêu cầu nối 2 việc này lại: tỷ lệ đáy phải là TRỌNG SỐ thật khi tính tốc độ hiệu dụng.

Số đo tốc độ thật (m/giờ) theo từng material/size hiện CHƯA có — user xác nhận sẽ tự nhập sau qua cột "CS đùn (m/giờ)" đã có sẵn ở Danh Mục Sản Phẩm ("Sẽ để mock up dữ liệu đó và tôi sửa sau"). ADR này chỉ xây NĂNG LỰC TÍNH TOÁN (engine), dùng dữ liệu mock/property test để verify công thức đúng hướng; số liệu thật nhập tay sau không cần đổi code.

## Quyết định

1. **`src/engine/pipe.ts`** — thêm interface `PipeMaterialMix { primaryMaterialId: string; primaryFrac: number }` và tham số `mix?: PipeMaterialMix` (optional, cuối danh sách tham số — parity-safe) cho cả `effectivePipeFinishedKgPerHour()` và `effectivePipeCapacity()`.
   - Không truyền `mix` (hoặc chỉ 1 material trong danh sách SKU) ⇒ hành vi CŨ nguyên vẹn: bình quân đơn giản mọi SKU (parity tuyệt đối với ADR-048).
   - Có `mix` VÀ ≥2 material ⇒ tách SKU thành 2 nhóm (material chính khớp `primaryMaterialId`, còn lại gộp là "phụ"), lấy bình quân riêng từng nhóm, rồi trộn theo trọng số:
     ```
     effectiveKgPerHour = primaryFrac × avg(rate của SKU material chính) + (1 − primaryFrac) × avg(rate của SKU các material còn lại)
     ```
   - Chỉ áp dụng khi `pipeCostMethod === 'meters'` (giữ nguyên ranh giới ADR-047 — `'kg'` không bao giờ dùng đường này).

2. **6 call site** gọi `effectivePipeCapacity()` được nối với tỷ lệ đáy hiện có của scenario/context tương ứng (material tham chiếu = phần tử đầu `materials[]` của dòng Ống, đúng quy ước ADR-012):
   - `scenario.ts` (orchestrator chính) — `pipeMix = { primaryMaterialId: pipeMaterialIds[0], primaryFrac: (input.productionMixPipePrimaryPct ?? 100) / 100 }`.
   - `dashboard-support.ts` — 2 chỗ (tính công suất chính + vòng lặp mô phỏng `capacityLevels` 3 ca).
   - `plan-support.ts` (`calculatePlanForScenario`) — dùng `pipeRefMaterial.id` sẵn có.
   - `ceo-planner.ts` (`calculateCeoPlanner`) — tái dùng `allocPipe` (đã tính từ slider CEO Planner) làm `primaryFrac`, di chuyển phép tính lên sớm hơn để dùng chung thay vì tính lại.
   - `product-mix.ts` (`readLine`) — dùng `baseline.productionMixPipePrimaryPct`.

   Mọi call site đều dùng CHUNG 1 hàm `effectivePipeCapacity()` (đã có từ ADR-048) — không nhân bản logic, đảm bảo không lệch số giữa các màn (Dashboard/CEO Planner/Plan_SX/Product-mix) như ghi chú gốc trong `scenario.ts`.

3. Mặc định `productionMixPipePrimaryPct` (khi thiếu) = 100 — tức 100% material chính, khớp hành vi baseline hiện có (chỉ 1 material) không đổi.

## Không phải "số vàng" Excel — verify bằng property test

Excel gốc không có khái niệm 2 material chung máy (ADR-012 mới thêm Corzan sau). Verify bằng:

- `tests/unit/pipe-material-mix.test.ts` (7 test, hàm `pipe.ts` cô lập) — dùng mock BlazeMaster (đơn trọng 0.29 kg/m) vs mock Corzan (0.319 kg/m, ×1.1 đúng `CORZAN_PIPE_WEIGHT_FACTOR` đã dùng khi mirror SKU ở `ProductsScreen.tsx`), cùng `capacityMetersPerHour: 400`. Khớp tay: `primaryFrac=0.7 ⇒ 0.7×116 + 0.3×127.6 = 119.48 kg/giờ`. Biên: `method='kg'` luôn `undefined` dù có mix; 1 material ⇒ mix vô nghĩa = bình quân đơn giản (parity); `primaryFrac=1/0` ⇒ đúng bằng tốc độ riêng material tương ứng, bỏ qua material kia.
- `tests/parity/pipe-cost-method.test.ts` (describe `ADR-063`, 4 test MỚI, đi qua NGUYÊN VẸN `calculateScenario()` — không gọi thẳng `pipe.ts`, để xác nhận việc nối dây vào orchestrator có tác dụng thật): dùng `buildCorzanScenarioInput()` + `capacityMetersPerHour: 400` cho mọi size cả 2 material + `pipeCostMethod: 'meters'`.
  - 100% BlazeMaster → công suất Ống THẤP hơn 100% Corzan (Corzan nặng hơn/mét).
  - 50/50 nằm GIỮA 2 thái cực (đơn điệu, không nhảy bậc).
  - Không truyền `productionMixPipePrimaryPct` ⇒ khớp truyền tường minh 100 (mặc định parity-safe).
  - `pipeCostMethod: 'kg'` ⇒ đổi tỷ lệ đáy KHÔNG ảnh hưởng công suất (nhánh mix chỉ có tác dụng ở `'meters'`).

Suite 427/427 (416 cũ + 7 unit mix + 4 integration mới), typecheck + build xanh.

## Còn treo

- Chưa có số đo `capacityMetersPerHour` thật cho Corzan (fixture `corzan.json` hiện không set field này, hưởng fallback đơn giản) — user sẽ tự đo và nhập tay qua UI có sẵn (cột "CS đùn (m/giờ)", ProductsScreen.tsx); không cần đổi code khi có số thật.
- ADR pipe packaging (túi ni lông theo mét/kg, treo từ phiên phân tích bao bì trước) vẫn đang chờ dữ liệu thực tế "1kg túi bao nhiêu mét", không thuộc phạm vi ADR này.
