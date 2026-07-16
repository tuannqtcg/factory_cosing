# ADR-020: Hợp nhất UI thành một view CEO duy nhất (bỏ điều hướng theo vai)

Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

## Bối cảnh
ADR-006 phân tầng đối tượng (sales / production / pricing / admin) và cho phép
"Xem Như Vai" ngay trên sidebar — mỗi vai thấy một tập tab khác nhau
(`ROLE_TAB_ACCESS` trong `AppShell.tsx`). Trong thực tế vận hành, người dùng chính
của app là **một người điều hành (CEO/chủ nhà máy)** tự xem toàn cảnh và tự chỉnh
tham số. Việc phải chọn vai rồi mới thấy được màn tương ứng tạo ma sát nhận thức
không cần thiết: "tôi không cần xem theo role nữa, một view CEO là đủ; cần cấu
hình tham số nào thì vào chi tiết sửa sau".

Đồng thời phiên gần nhất (ADR-018) đã chứng minh **Progressive Disclosure** (chia
Dashboard thành 4 tab: Tổng Quan → Sản Xuất → Đầu Tư → Chiến Lược Giá) là cách
trình bày hiệu quả cho góc nhìn điều hành: cần đến đâu xem đến đó.

## Quyết định
Gộp trải nghiệm client thành **một view CEO duy nhất** = view `admin` (toàn quyền):

1. **Bỏ role switcher** ("Chọn Vai") và bỏ lọc tab theo vai (`ROLE_TAB_ACCESS`)
   trong `AppShell.tsx`. Sidebar hiện TOÀN BỘ màn, chia 2 nhóm điều hướng theo
   mục đích chứ không theo quyền:
   - **ĐIỀU HÀNH**: Tổng Quan (Dashboard), Bảng Giá, Kế Hoạch SX, Phân Tích Định Giá.
   - **CẤU HÌNH & DỮ LIỆU**: Tồn Kho, Danh Mục SP, Cấu Hình Nhà Máy, Tham Số,
     Ống CPVC, Phụ Kiện. (Đây là "vào chi tiết sửa cấu hình".)
2. **Đăng nhập tự động vào vai CEO/admin**. Màn signed-out không còn bắt chọn vai;
   app tự `signInAsRole('admin')` khi tải, thất bại thì hiện nút thử lại.
   *Posture bảo mật KHÔNG đổi so với trước:* nút "admin" trong role switcher cũ
   vốn đã đăng nhập demo admin chỉ với 1 click, không hỏi mật khẩu — nay chỉ bớt
   số lần bấm, không mở thêm quyền nào.
3. **Giữ nguyên toàn bộ backend theo vai** — `firestore.rules`, custom claim
   `role`, Cloud Function `setUserRole` (ADR-017), `AppRole` type, các hàm
   `signInAsRole`/`roleOf`. Không rip bỏ để (a) vẫn bảo vệ dữ liệu thật ở tầng
   server, (b) đảo ngược được nếu sau này cần lại nhiều vai.
4. **Không đụng từng màn**: shell truyền cố định `role='admin'` xuống mọi screen,
   nên `canEdit`/`canSeeCostDetail` tự bật hết — không phải gỡ logic gating trong
   từng component (giữ chúng để đảo ngược dễ).

## Hệ quả
- ADR-006 (phân tầng vai trên UI) bị **thay thế ở tầng client**: 4 tầng vai không
  còn xuất hiện trong điều hướng. Phần backend/security của ADR-006 vẫn giữ.
- Nếu sau này cần deploy đa người dùng (sales/production đăng nhập thật): khôi phục
  role switcher + `ROLE_TAB_ACCESS` (còn nguyên trong lịch sử git) và tắt auto
  sign-in. Backend không cần đổi vì rules theo vai vẫn còn.
- Việc siết đăng nhập production thật (form login, tắt tài khoản demo) là hạng mục
  vận hành tách riêng, **hoãn** — ghi nhận rõ ở đây để không nhầm là đã xong.
- Bộ test parity engine không bị ảnh hưởng (không chạm engine/schema/rules).
