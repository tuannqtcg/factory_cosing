# ADR-043 — CEO Planner Bước 1 theo MÁY (số ca của máy, compound độc lập)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user phiên 2026-07-20)
- **Kế thừa**: ADR-042

## Bối cảnh
2 lỗ hổng user chỉ ra:
1. Chọn "dòng sản phẩm" dùng MỘT `brandIdx` cho cả ống lẫn phụ kiện → giả định 2 danh sách nguyên liệu thẳng hàng. Khi số compound 2 dòng khác nhau (vd 3 compound ống, 2 phụ kiện) → lệch hàng → phụ kiện chọn sai/ẩn.
2. Số ca hiển thị trong cột thương hiệu → hiểu nhầm "ca của BlazeMaster". Thực tế máy đùn chỉ 3 ca/ngày, BM+Corzan dùng CHUNG → không thể mỗi loại 3 ca.

## Quyết định
Trình bày Bước 1 THEO MÁY:
- 🏭 Máy đùn ống (1 máy): số ca/ngày (CHUNG) · chọn 1/2 compound.
- 🏭 Máy ép phụ kiện (2 máy): số ca + huy động (CHUNG) · chọn 1/2 compound.
- Số ca + huy động = thuộc tính MÁY (một lần). Compound chọn ĐỘC LẬP cho từng máy (dropdown riêng). 2 compound = chia THỜI GIAN máy (%), không nhân theo số loại (3 ca là trần vật lý, mỗi ngày chạy 1 size).
- Giá + markup nhập tay CẢ hai compound. Hai máy độc lập (ống có thể 2 loại, phụ kiện 1 loại).
- Engine không đổi (request shape giữ) → parity + test phân bổ vẫn đúng.
