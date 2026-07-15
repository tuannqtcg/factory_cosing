# ROADMAP — Dự án Tính Giá Thành & Định Giá (factory_cosing)

> **Mục đích:** File này là điểm neo (Anchor) cho AI ở đầu mỗi phiên. AI đọc file này để hiểu tổng quan dự án đang ở giai đoạn nào, những gì đã hoàn tất, và những gì cần làm tiếp theo. Không cần đọc lại toàn bộ lịch sử chat.

## 🟢 Tóm tắt trạng thái hiện tại
- **Pha 1 & 2:** Xong (Phân tích Excel v3.4, thiết kế Zod schemas, quy định kiến trúc không phụ thuộc mạng).
- **Pha 3 (Engine & Tính toán):** Xong (pass 372+ assertion tests khớp hoàn toàn file Excel gốc, engine hoạt động pure chức năng toán học).
- **M12 (Giao diện UI/UX):** Xong cơ bản (Dashboard, Bảng giá, Danh mục Sản phẩm, Kế hoạch Sản xuất, Tồn kho vật tư).
  - Đã tích hợp tính năng đa nguyên liệu (Multi-material: Corzan & BlazeMaster).
  - Đã chuẩn hoá giao diện Desktop (Max-width 1366px, căn giữa).

## 🏆 Đã hoàn thành gần đây (Tháng 7/2026)
- [x] Tách tồn kho Ren Kim Loại ra khỏi Tồn Kho Hạt Nhựa để UI không bị rối.
- [x] Sửa lỗi Focus Input khi nhập liệu trên bảng Sản Phẩm (Lỗi React re-render).
- [x] Bổ sung các công cụ nạp nhanh (Seed) cho nguyên liệu Corzan và sản phẩm Ống Corzan SCH40.
- [x] **Firebase thật (Production)**: project `bmcosting-ver-2`, database "manufacture" (ADR-016), seed baseline, deploy Render (Vite build).
- [x] **Phân quyền Custom Claims**: Cloud Function `setUserRole` + audit log (ADR-017), script tạo 4 user demo thật với role (admin/pricing/sales/production).
- [x] **Tham số Ống v3.7** (3 máy đùn, khấu hao 10 năm, khuôn kéo/cắt riêng 3 năm — ADR-019): tái lập toàn bộ số vàng fixture, `npm test` xanh lại 328/328.
- [x] CAPEX nhà xưởng + vốn lưu động nhập động (ADR-018), Dashboard chia 4 tab (Progressive Disclosure).

---

## 🚀 Việc cần làm tiếp theo (Pha 4 & Vận hành thực tế)

### 1. Kiểm thử & Phân quyền (Security UI) — việc treo từ 2026-07-13
- [ ] Đăng nhập thử 4 vai trò thật (Admin, Pricing, Sales, Production) trên UI, xác nhận Sales không thấy chi phí/giá thành, Production chỉ thấy kế hoạch, nút Lưu/Sửa bị khóa đúng vai.
- [ ] Chạy `npm run test:rules` + `npm run test:functions` (cần emulator) xác nhận rules khớp UI.

### 2. Tinh chỉnh và Vá lỗi nghiệp vụ (nếu có)
- [ ] Chờ danh mục ống SCH80 chuẩn từ nhà cung cấp để cập nhật lại Seed Data.
- [ ] Kiểm tra lại toàn bộ quy trình từ khâu nhập Tồn kho -> Thay đổi định mức -> Tính giá thành -> Khóa giá -> Báo giá xem có bị khựng ở bước nào không.
- [ ] Khi có Excel v3.7 chính thức: trích lại fixture bằng cached-value để thay số vàng engine-derived (ghi chú ADR-019).

---

## 📝 Hướng dẫn cho AI bắt đầu phiên mới
1. Đọc lướt qua file `ROADMAP.md` này.
2. Nếu User giao task mới, hãy ghi chú task đó vào phần **Việc cần làm tiếp theo**.
3. Khi hoàn thành một tính năng lớn, hãy di chuyển nó lên phần **Đã hoàn thành gần đây**.
4. Giữ file này ngắn gọn, tránh viết quá chi tiết về mặt kỹ thuật (chi tiết kỹ thuật để ở các file ADR).
