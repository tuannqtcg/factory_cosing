---
name: prototype
description: Dựng prototype UI (Pha 1) cho Costing App — mockup tương tác bằng React artifact, dữ liệu giả từ Excel v3.3, chưa có backend. Dùng khi bắt đầu màn hình mới hoặc sửa UX trước khi code thật.
---

# Skill: Prototype (Pha 1)

## Luật
1. CHỈ mock: dữ liệu giả hard-code lấy đúng số từ `tests/fixtures/` (BE ống 106.205đ/kg,
   MHR 1.344.176đ/giờ máy, thang giá 5 bậc...) để người duyệt thấy số quen.
2. KHÔNG gọi API, KHÔNG Firebase, KHÔNG localStorage. State = useState thuần.
3. Dùng design tokens trong `docs/PROJECT_SPEC.md §4` — không tự chế màu/font.
4. Mỗi prototype = 1 artifact tự chạy được. Kèm ghi chú: những gì là giả.
5. Ngôn ngữ UI: tiếng Việt. Số: định dạng VN. Đơn vị luôn hiển thị (đ/kg, giờ máy).

## Checklist trước khi trình duyệt cổng Pha 1
- [ ] Đủ trạng thái: rỗng / có dữ liệu / lỗi / đang tải (giả)
- [ ] Responsive tối thiểu: desktop + tablet
- [ ] Slider/what-if hoạt động với công thức thật từ engine spec (được phép nhúng công thức
      thuần để demo, đánh dấu rõ "sẽ thay bằng engine")
- [ ] Người duyệt ký: chốt layout, sang Pha 2
