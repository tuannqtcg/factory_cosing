# ROADMAP — Dự án Tính Giá Thành & Định Giá (factory_cosing)

> **Mục đích:** File này là điểm neo (Anchor) cho AI ở đầu mỗi phiên. AI đọc file này để hiểu tổng quan dự án đang ở giai đoạn nào, những gì đã hoàn tất, và những gì cần làm tiếp theo. Không cần đọc lại toàn bộ lịch sử chat.

## 🟢 Tóm tắt trạng thái hiện tại
- **Pha 1 & 2:** Xong (Phân tích Excel v3.4, thiết kế Zod schemas, quy định kiến trúc không phụ thuộc mạng).
- **Pha 3 (Engine & Tính toán):** Xong (pass 372+ assertion tests khớp hoàn toàn file Excel gốc, engine hoạt động pure chức năng toán học).
- **M12 (Giao diện UI/UX):** Xong cơ bản (Dashboard, Bảng giá, Danh mục Sản phẩm, Kế hoạch Sản xuất, Tồn kho vật tư).
  - Đã tích hợp tính năng đa nguyên liệu (Multi-material: Corzan & BlazeMaster).
  - Đã chuẩn hoá giao diện Desktop (Max-width 1366px, căn giữa).

## 🏆 Đã hoàn thành gần đây (Tháng 7/2026)
- [x] **ADR-019 (14/07)**: Khôi phục 328/328 test parity sau "big update" — bộ số vàng v3.8
  theo tham số nhà máy thật (3 máy đùn, khuôn 3,73 tỷ/3 năm, máy đùn 10 năm). Từ v3.8,
  fixture + ADR là nguồn chân lý tham số đầu tư dòng Ống. Đã chốt: "giá bán tiêu chuẩn" = giá VF.
- [x] Sửa bug Rules of Hooks ở WhatIfScreen (crash khi dữ liệu tải xong) + helper test thiếu `moldDepreciationYears` (NaN).
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

### 3. Trải nghiệm cho vai Đầu tư / Bán hàng (SOP đơn lẻ & MOQ — user duyệt hướng 14/07)
> **PHIÊN MỚI BẮT ĐẦU TỪ ĐÂY**: đọc ADR-019→023 (đặc biệt **ADR-023** — triết lý phân tầng
> tham số + vòng đời kịch bản của user, là đặc tả gốc cho Pha 2). Việc kế tiếp đã chốt:
> **Pha 2 — đóng băng schema một lần cho cả cụm**: lineSpeedMPerHour+speedConfirmed,
> dieGroup, setupCost, moq 2 tầng, metadata kịch bản (draft/approved/label/so sánh),
> preset 3 kịch bản Xấu/Trung bình/Khả quan. Prototype đã duyệt: artifact
> "Phiếu Báo Giá Tiêu Chuẩn VF" (layout finapp, sidebar what-if).
- [ ] Màn "Phiếu báo giá tiêu chuẩn VF": giá 1 SKU (Ống + Phụ kiện) kèm ghi chú tự sinh (neo công suất,
  trạng thái khóa giá NVL, tỷ giá, chuỗi markup, ngày hiệu lực) — prototype Pha 1 iteration 3 đã duyệt hướng:
  **layout finapp: sidebar tham số đầu vào (what-if giá hạt/tỷ giá/ca máy/markup/C_setup) bên trái,
  kết quả sống bên phải; khóa giá ADR-004 hiển thị sống; giá what-if gắn nhãn không dùng báo khách.**
- [ ] Engine `setup-cost` + `moq`: MOQ_kg = C_setup ÷ (giá VF − sàn biến phí bậc 1); cột MOQ trên bảng giá.
- [ ] What-if giá NVL ±% (màn What-If hiện chỉ mô phỏng ca/hệ số huy động) + kịch bản nháp (không đụng dữ liệu thật).

### 4. Tinh chỉnh và Vá lỗi nghiệp vụ (nếu có)
- [ ] Chờ danh mục ống SCH80 chuẩn từ nhà cung cấp để cập nhật lại Seed Data.
- [ ] Kiểm tra lại toàn bộ quy trình từ khâu nhập Tồn kho -> Thay đổi định mức -> Tính giá thành -> Khóa giá -> Báo giá xem có bị khựng ở bước nào không.

---

## 📝 Hướng dẫn cho AI bắt đầu phiên mới
1. Đọc lướt qua file `ROADMAP.md` này.
2. Nếu User giao task mới, hãy ghi chú task đó vào phần **Việc cần làm tiếp theo**.
3. Khi hoàn thành một tính năng lớn, hãy di chuyển nó lên phần **Đã hoàn thành gần đây**.
4. Giữ file này ngắn gọn, tránh viết quá chi tiết về mặt kỹ thuật (chi tiết kỹ thuật để ở các file ADR).
