# ADR-047 — 2 logic tính giá thành Ống song song (pipeCostMethod: kg | meters)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user phiên 2026-07-20 — "lưu cố định vào scenario")
- **Kế thừa**: ADR-046 (m/giờ per-size), ADR-045 (client tự tính → công tắc tức thì)

## Bối cảnh
Số đo m/giờ per-size lệch ~30% so mô hình 1-tốc-độ → nên áp vào tính giá (size chạy chậm giá cao hơn, đúng activity-based). Nhưng logic cũ đã sinh bảng giá + khóa parity Excel v3.4 → phải GIỮ. User muốn 2 logic song song, một công tắc toàn hệ thống, "thích tính cách nào thì tính".

## Quyết định
1. `ScenarioInput.pipeCostMethod` = `'kg'` (default) | `'meters'`. Doc cũ không có field → parse thành `'kg'` → parity giữ nguyên.
2. **'kg'**: `fullCostPerKg` rải đều theo kg (nguyên mô hình cũ) → khớp Excel v3.4.
3. **'meters'**: mỗi SKU ống tính giá vốn/kg = NL/kg + bao bì/kg + (chi phí giờ máy ÷ m/giờ của size) ÷ đơn trọng. `mhrPipe = totalProcessingCostPerYear ÷ normalOperatingHours`. m/giờ = `capacityMetersPerHour` (đo) hoặc suy từ tốc độ chung (thiếu). TỔNG chi phí máy giữ nguyên, chỉ đổi cách chia giữa các size.
4. **Công tắc toàn cục** ở sidebar (admin đổi → `updateDoc` scenario `{pipeCostMethod}` → mọi màn tính lại nhờ ADR-045). Lưu cố định vào scenario (cả hệ thống dùng chung).

## Parity-safe (test `pipe-cost-method`)
- Mặc định = 'kg'.
- 'meters' khi CHƯA nhập m/giờ = 'kg' TUYỆT ĐỐI (fallback: m/giờ suy = kg thành phẩm/giờ ÷ đơn trọng → giá vốn/kg trùng khít).
- 'meters' có m/giờ đo → đổi phân bố giá theo size.

## Còn treo
- CEO Planner / các màn giả định cũng đọc scenario.pipeCostMethod qua calculateScenario → tự theo. Chưa có bảng so sánh "kg vs m/giờ" cạnh nhau (tùy chọn).
- Cân nhắc áp cùng cơ chế cho phụ kiện (hiện đã machine-hour per-SKU sẵn).
