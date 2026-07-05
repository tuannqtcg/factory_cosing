# ADR-001: Hai cost driver — kg (ống) và giờ máy (phụ kiện)
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

## Bối cảnh
Ống là sản xuất đùn liên tục; phụ kiện là ép phun rời rạc theo chu kỳ khuôn.
Mô hình kg đồng đều làm sai giá từng SKU phụ kiện (lơ thu nhẹ-chậm bị tính rẻ ~79%).

## Quyết định
Chi phí gia công ống phân bổ theo KG; phụ kiện theo GIỜ MÁY (MHR = tổng chi phí
gia công năm ÷ giờ máy huy động; giờ máy/sp = chu kỳ ÷ (3600 × cavity × yield)).
Driver là discriminated union trong schema — thêm ngành mới = thêm driver, không sửa engine.

## Hệ quả
Cần dữ liệu chu kỳ + cavity từng SKU (bảng khuôn); yield nằm ở mẫu số giờ máy
(phế vẫn tốn giờ máy) và ở tử số vật liệu (phế vẫn tốn nhựa, không regrind do UL).
