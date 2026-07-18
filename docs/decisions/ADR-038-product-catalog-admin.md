# ADR-038 — Mở lại Danh Mục Sản Phẩm (tạo mới + gán khuôn dùng chung) & phiếu giá 3 tầng

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user duyệt "phương án A" trong phiên 2026-07-18)
- **Kế thừa**: ADR-007 (khuôn), ADR-012 (materialId), ADR-026 (món nợ nav), ADR-036 (phiếu giá)

## Bối cảnh

User cần: (1) chỗ quản trị danh mục cho nội dung Bảng Giá để giao cho nhân viên
cập nhật, CEO cũng tự sửa được; (2) tạo mới sản phẩm khai đủ tiêu chuẩn/kích
thước/đơn trọng, chọn dùng chung khuôn với sản phẩm có sẵn; (3) phiếu giá phải
phân biệt rõ nguyên liệu (BlazeMaster/Corzan) và tiêu chuẩn ống (SDR 13.5/SCH40…).

## Quyết định

1. **Gắn lại `ProductsScreen`** vào nhóm THIẾT LẬP ("Danh Mục Sản Phẩm") — màn
   có sẵn từ trước, bị ADR-026 gỡ khỏi nav (món nợ thứ 3 được trả, sau Tồn Kho
   và ProductsScreen là hết).
2. **Nâng cấp màn**: cột "Khuôn (dùng chung được)" cho phụ kiện — chọn khuôn từ
   danh sách tài sản khuôn, nhiều SKU chung 1 khuôn (cùng khuôn khác compound,
   ADR-012); badge trạng thái ✅ có khuôn / ⏳ chờ khuôn (ẨN khỏi bảng giá,
   `managementStatusOf` tự tính — không sync tay). Chặn: khuôn không được rỗng
   SKU; chặn khai trùng khóa (DN+nguyên liệu / tên+size+nguyên liệu) với thông
   báo rõ vì sao (mỗi cặp chỉ 1 tiêu chuẩn — nâng khóa là phương án B, chưa làm).
3. **Quyền khớp rules server** (hợp đồng product.md "Product chỉ admin ghi"):
   UI chỉ cho vai Toàn Quyền lưu; vai Định Giá xem + banner giải thích. CEO
   (admin) tự sửa được như yêu cầu. Muốn "lính" sửa: cấp vai admin cho người
   được giao, HOẶC mở rules products cho pricing = đổi hợp đồng bảo mật → ADR
   riêng + sửa rules + rules test (chưa làm ở đây).
4. **Phiếu giá chọn 3 tầng**: ① Nguyên liệu (chip lớn) → ② Sản phẩm → ③ Kích cỡ
   · tiêu chuẩn; tiêu đề phiếu in đủ "Ống CPVC — Corzan — SCH40 — DN25"; thẻ
   thông tin thêm Nguyên liệu + Tiêu chuẩn. Dạng danh sách thêm bộ lọc nguyên
   liệu (hiện khi ≥2) và search theo tên nguyên liệu.
5. **Nhận Đơn**: nhãn kích cỡ LUÔN kèm tiêu chuẩn + nguyên liệu
   ("DN20 · SDR 13.5 · BlazeMaster") — không chỉ khi trùng tên.

## Hệ quả

- Quy trình tạo SKU trọn vòng: khai sản phẩm → gán khuôn (chung/mới) → Lưu →
  Cloud Function tính lại → SKU tự lên Bảng Giá. Không bước tay nào ở giữa.
- Giới hạn giữ nguyên: 1 (kích cỡ, nguyên liệu) = 1 tiêu chuẩn. Ống SCH80 cho
  BlazeMaster cùng DN cần nâng khóa sản phẩm (ADR mới + migration + fixture).
