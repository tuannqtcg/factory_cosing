# ADR-008: Ren kim loại mua ngoài — dòng nguyên liệu thứ 2, áp giá vốn kép
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN (nguyên tắc) — CHỜ DỮ LIỆU trước khi vào schema

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
3. Công thức mở rộng (thay cho hằng số `brassInsertCost` tĩnh):
   ```
   materialCostPerUnit (họ ren) = unitWeightKg × (compoundLandedPerKg/yieldRate + packagingCostPerKg)
                                   + insertQtyPerUnit × insertPricingCostPerUnit
   ```
   `insertQtyPerUnit` là số lượng ren/sản phẩm theo BOM từng SKU (không phải hằng số
   chung — có thể khác nhau giữa các size/họ).
4. Lãi/lỗ giữ kho (§5 BUSINESS_MODEL) mở rộng thêm 1 dòng thứ 3 (ren kim loại) theo
   đúng công thức đang dùng cho ống/phụ kiện, KHÔNG viết công thức riêng khác.

## Hệ quả
- Schema Pha 2: thêm 1 "material stream" độc lập (tồn kho + giá tái tạo riêng),
  không nhét vào field `brassInsertCost` dạng scalar nữa — cần mô hình BOM
  (`insertQtyPerUnit` theo từng SKU).
- Prototype Pha 1: CHƯA sửa `brassInsertCost` trong file mock ngay (vẫn = 0) vì
  thiếu dữ liệu thật; khi có số liệu có thể cập nhật demo trước khi vào Pha 2.
- **Còn treo — cần trả lời trước khi hoàn thiện schema**:
  1. Có áp cơ chế khóa bảng giá (ADR-004) riêng cho ren kim loại không, hay khóa
     theo TỔNG chi phí nguyên liệu của SKU (compound + ren gộp lại)?
  2. Mua VND (trong nước) hay ngoại tệ nhập khẩu (nếu có → cùng landed cost
     DUTY 7% + logistics 1% như compound)?
  3. Số lượng ren/sản phẩm theo từng SKU trong 4 họ (không giả định đồng nhất 1/sp).
  4. Có cần track tồn kho ren kim loại theo nhiều đợt nhập (như tab Tồn Kho hiện có
     cho compound) hay chỉ 1 giá hiện hành (mua-theo-đơn, không giữ tồn kho)?
