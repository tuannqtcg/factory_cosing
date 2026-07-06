# ADR-008: Ren kim loại mua ngoài — dòng nguyên liệu thứ 2, áp giá vốn kép + khóa giá riêng
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN — ĐÃ CÓ ĐƠN GIÁ (11/11 SKU), chờ baseline khóa giá + tồn kho ban đầu

## Bối cảnh
Ban đầu nghĩ 4 họ SKU (Nối ren trong, Nối ren ngoài, Cút ren trong, Tê ren trong)
đều cần ren kim loại — nhưng dữ liệu thật (xem dưới) xác nhận: **chỉ Nối ren
trong/ngoài (11 SKU) cần**; Cút ren trong/Tê ren trong (7 SKU) hiện CHƯA sản xuất
(không có khuôn, không có giá ren — xem ADR-007). Ren kim loại (đồng thau) mua từ
nhà cung cấp KHÁC (không phải nhà cung cấp compound nhựa) ép vào phụ kiện nhựa để
tạo sản phẩm hoàn thiện. Field `brassInsertCost` đã có sẵn trong `fitting.skus` từ
kit gốc (hiện = 0 cho cả 91 SKU, giữ chỗ đúng cho tình huống này) nhưng đang được
mô hình như 1 hằng số cộng thẳng vào `breakEvenPerUnit` — không đủ nếu giá ren biến
động như compound.

## Quyết định
Ren kim loại là **dòng nguyên vật liệu thứ hai**, song song với compound, áp dụng
ĐÚNG nguyên tắc giá vốn kép (ADR-002) — không cộng thẳng 1 số tĩnh:
1. **Sổ sách**: bình quân gia quyền tồn kho ren kim loại — tách riêng, độc lập với
   tồn kho compound (ống/phụ kiện).
2. **Định giá**: giá tái tạo ren kim loại — dùng để tính `materialCostPerUnit` của
   các SKU thuộc 4 họ "ren".
3. Công thức mở rộng (thay cho hằng số `brassInsertCost` tĩnh) — **mua VND trong
   nước, KHÔNG có bước landed cost/thuế NK** (khác compound):
   ```
   materialCostPerUnit (họ ren) = unitWeightKg × (compoundLandedPerKg/yieldRate + packagingCostPerKg)
                                   + insertQtyPerUnit × insertPricingCostVndPerUnit
   ```
   `insertQtyPerUnit` là số lượng ren/sản phẩm theo BOM từng SKU (không phải hằng số
   chung — có thể khác nhau giữa các size/họ) — **số liệu để sau, user tự nhập**.
4. Lãi/lỗ giữ kho (§5 BUSINESS_MODEL) mở rộng thêm 1 dòng thứ 3 (ren kim loại) theo
   đúng công thức đang dùng cho ống/phụ kiện, KHÔNG viết công thức riêng khác.
5. **Tồn kho riêng**: có tab/bảng tồn kho ren kim loại độc lập (nhiều đợt nhập, như
   tab Tồn Kho hiện có cho compound Ống/Phụ kiện) — dùng để tính bình quân gia
   quyền + lãi/lỗ giữ kho, không phải 1 giá hiện hành duy nhất.
6. **Khóa giá riêng (mở rộng ADR-004)**: ren kim loại có `baselinePrice` +
   `priceLockThreshold` ĐỘC LẬP với compound — cùng công thức
   `pricingPrice = |replacement/baseline − 1| > ngưỡng% ? replacement : baseline`
   nhưng là 1 policy riêng, không gộp chung ngưỡng với compound. SKU họ "ren" khi
   đó có 2 biến định giá độc lập cần khóa: giá compound (đã có) VÀ giá ren kim loại
   (mới) — `materialCostPerUnit` dùng CẢ HAI `pricingPrice` tương ứng, không phải
   giá replacement thô.

## Hệ quả
- Schema Pha 2: thêm 1 "material stream" độc lập (tồn kho VND + giá tái tạo VND
  riêng, KHÔNG có bước quy đổi ngoại tệ/thuế NK), không nhét vào field
  `brassInsertCost` dạng scalar nữa — cần mô hình BOM (`insertQtyPerUnit` theo
  từng SKU) + bảng tồn kho thứ 3 (song song 2 bảng Ống/Phụ kiện đã có).
- Prototype Pha 1: CHƯA sửa `brassInsertCost` trong file mock ngay (vẫn = 0) vì
  thiếu số liệu `insertQtyPerUnit` và đơn giá thật; khi có số liệu có thể cập
  nhật demo trước khi vào Pha 2.
- Schema Pha 2 (bổ sung): `fitting.priceLock` (ADR-004) cần nhân bản thành 2 policy
  độc lập — `compound` (đã có) và `metalInsert` (mới) — mỗi cái có
  `baselinePrice`/`thresholdPct`/`pricingPrice` riêng, KHÔNG dùng chung 1 ngưỡng.
- **Đã xác nhận**: mua VND trong nước (không ngoại tệ, không DUTY/logistics); có
  tồn kho riêng nhiều đợt nhập (giống cơ chế Ống/Phụ kiện); khóa giá riêng độc lập
  với compound (không gộp ngưỡng).

## Dữ liệu thật (2026-07, từ `Gia_phu_kien_ren.pdf`)
Đơn giá cho đủ 11/11 SKU — lưu tại `tests/fixtures/metal-insert.json`.
`insertQtyPerUnit = 1` cho toàn bộ 11 SKU (file chỉ có 1 đơn giá/SKU, không có cột
số lượng riêng — nếu thực tế có SKU cần >1 ren, cần sửa lại field này).

**Cross-check**: cột `unitWeightKg` trong file khớp 100% với `PK_CATALOG` đã có
trong prototype → xác nhận đúng SKU, không nhầm dòng.

**Phạm vi SKU đã thu hẹp đúng thực tế**: chỉ **Nối ren trong (7 SKU)** và **Nối ren
ngoài (4 SKU)** = 11 SKU có giá ren — khớp chính xác với 11 SKU CÓ khuôn trong
ADR-007 (mold-assets.json). Cút ren trong/Tê ren trong (7 SKU) không có cả khuôn
lẫn giá ren — nhất quán, vì chưa sản xuất thật.

## Còn treo
- `baselinePriceVnd` + `thresholdPct` ban đầu cho cơ chế khóa giá ren kim loại
  (mục 6 ở trên) — đơn giá trong file coi là giá tái tạo (replacement) hiện hành,
  nhưng chưa có baseline đã "chốt" trước đó để so sánh.
- Tồn kho ban đầu (đợt nhập, số lượng, giá) cho bảng tồn kho ren kim loại mới —
  hiện chưa có lịch sử nhập nên chưa tính được bình quân gia quyền thật.
- Khi 7 SKU Cút/Tê ren trong thật sự vào sản xuất (mua khuôn — xem ADR-007), cần
  đơn giá ren kim loại cho chúng lúc đó (chưa có, không giả định trước).
