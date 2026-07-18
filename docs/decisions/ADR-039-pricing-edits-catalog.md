# ADR-039 — Mở quyền sửa danh mục sản phẩm cho vai Định Giá (khuôn vẫn khóa admin)

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user duyệt trong phiên 2026-07-18)
- **Kế thừa & thay thế**: sửa hợp đồng `product.md` mục phân quyền (quy định
  "Product chỉ admin ghi" của M12.9a); kế thừa ADR-038.

## Bối cảnh

CEO muốn giao nhân viên cập nhật danh mục sản phẩm (tên, tiêu chuẩn, kích
thước, đơn trọng, chu kỳ ép) nuôi Bảng Giá. Rules cũ khóa `products[]` chỉ
admin ghi → vai pricing bị chặn ở server.

## Quyết định

1. **`products[]` mở cho `pricing`** (gỡ dòng `incoming.products ==
   existing.products` khỏi `scenarioLockedFieldsUnchanged`). Lý do an toàn:
   danh mục là master data KỸ THUẬT, không phải cấu trúc chi phí; `sales`
   vẫn không đọc/ghi được `scenarios/{id}`; mọi ranh giới khác giữ nguyên
   (thresholdPct, costPool, machineTypes… vẫn khóa).
2. **`resources.fitting.moldAssets` GIỮ khóa admin** — khuôn là tài sản vốn
   (giá mua, năm mua, đời khấu hao → chảy thẳng vào giá thành). Đã cân nhắc
   khóa từng field theo phần tử (kỹ thuật unroll ADR-015) nhưng danh mục có
   66 khuôn — không unroll được, khóa cả mảng. Hệ quả: việc GÁN SKU↔khuôn
   (`producesSkus` nằm trong mảng này) cũng là thao tác admin.
3. **Quy trình 2 nhịp**: nhân viên pricing tạo/sửa SKU (SKU mới tự ở trạng
   thái "chờ khuôn", ẩn khỏi Bảng Giá) → admin (CEO) gán khuôn 1 click ở
   Danh Mục Sản Phẩm → SKU tự lên Bảng Giá. UI phản ánh đúng: pricing thấy
   ô khuôn bị disable + banner giải thích.

## Kiểm chứng (checklist security-review)

- Rules test cập nhật: pricing sửa `products[]` PASS; pricing sửa
  `moldAssets` FAIL; admin cả hai PASS. Suite rules 63/63 trên emulator.
- Không đổi quyền đọc; sales không thêm quyền nào.
- Cloud Function vẫn Zod-parse mọi input (không đổi).

## Hệ quả / rủi ro chấp nhận

- Pricing sửa được `unitWeightKg`/`cycleTimeSec` → ảnh hưởng giá thành SKU.
  Chấp nhận vì đây chính là việc CEO giao; scenario không có audit log per-field
  — nếu sau này cần truy vết, mở ADR về audit ghi scenario.
