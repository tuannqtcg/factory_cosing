# DESIGN BRIEF — Quản lý nguyên liệu theo sản phẩm (multi-material)

Ngày: 2026-07-07 | Pha: 0 (brief) → 1 (prototype) | Trạng thái: CHỜ DUYỆT UI
Nguồn yêu cầu: user 2026-07-07 — "cần cho phép quản lý sản phẩm có tên nguyên
liệu ứng với sản phẩm, ví dụ hiện tại đang là nguyên liệu BlazeMaster Orange để
sản xuất ống và phụ kiện BlazeMaster, nhưng có cả nguyên liệu Corzan 3710 để
sản xuất sản phẩm Corzan."

## Vấn đề
Kiến trúc hiện tại (ADR-003 Phase 1) gắn CỨNG 1 nguyên liệu cho mỗi dòng sản
xuất: giá compound + tồn kho + khóa giá nằm trong `ScenarioInput.inventory.pipe|
fitting`, không có khái niệm "nguyên liệu" độc lập, không có liên kết sản phẩm
→ nguyên liệu. Khi thêm sản phẩm Corzan (dùng compound Corzan 3710, giá/tồn
kho/khóa giá riêng) thì không có chỗ chứa.

Đây chính là "người dùng thứ 2" mà ADR-003 đặt làm điều kiện mở Phase 2
(generalization) — làm thật, không universal hóa quá tay.

## Mục tiêu (phạm vi Pha 1 — chỉ UI mock)
1. **Danh mục nguyên liệu**: xem/thêm/sửa nguyên liệu như 1 entity độc lập —
   mỗi nguyên liệu có: tên, mã, tiền tệ mua, giá tái tạo, baseline + ngưỡng
   khóa giá (cơ chế ADR-004 áp DÙNG RIÊNG từng nguyên liệu), tồn kho theo lô +
   bình quân gia quyền (ADR-002), lãi/lỗ giữ kho.
2. **Gán sản phẩm ↔ nguyên liệu**: mỗi sản phẩm/nhóm sản phẩm chỉ rõ dùng
   nguyên liệu nào; đổi gán → giá thành/giá bán của ĐÚNG các sản phẩm đó đổi
   theo giá nguyên liệu tương ứng (what-if demo bằng công thức thuần, sẽ thay
   bằng engine).
3. **Cách ly khóa giá**: biến động giá Corzan 3710 vượt ngưỡng chỉ MỞ KHÓA
   bảng giá các SKU Corzan — bảng giá BlazeMaster đứng yên (và ngược lại).

## Ngoài phạm vi (nói rõ để không lạm phát)
- KHÔNG thêm dòng sản xuất/driver mới — sản phẩm Corzan giả định chạy CHUNG
  line đùn/ép hiện có (chi phí gia công/MHR dùng chung; nếu sau này Corzan có
  line riêng → ADR khác).
- KHÔNG đổi cơ chế ren kim loại (ADR-008) — ren vẫn là dòng vật liệu thứ 2
  theo (renType, ptSize), không gộp vào danh mục nguyên liệu compound.
- KHÔNG làm BOM nhiều nguyên liệu/sản phẩm (1 sản phẩm = 1 compound + tối đa
  1 ren như hiện tại).
- Phân bổ chi phí chung vẫn theo 2 dòng sản xuất theo kg (không theo nguyên
  liệu).

## Số liệu mock trong prototype
- BlazeMaster Orange (ống): 3,03 USD/kg — đúng fixture v3.7.
- BlazeMaster compound phụ kiện: 3,85 USD/kg — đúng fixture v3.7.
- Corzan 3710: 3,45 USD/kg + 3 SKU Corzan mẫu — **SỐ GIẢ HOÀN TOÀN**, chờ user
  cung cấp giá thật/danh mục SKU thật trước khi sang Pha 2.
- Chi phí gia công đơn vị ống 9.357,05 đ/kg, MHR 1.308.217,93 đ/giờ máy — đúng
  số vàng v3.7 (ADR-011).

## Việc sẽ làm ở Pha 2 (nếu UI được duyệt) — chỉ liệt kê, chưa làm
- ADR mới: tách `Material` entity (schema Zod riêng), thêm `materialId` vào
  `Product`, chuyển `inventory.pipe|fitting` → `materials[]`; migration cho
  scenario cũ.
- Sửa engine: `landedCostPerKgVnd` nhận giá theo material của từng product;
  price-lock chạy theo material; dual-costing theo material.
- Câu hỏi phải chốt với user trước khi đóng băng schema:
  (a) Corzan có markup VF/TCG riêng hay dùng chung markup BlazeMaster?
  (b) Corzan chạy chung line → có tách tỷ lệ phân bổ chi phí chung không?
  (c) Thuế NK compound Corzan có khác 6% (kịch bản EU) không?
