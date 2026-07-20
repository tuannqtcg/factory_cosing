# ADR-045 — App tự tính client-side (bỏ phụ thuộc Cloud Function onScenarioWrite)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user duyệt "cách B" phiên 2026-07-20)
- **Kế thừa**: ADR-016 (Cloud Function tính outputs), ADR-026 (chỉ admin/pricing đăng nhập)

## Bối cảnh
Bảng Giá cập nhật danh mục nhưng KHÔNG lên. Truy vết: project chung `bmcosting-ver-2` — danh sách Cloud Functions chỉ còn api/chatbot/crm/sso của app KHÁC; `onScenarioWrite` (hàm tính `outputs/priceList`) đã BỊ XÓA (khi app khác chạy `firebase deploy --only functions` từ codebase riêng, CLI xóa function không thuộc nó). Hậu quả: Lưu gì cũng không ai tính lại → Bảng Giá đứng im ở bản BM cũ.

## Quyết định
App CHỈ admin/pricing (đã đọc được scenario đầy đủ) → cho client TỰ TÍNH, thoát hẳn phụ thuộc Cloud Function:
1. Tách `toPriceListDoc` → `src/engine/price-list-doc.ts` dùng CHUNG (functions + client), bỏ bản copy trong functions.
2. `useScenarioData` (admin/pricing): subscribe `scenarios/{id}` → tính `internal` + `priceList` NGAY bằng `calculateScenario` + `toPriceListDoc`, KHÔNG đọc `outputs/*`. Lưu là thấy ngay. Lỗi dữ liệu gốc (SKU trỏ nguyên liệu đã xóa…) lộ ngay thay vì giá cũ sai.
3. Sales (chưa dùng theo ADR-026) vẫn đọc `outputs/priceList` do function tính (nếu có).

## Hệ quả
- App không còn bị hỏng khi app khác deploy/xóa function trong project chung.
- Cloud Function trở thành TÙY CHỌN (chỉ cần nếu khôi phục vai sales / kiến trúc cũ).
- Công tắc ADR-047 hoạt động tức thì nhờ cơ chế tự tính này.

## Còn treo
Cân nhắc TÁCH Firebase project riêng cho costing để hết rủi ro dùng chung.
