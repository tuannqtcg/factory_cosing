# ADR-013: Thêm mã vật liệu vào cấu hình Material để xuất Bảng Giá

Ngày: 2026-07-13 | Trạng thái: CHẤP NHẬN
Nguồn: User yêu cầu thêm format in bảng giá chuẩn B2B từ file PDF.

## Bối cảnh

User cung cấp một mẫu báo giá chuẩn (PDF) yêu cầu phần mềm có thể tự động xuất ra Bảng Giá Niêm Yết có định dạng y hệt.
Bảng giá này bao gồm 2 cột mang tính kỹ thuật:
- Mã định danh vật liệu (VD: 4120-06 cho ống BlazeMaster, 4102-05 cho phụ kiện)
- Phân lớp đặc tính vật liệu (VD: 23547 cho ống, 24447 cho phụ kiện)

Ở ADR-012, chúng ta đã tách Material thành một Entity độc lập chứa các thuộc tính thương mại và Landed Cost. Tuy nhiên, schema hiện tại thiếu các mã tiêu chuẩn này.

## Quyết định

1. Bổ sung `designationCode` (chuỗi tùy chọn) và `classificationCode` (chuỗi tùy chọn) vào `MaterialSchema`.
2. Do là các trường tùy chọn, các kịch bản (Scenario) cũ không bị lỗi tương thích ngược.

## Hệ quả

- Màn hình Bảng Giá (Price List) sẽ ưu tiên lấy 2 trường này từ Material để hiển thị. Nếu Material không được cấu hình, có thể bỏ trống hoặc fallback về mã mặc định.
- Cho phép in bảng giá chuyên nghiệp trực tiếp từ phần mềm.
