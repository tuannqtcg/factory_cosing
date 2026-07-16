# ADR-026: Gọn về MỘT view CEO — bỏ tab vận hành của vai khác + guard vai chết

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-020, ADR-023

## Bối cảnh
Bản chất app: **hỗ trợ QUYẾT ĐỊNH của CEO** — nhìn nhiều góc độ → điều chỉnh tham
số → xem thay đổi → quyết định. ADR-020 đã hợp nhất một view CEO nhưng vẫn giữ
nhiều tab là tính năng VẬN HÀNH của vai khác (production/sales), gây rối. User chốt:
"xem theo Vai không phải mục đích; một vai CEO là đủ; bỏ tính năng không cần của các
vai khác cho đỡ rối."

## Quyết định
**1. Bỏ 5 tab vận hành khỏi điều hướng** (component để lại trên đĩa, không xoá — có
thể khôi phục; chỉ gỡ khỏi nav/render/import AppShell):
- **Kế Hoạch SX** (`plan`) — lập kế hoạch/MRP, việc của vai *production*.
- **Ống CPVC** + **Phụ Kiện** (`ong`/`pk`, ProductionReport) — báo cáo giá thành theo
  dây chuyền, trùng nội dung Dashboard + Phân Tích Định Giá.
- **Tồn Kho Compound** (`inventory`) — nhập lô compound. Đòn bẩy quyết định của CEO là
  **giá tái tạo** (đã có ở tab Tham Số); nhập lô là tác nghiệp.
- **Danh Mục Sản Phẩm** (`products`) — cấu hình danh mục SKU, hiếm khi CEO đụng.

**2. Điều hướng còn lại — 2 nhóm theo mục đích:**
- *Phân Tích & Quyết Định*: Tổng Quan · Trợ Lý CEO · Giá Vốn Theo Lô · Bảng Giá (VF)
  · Bảng Giá NPP · Phân Tích Định Giá.
- *Điều Chỉnh Tham Số*: Tham Số · Cấu Hình Nhà Máy.

**3. Dọn guard vai chết:** bỏ khối full-screen "Màn hình này chỉ dành cho vai X"
trong PricingAnalytics/TargetCosting/Tham Số/Cấu Hình — vô nghĩa vì chỉ admin/pricing
đăng nhập được (ADR-023). **GIỮ** ranh giới bảo mật field-level khớp firestore.rules:
`thresholdPct` admin-only (ADR-015), field chiến lược currency/markup admin-only
(`pricingLocked`) — đây là bảo mật, KHÔNG phải điều hướng theo vai.

## Hệ quả
- Engine/schema/backend KHÔNG đổi (chỉ gỡ UI) — parity 343/343 giữ nguyên.
- Cloud Functions vận hành (onPlanInputWrite, productCatalog…) vẫn còn ở backend,
  không gây rối UI; có thể dọn sau nếu muốn.
- Dashboard còn cờ `canSeeCostDetail` (luôn true) + nhánh sales dự phòng: giữ nguyên
  lần này vì gỡ trọn là refactor rủi ro trên màn dùng nhiều nhất; dọn sau nếu cần.
