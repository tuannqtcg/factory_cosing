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

---

## 🚀 Việc cần làm tiếp theo (Pha 4 & Vận hành thực tế)

### 1. Triển khai Firebase thật (Production)
- [ ] Thiết lập Project Firebase thật (hiện tại toàn bộ dữ liệu đang lưu trên Local Emulator).
- [ ] Chuyển cấu hình môi trường `.env` sang project thật.

### 2. Quản lý phân quyền (Auth & Custom Claims)
- [ ] Áp dụng Firebase Custom Claims cho các quyền (Admin, Viewer, Pricing).
- [ ] Viết chức năng hoặc Cloud Function để gán quyền cho các User thật.
- [ ] Đảm bảo UI khóa lại các nút "Lưu" hoặc "Chỉnh sửa" nếu User không có quyền.

### 3. Màn hình "Trợ Lý CEO" + nút AI tư vấn (yêu cầu user 2026-07-15)
- [x] Pha 0-1: brief + prototype (`prototype/ceo-planner.html`), đã qua **7 vòng
      góp ý user cùng ngày** — toàn bộ quyết định đã chốt (markup trên giá vốn,
      thuê mặt bằng 800tr/năm thay thuê đất 525, doanh thu VF không TCG/niêm yết,
      không viết tắt, font Be Vietnam Pro, chọn dòng BlazeMaster/Corzan 1 nơi,
      bảng giá 83 SKU phụ kiện theo cái) ghi tại
      `docs/briefs/BRIEF-2026-07-15-ceo-planner.md` §"Quyết định đã chốt" —
      **CHỜ USER GẬT ĐẦU CHỐT CỔNG PHA 1**.
- [ ] Hỏi user khi chốt cổng: thuế TNDN 20% chuẩn hay ưu đãi? (hiện là ước tính minh họa)
- [ ] Pha 2 (sau khi duyệt UI): (a) ADR AI tư vấn — callable Cloud Function
      `adviseScenario` gọi Claude API phía server (không key ở client) + contract
      dữ liệu gửi đi; (b) ADR + schema "thuê mặt bằng theo năm" thay
      `sharedFixedCosts.annualLandRent` (cập nhật fixture trước, luật Excel→fixture→code).
- [ ] Pha 3: code màn hình vào `src/features/ceo-planner/`, thay công thức nhúng bằng `src/engine/*`.

### 4. Tinh chỉnh và Vá lỗi nghiệp vụ (nếu có)
- [ ] Chờ danh mục ống SCH80 chuẩn từ nhà cung cấp để cập nhật lại Seed Data.
- [ ] Kiểm tra lại toàn bộ quy trình từ khâu nhập Tồn kho -> Thay đổi định mức -> Tính giá thành -> Khóa giá -> Báo giá xem có bị khựng ở bước nào không.

---

## 📝 Hướng dẫn cho AI bắt đầu phiên mới
1. Đọc lướt qua file `ROADMAP.md` này.
2. Nếu User giao task mới, hãy ghi chú task đó vào phần **Việc cần làm tiếp theo**.
3. Khi hoàn thành một tính năng lớn, hãy di chuyển nó lên phần **Đã hoàn thành gần đây**.
4. Giữ file này ngắn gọn, tránh viết quá chi tiết về mặt kỹ thuật (chi tiết kỹ thuật để ở các file ADR).
