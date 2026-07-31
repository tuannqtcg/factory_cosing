# ADR-062 — Hoà vốn doanh thu tách riêng từng dòng + bảng tóm tắt chi phí bao bì trên Dashboard

- **Ngày**: 2026-07-31
- **Trạng thái**: Chấp nhận (user phiên 2026-07-31)
- **Kế thừa**: ADR-047 (mẫu revenueShare phân bổ chi phí ngoài SX theo dòng, dùng ở bậc 4 thang giá), ADR-060 (bao bì phụ kiện theo thùng), ADR-055 (tỷ lệ đáy 2 material)

## Bối cảnh

User hỏi tại sao "Điểm hoà vốn (Doanh thu/Năm)" trên Dashboard (`enterpriseBreakEvenRevenuePerYear`) ra số lớn hơn nhiều so với suy nghĩ "hoà vốn = định phí". Sau khi giải thích công thức CVP (`FC/(P−VC)`, tức doanh thu hoà vốn PHẢI lớn hơn định phí thuần vì còn phải bù cả biến phí ở mức doanh thu đó), user tiếp tục hỏi: nếu bán 10 tỷ tiền ống (giá đã cộng margin trên giá thành đầy đủ, tức đã hồi đủ chi phí SX riêng của ống) thì có luôn lãi không?

Trả lời: **không hẳn** — vì `enterpriseBreakEvenRevenuePerYear` là ngưỡng **GỘP CẢ 2 DÒNG** theo **1 tỷ lệ số dư đảm phí bình quân** (blend từ tổng biến phí/tổng doanh thu cả ống+phụ kiện). Nếu chỉ bán ống mà không bán phụ kiện, định phí RIÊNG của dòng phụ kiện (khấu hao máy ép/khuôn) vẫn đang chạy, không được bù — nên không thể so trực tiếp "10 tỷ tiền ống" với ngưỡng gộp đó. User yêu cầu tách riêng hoà vốn theo từng dòng, kèm hiển thị lại chi phí bao bì 2 dòng (túi ni lông ống theo kg, carton phụ kiện theo cái/thùng — đã phân tích ở phiên trước, ADR-060) để đối chiếu ngay tại chỗ.

## Quyết định

1. **`InvestmentKpis`** (`src/engine/dashboard-support.ts`) thêm 4 field mới:
   - `pipeBreakEvenRevenuePerYear`, `fittingBreakEvenRevenuePerYear` — doanh thu hoà vốn RIÊNG từng dòng.
   - `pipeContributionMarginRatio`, `fittingContributionMarginRatio` — tỷ lệ đảm phí RIÊNG từng dòng (khác tỷ lệ bình quân dùng cho `enterpriseBreakEvenRevenuePerYear`).
   
   Công thức — **tái dùng nguyên cơ chế `revenueShare` đã có ở bậc 4 thang giá** (`calculatePipe/FittingPriceLadder5Tier`, price-ladder.ts), không phát minh công thức mới:
   ```
   pipeRevenueShare = pipeRevenueVf ÷ (pipeRevenueVf + fittingRevenueVf)
   pipeBreakEvenRevenuePerYear = (pipeCvp.fixedCostPerYear + nonProductionPerYear × pipeRevenueShare) ÷ pipeContributionMarginRatio
   ```
   (tương tự cho phụ kiện). Khác biệt duy nhất so với bậc 4: bậc 4 cộng phần phân bổ vào GIÁ/KG, ở đây áp cùng cách phân bổ đó vào ngưỡng DOANH THU (CVP).

2. **`PackagingCostSummary`** (interface mới) + field `packaging` trong `DashboardKpis` — đọc THẲNG cấu hình hiện hành, không tính gì thêm:
   - `packaging.pipe.packagingCostPerKgVnd` = `pipeResource.packagingCostPerKg` (luôn theo kg).
   - `packaging.fitting` = discriminated union theo `scenario.fittingPackagingMethod` (ADR-060): `'per_box'` (có `packagingBoxCostVnd`) khi bật VÀ resource có đủ dữ liệu; ngược lại `'flat_per_kg'` (parity-safe, đúng fallback đã thiết kế ở ADR-060).

3. **Dashboard.tsx** (tab "Đầu tư & Hoà vốn", mục IV) — thêm 5 Card mới cạnh "Doanh thu hòa vốn toàn DN": "Doanh thu hòa vốn — Ống", "— Phụ kiện" (kèm tỷ lệ đảm phí + doanh thu thực tế để so trực quan), "Bao bì — Ống (túi ni lông)", "Bao bì — Phụ kiện (carton)".

## Không phải "số vàng" Excel — verify bằng property test

Đây là chỉ tiêu DẪN XUẤT mới (không có trong Excel v3.4/v3.7 gốc), nên không đối chiếu số vàng như phần lớn engine — verify bằng test tính chất tự nhất quán (`tests/parity/dashboard-kpis.test.ts`):
- 2 ngưỡng hoà vốn riêng dương, hữu hạn; tỷ lệ đảm phí riêng nằm trong (0,1).
- Baseline có lãi ở CS bình thường ⇒ doanh thu THẬT mỗi dòng phải vượt hoà vốn RIÊNG của chính dòng đó (kiểm tra hướng đúng của công thức).
- 2 ngưỡng tách riêng cộng lại ≠ ngưỡng gộp (xác nhận đúng là 2 phép tính khác nhau, không phải chia đôi ngưỡng gộp).
- `packaging` đọc đúng theo 3 tình huống: mặc định flat, bật per_box có đủ dữ liệu, bật per_box thiếu dữ liệu → fallback flat.

Suite 416/416 (+8 test mới), typecheck + build xanh.

## Còn treo

- Chưa tách "Hòa vốn CVP — Ống/Phụ kiện" (đơn vị KG, đã có sẵn trước ADR này qua `pipeCvp/fittingCvp.breakEvenKgYear`) khỏi 2 thẻ DOANH THU mới — 2 khái niệm SONG SONG cùng hiển thị trên UI (kg vs tỷ đồng), có thể gây rối nếu user không phân biệt được; cân nhắc gộp trình bày rõ hơn nếu user phản hồi khó hiểu.
- Chưa có test cross-check bằng cách gọi trực tiếp `calculatePipeCvp`/`calculateFittingCvp` để xác nhận số tuyệt đối (mới chỉ verify tính chất/hướng đúng) — nếu cần độ tin cậy cao hơn, có thể tính tay 1 kịch bản đối chiếu như các milestone trước.
