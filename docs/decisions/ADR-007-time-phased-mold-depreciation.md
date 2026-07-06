# ADR-007: Khấu hao khuôn theo thời điểm mua (time-phased), không gộp 1 số tĩnh
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN — ĐÃ CÓ SỐ LIỆU (66/66 khuôn), chờ vào schema Pha 2

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

## Dữ liệu thật (2026-07, từ `contract_mold_price_from_David2506062.pdf`)
Đã có đủ giá cho 66/66 khuôn — lưu tại `tests/fixtures/mold-assets.json`.
`purchaseYear = 2026` cho toàn bộ (đợt mua gốc) → tại `asOfYear = 2026`, mọi asset
đang ở năm khấu hao đầu tiên, số ra giống hệt cách tính gộp hiện tại (không có sai
lệch khi bắt đầu áp dụng).

**Verify**: Σ 66 giá USD × 26.500 = 246.900 × 26.500 = **6.542.850.000 đ** — khớp
TUYỆT ĐỐI với `fitting.json.params.moldSetCostTotal66` đang dùng. Xác nhận dữ liệu
đọc đúng và đây chính là nguồn gốc con số cũ.

**Phát hiện quan trọng** (đã user xác nhận đúng thực tế): 66 khuôn vật lý sản xuất
được 83/91 SKU — một số khuôn dùng CHUNG cho nhiều biến thể (vd 1 khuôn cho cả
"Nối thẳng 50" + "Nối giảm 50x25/50x32/50x40" + "Nắp bịt 50" — 5 SKU chỉ 1 khuôn).
**8 SKU sau CHƯA có khuôn** (chưa sản xuất thật, không phải lỗi mapping):
Cút ren trong (20xPT15, 25xPT15, 25xPT20), Tê ren trong (20xPT15, 25xPT15, 25xPT20,
25xPT25), và Tê giảm 50x40 — 8 SKU này đúng kịch bản ADR-007 dự đoán (khuôn mua sau
khi mở rộng SKU), field `cost`/`purchaseYear` để trống trong fixture cho tới khi có
khuôn thật.

## Còn treo
- Giá + năm mua của khuôn MỚI khi công ty thực sự mua thêm (cho 8 SKU nói trên hoặc
  SKU tương lai khác) — cập nhật thêm vào `moldAssets`, không sửa asset cũ.
- Schema Pha 2 chính thức: quyết định field `MoldAsset.cost` có cho phép `null`
  (chưa mua khuôn nhưng SKU đã định nghĩa) hay tách hẳn SKU chưa có khuôn ra khỏi
  danh mục sản phẩm đang bán (khác nhau về ý nghĩa business — cần bàn ở Pha 2).
