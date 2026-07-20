# ADR-046 — Công suất đùn ống theo SIZE (m/giờ) + cảnh báo vượt trần máy

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user phiên 2026-07-20)
- **Kế thừa**: ADR-001 (driver kg), mô hình phụ kiện machine-hour per-SKU

## Bối cảnh
Mô hình cũ: 1 tốc độ chung cho cả máy đùn (`actualCapacityKgPerHour` = 140 kg/h), mét suy = kg ÷ đơn trọng. Thực tế tốc độ mét/giờ khác theo size (pin/bush khác theo dải DN20–50 / DN65–80 / DN100+; size nhỏ giới hạn tốc độ kéo ~420 m/h, size lớn giới hạn throughput ~163 kg/h). Số đo: DN20/DN25 = 420 m/h, DN80 = 60 m/h (1 m/phút).

## Quyết định
1. `PipeProduct.capacityMetersPerHour` (optional, mét/giờ đo thực theo size).
2. Cột "CS đùn (m/giờ)" trong bảng Ống (Danh Mục): nhập tay; tự tính `kg/giờ = m/giờ × đơn trọng`; **cảnh báo ⚠ đỏ** nếu vượt `maxCapacityKgPerHour` (hằng số vật lý ở Cấu Hình), ✓ xanh nếu trong ngưỡng. Kiểm tra 2-tham-số (trần máy là hằng số).
3. Bước này CHỈ nhập + kiểm tra công suất (guardrail + tư liệu), field optional, engine chưa dùng → giữ parity. Việc DÙNG số này để tính giá thành = ADR-047.

## Ghi chú số đo
Mô hình 2-ngưỡng: `m/giờ(size) = min(420 m/h, ~163 kg/h ÷ đơn trọng)`. Nội suy các size chưa đo (DN32/40/50/65/100). Cần đo thêm để thay số nội suy.
