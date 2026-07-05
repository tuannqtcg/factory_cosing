# ADR-007: Khấu hao khuôn theo thời điểm mua (time-phased), không gộp 1 số tĩnh
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN (nguyên tắc) — CHỜ DỮ LIỆU trước khi vào schema

## Bối cảnh
Hiện `fitting.params.moldSetCostTotal66` là 1 số gộp cho toàn bộ 66 bộ khuôn, khấu
hao chung 5 năm, nuôi thẳng vào MHR (ADR-001) như 1 hằng số cấu hình. Thực tế công
ty sẽ **mua thêm khuôn mới** khi mở rộng SKU/công suất, ở các thời điểm khác nhau —
khuôn cũ có thể đã khấu hao hết trong khi khuôn mới mới bắt đầu. Gộp chung 1 số sẽ
sai ngay khi có đợt mua khuôn thứ 2.

## Quyết định
1. Mỗi khuôn (hoặc mỗi lô khuôn mua cùng đợt) là 1 **mold asset** độc lập:
   `{ id, gắn với size/họ SKU, cost, purchaseYear, usefulLifeYears, maintenancePerYear? }`
   — thay cho `moldSetCostTotal66` dạng scalar.
2. `machineMoldDepreciation = Σ (asset.cost / asset.usefulLifeYears)` — chỉ cộng
   những asset còn TRONG thời gian khấu hao tại **mốc thời gian đánh giá** của kịch
   bản (asOfYear). Asset đã khấu hao hết → đóng góp 0, KHÔNG loại khỏi công thức
   (vẫn đang được dùng để sản xuất, chỉ là không còn khấu hao).
3. Engine cần thêm 1 input mới `asOfYear` (hoặc `asOfDate`) vào `ScenarioInput` —
   vẫn là pure forward function (không vi phạm ADR-005), chỉ mở rộng thêm 1 biến.
4. Hệ quả trực tiếp: **MHR không còn là hằng số cấu hình** — nó là giá trị TÍNH RA
   phụ thuộc {danh sách mold asset, asOfYear}, sẽ tự thay đổi khi thêm khuôn mới
   hoặc khi khuôn cũ hết khấu hao, không cần sửa công thức mỗi lần mua khuôn.

## Hệ quả
- Schema Pha 2: `moldAssets: MoldAsset[]` thay `moldSetCostTotal66` scalar.
- Prototype Pha 1 hiện tại (`cfg.moldTotal` — 1 ô input tổng) CHƯA sửa ngay; đây là
  quyết định nguyên tắc, chờ Pha 2 mới đổi cấu trúc input thật.
- **Dữ liệu đã có**: `purchaseYear = 2026` cho toàn bộ 66 bộ khuôn hiện có (mua cùng
  đợt gốc) → tại `asOfYear = 2026`, tất cả asset đang ở năm khấu hao đầu tiên, số ra
  giống hệt cách tính gộp hiện tại (không có sai lệch khi bắt đầu). `cost` từng
  asset ĐỂ TRỐNG — user sẽ tự nhập khi có số liệu; field `cost` trong `MoldAsset`
  phải cho phép `null`/chưa điền ở Pha 2 (không mặc định = 0, vì 0 sẽ làm sai MHR).
- **Còn treo**: giá (`cost`) thực tế từng khuôn/lô khuôn — user tự nhập sau; và
  thông tin khuôn dự kiến mua thêm (nếu có) khi phát sinh.
