# ADR-002: Giá vốn kép — bình quân gia quyền (sổ sách) vs giá tái tạo (định giá)
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

## Bối cảnh
Compound nhập nhiều đợt giá khác nhau; định giá theo lô cũ gây lãi ảo khi giá tăng
và mất cạnh tranh khi giá giảm.

## Quyết định
Hai dòng giá thành song song: SỔ SÁCH dùng bình quân gia quyền (VAS/TT200, đo lãi kỳ,
tính tồn kho); ĐỊNH GIÁ dùng giá tái tạo (nuôi thang giá, bảng giá, CVP).
Hiển thị lãi/lỗ giữ kho = (tái tạo − bình quân) × tồn kho; cảnh báo dự phòng VAS 02
khi tái tạo < bình quân. Ngưỡng reprice khuyến nghị: lệch ±3–5%.
