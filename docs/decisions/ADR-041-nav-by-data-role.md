# ADR-041 — Điều hướng theo QUYỀN CHẠM DỮ LIỆU + dọn rò ghi-thật + cầu nối giả định→thật

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user yêu cầu trực tiếp phiên 2026-07-20)
- **Kế thừa**: ADR-034 (điều hướng theo tình huống), ADR-026 (một view CEO)

## Bối cảnh
User thấy app rối: không biết màn nào là "giả định", màn nào "thật", cái thật tác động view nào; tính chồng chéo cao. Kiểm chứng code: chỉ 5 màn ghi `scenarios/{id}` (Tham Số, Danh Mục, Cấu Hình, Tồn Kho, Dashboard). Dashboard là màn "xem" nhưng lén ghi (nút Chốt Baseline). CEO Planner tính tại chỗ, KHÔNG lưu (giả định thuần).

## Quyết định
1. **Sidebar 3 nhóm theo vai dữ liệu**, thứ tự dùng hằng ngày, dùng chung ngôn ngữ màu:
   - ⚪ **Theo dõi** (chỉ xem): Tổng Quan · Bảng Giá.
   - 🔵 **Thử & Hoạch định** (giả định, không lưu): Trợ Lý CEO · Nhận Đơn · Giá Vốn Lô · So Sánh · Độ Nhạy · Product-mix.
   - 🔴 **Dữ liệu gốc** (chỉnh thật, đặt cuối như "vùng cẩn thận"): Tham Số · Danh Mục · Cấu Hình.
2. **Nhãn vai đầu MỌI màn** (một chỗ trong AppShell): CHỈ XEM / GIẢ ĐỊNH—chưa lưu / CHỈNH THẬT—lưu là tính lại, đồng bộ màu sidebar + bản đồ app.
3. **Dọn rò**: Dashboard KHÔNG còn ghi thật — bỏ nút "Chốt Baseline Mới" (updateDoc materials) → link "Chỉnh ở Tham Số →". Chốt baseline chỉ còn MỘT nhà.
4. **Cầu nối duy nhất giả định→thật** ở Trợ Lý CEO: "Biến giả định thành thật" (chốt → so sánh → áp dụng, ghi CHỈ giá compound + markup + baseline, có xác nhận). Số ca/tỷ lệ máy KHÔNG đổi.
5. **Quản lý nguyên liệu bằng tay** trong Tham Số: thêm/xóa/đổi tên compound (xóa bị chặn nếu còn SKU tham chiếu).

## Hệ quả
Người dùng nhìn màu là biết chế độ. Không field nào sửa được ở 2 màn (mỗi dữ liệu một nhà). Ranh giới đọc/ghi rõ ràng.
