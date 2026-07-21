# ADR-051 — Quyết Định Nhận Đơn: chi phí setup mỗi lần chạy (đơn nhỏ bị phạt)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user chọn phương án 2)
- **Kế thừa**: ADR-029 (Quyết Định Nhận Đơn)

## Bối cảnh
User chỉ ra màn Nhận Đơn "luôn yes kể cả chạy 1 m ống". Hai nguyên nhân:
1. Giá chào để trống → tự điền giá VF niêm yết (vốn đã trên giá thành) → luôn accept.
2. `decideOrder` chấm theo BIÊN TẾ/kg — số lượng KHÔNG đổi verdict (1 m hay 1000 m như nhau),
   vì mô hình không có chi phí đơn-lẻ (setup/đổi khuôn) hay đơn tối thiểu.

User chọn thêm mô hình chi phí setup để đơn nhỏ bị phạt (phương án 2).

## Quyết định
Thêm `setupCostVnd` (chi phí một lần cho dòng đơn: đổi khuôn/khởi động máy) vào
`OrderDecisionRequest`. Verdict xét ở mức **TỔNG đơn**, đã trừ setup:
- `setupCostPerKgVnd = setupCostVnd ÷ quantityKg` → đơn nhỏ gánh setup/kg lớn.
- `contributionTotalVnd = (giá chào − sàn biến phí)×kg − setupCostVnd`
- `profitVsFullCostTotalVnd = (giá chào − giá thành đầy đủ)×kg − setupCostVnd`
- verdict: profitVsFullTotal ≥ 0 → NHẬN; contributionTotal ≥ 0 → CÂN NHẮC; else KHÔNG.

## Parity-safe
- `setupCostVnd` optional, mặc định 0. Khi 0: total = biên/kg × kg (dấu = dấu biên/kg vì
  quantity>0) → **verdict trùng khít ADR-029**; `contributionTotalVnd = contribution/kg × kg`
  (test cũ giữ). Suite 382/382 (thêm 2 test: parity setup=0 + đơn 1 kg + setup 1 triệu → hết accept).
- UI: ô "Chi phí setup / dòng" ở footer đơn (mặc định 0), rải cho từng dòng; ghi chú ở kết luận.

## Cập nhật (cùng phiên)
User quyết định **gỡ hẳn màn Quyết Định Nhận Đơn** khỏi menu ngay sau đó (dọn nhóm "Thử &
Hoạch định"). Engine `order-acceptance.ts` + schema + test (gồm setup ADR-051) GIỮ trong repo
(không xóa, như ConfigScreen/AssumptionsScreen) nhưng KHÔNG còn lối vào UI. Nếu cần dùng lại
sau, chỉ việc thêm lại tab + component.

## Còn treo
- Có thể chuyển setup thành cấu hình theo dòng/khuôn ở Thiết Lập Dữ Liệu (hiện nhập what-if tại màn).
- Chưa mô hình "đơn tối thiểu" cứng — dùng setup/kg thay cho ngưỡng cứng (mềm hơn, đủ mục tiêu).
