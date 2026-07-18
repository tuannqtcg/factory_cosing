# ADR-036 — Bảng Giá 2 dạng xem (danh sách + phiếu giá) & Nhận Đơn theo SKU/đơn vị thương mại

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user chỉ định thiết kế trong phiên 2026-07-18)
- **Kế thừa**: ADR-025 (giá VF), ADR-029 (nhận đơn), ADR-035 (giải thích tại chỗ)

## Bối cảnh

User (CEO): (1) Bảng Giá cần thêm dạng "phiếu giá" — chọn ống size nào ra phiếu
giá size đó, phụ kiện cũng vậy, màn đơn giản gọn rộng vì chỉ 1 sản phẩm; dạng
danh sách giữ, trình bày gọn. (2) Nhận Đơn đang bắt nhập tấn + đ/kg trong khi
khách đặt hàng theo mét ống / cái phụ kiện với giá theo mét/cái.

## Quyết định

1. **Bảng Giá 2 dạng xem** (toggle trong màn, không thêm mục menu):
   - **Danh sách**: bảng cũ (tra nhanh, search/filter, bấm dòng mở truy nguyên giá).
   - **Phiếu giá**: chọn Sản phẩm (dropdown) + Kích cỡ (chip) → MỘT phiếu chi
     tiết: thông tin sản phẩm, giá VF trước/có VAT cỡ lớn, 3 giá dẫn xuất
     (TCG / niêm yết NPP trước & có VAT), kèm nguyên khối "giá này từ đâu ra"
     (ADR-035). Khối truy nguyên tách thành hàm `renderOrigin` dùng chung 2 dạng.
2. **Nhận Đơn theo SKU + đơn vị thương mại**:
   - Chọn sản phẩm cụ thể (Ống theo DN, phụ kiện theo tên + size; chỉ phụ kiện
     đã có khuôn). Nhập số MÉT (ống) / số CÁI (phụ kiện) + giá chào đ/mét | đ/cái.
   - UI quy đổi ra kg bằng đơn trọng trong danh mục (`unitWeightKgPerM` /
     `unitWeightKg`) và hiển thị minh bạch phép quy đổi. **Engine `decideOrder`
     GIỮ NGUYÊN** (sàn đ/kg theo dòng SP + nguyên liệu tham chiếu) — có dòng ghi
     chú sàn tính theo dòng, quy về đ/mét|đ/cái theo đơn trọng SKU đã chọn.
   - Giá chào gợi ý sẵn = giá VF đang niêm yết của SKU (đọc `outputs/priceList`).

## Phạm vi

Thuần trình bày + quy đổi đơn vị ở client (phép nhân đơn trọng — dữ liệu danh
mục, không phải công thức chi phí). Engine/schema/rules không đổi.

## Hệ quả

- CEO thao tác đúng ngôn ngữ thương mại (mét/cái/phiếu giá), hết cảnh quy đổi tay.
- Sàn giá vẫn ở tầng dòng SP — nếu sau này cần sàn theo TỪNG SKU (chu kỳ ép
  khác nhau giữa các size phụ kiện) phải mở ADR mới, đụng engine.
