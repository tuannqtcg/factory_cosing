---
name: excel-parity-testing
description: Viết và chạy test đối chiếu engine TypeScript với Excel model v3.3 (372 assertion vàng) — giá thành, MHR, thang giá, CVP, plan. Dùng khi viết engine, sửa công thức, hoặc nghiệm thu Pha 4.
---

# Skill: Excel Parity Testing (Pha 4)

## Nguyên tắc
Excel `BlazeMaster_Model_v3_3.xlsx` là NGUỒN CHÂN LÝ nghiệp vụ. Engine TS đúng
khi và chỉ khi tái tạo được từng con số của Excel với cùng input.

## Bộ fixture vàng (defaults kịch bản EU)
| Đại lượng | Giá trị kỳ vọng |
|---|---|
| BE ống (đ/kg) | 106.205 (dùng giá trị chính xác trong fixture, không làm tròn) |
| MHR phụ kiện (đ/giờ máy) | 1.344.176 |
| Thang giá ống 5 bậc | 100.663 / 104.298 / 106.205 / 110.604 / 132.756 |
| 8 giá ống + 91 giá SKU | tests/fixtures/prices.json (xuất từ Excel) |
| Kho 2 đợt (100t@3,03 + 50t@3,5; tái tạo 3,5) | AVG=3,1867; BE định giá=121.012; lãi giữ kho=1.332.685.000 |

## Cách viết test
1. Fixture xuất từ Excel bằng script, KHÔNG gõ tay (tránh lỗi chép số).
2. So sánh: tiền VNĐ tolerance ±0,5đ trước làm tròn; giá niêm yết khớp tuyệt đối sau ROUNDUP(-2).
3. Mỗi công thức đổi → chạy lại toàn bộ parity suite; lệch = engine sai HOẶC
   nghiệp vụ đổi → nếu nghiệp vụ đổi phải có ADR + cập nhật Excel trước, fixture sau.
4. Test theo tầng: unit (từng hàm) → scenario (toàn chuỗi) → snapshot bảng giá 100 dòng.
