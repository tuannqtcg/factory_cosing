# ADR-018: Bổ sung Đầu tư CAPEX & Vốn lưu động Động

## Ngữ cảnh
Công thức tính "Thời gian hoàn vốn" (Payback Period) trong Dashboard (mục IV) hiện tại đang bị thiếu hụt một lượng lớn Vốn đầu tư (chỉ tính máy móc, khuôn). User yêu cầu phần mềm đóng vai trò công cụ quản trị sản xuất, do đó không được code cứng mà phải cho phép nhập/khởi tạo các thông số đầu tư cơ bản còn thiếu (Xây dựng, Phụ trợ, Vốn lưu động) trực tiếp trên app.

## Quyết định
1. **Schema**: Mở rộng `SharedFixedCostsSchema` trong `src/schemas/cost-pool.ts` với 3 trường mới (đơn vị: VNĐ):
   - `factoryConstructionCost`: Đầu tư nhà xưởng/hạ tầng.
   - `utilitySetupCost`: Đầu tư hệ thống phụ trợ (điện, nước, khí nén...).
   - `workingCapital`: Vốn lưu động ban đầu.
2. **Logic tính toán**: Sửa `calculateDashboardKpis` (`src/engine/dashboard-support.ts`) để cộng 3 trường này vào `totalFixedCapitalInvested`. 
   *Lưu ý: `workingCapital` không đưa vào tính khấu hao, chỉ cộng vào vốn đầu tư ban đầu.*
3. **Giao diện**: Thêm các input này vào màn hình Cấu Hình (VD: Tab Tổng Quan trong `ConfigScreen` hoặc `AssumptionsScreen`) để admin có thể thay đổi.
4. **Fixtures**: Cập nhật `assumptions.json` (thêm 3 trường bằng 0) để tương thích ngược.

## Hệ quả
- Khắc phục lỗi thời gian hoàn vốn "không tưởng" (0.8 năm).
- Đảm bảo tính linh hoạt khi cấu hình kịch bản đầu tư nhà máy mới.
