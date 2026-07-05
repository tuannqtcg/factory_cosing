# ADR-008: Ren kim loại mua ngoài — dòng nguyên liệu thứ 2, áp giá vốn kép + khóa giá riêng
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN — CHỜ SỐ LIỆU (đơn giá, số lượng/SKU) trước khi vào schema

## Bối cảnh
4 họ SKU phụ kiện (Nối ren trong, Nối ren ngoài, Cút ren trong, Tê ren trong) cần ép
thêm 1 phần ren kim loại (đồng thau) mua từ nhà cung cấp KHÁC (không phải nhà cung
cấp compound nhựa) vào phụ kiện nhựa để tạo sản phẩm hoàn thiện. Field
`brassInsertCost` đã có sẵn trong `fitting.skus` từ kit gốc (hiện = 0 cho cả 91 SKU,
giữ chỗ đúng cho tình huống này) nhưng đang được mô hình như 1 hằng số cộng thẳng
vào `breakEvenPerUnit` — không đủ nếu giá ren biến động như compound.

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
- **Còn treo — chỉ còn thiếu SỐ LIỆU, không còn thiếu quyết định nguyên tắc**:
  1. Số lượng ren/sản phẩm theo từng SKU trong 4 họ — user sẽ cung cấp sau.
  2. Đơn giá ren kim loại hiện hành (VND) + baseline/ngưỡng khóa giá ban đầu —
     user sẽ cung cấp sau.
