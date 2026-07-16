# ADR-023: Đăng nhập production thật (form email/mật khẩu) thay auto sign-in demo

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN

## Bối cảnh
ADR-020 (một view CEO) tạm thời **tự đăng nhập** vai `admin` bằng tài khoản demo
`admin@demo.local` để bỏ ma sát chọn vai — và ghi rõ ở §Hệ quả: "siết đăng nhập
production thật (form login, tắt tài khoản demo) là hạng mục hoãn". Nay làm phần
đó: đưa app lên trạng thái giao được cho người dùng thật (owner
`tuannq6886@gmail.com`).

## Quyết định

### 1. Form đăng nhập email/mật khẩu — bỏ auto sign-in
- `AppShell` KHÔNG còn `useEffect` tự gọi `signInAsRole('admin')`. Trạng thái
  `signed-out` render **màn đăng nhập** (email + mật khẩu) → `signInWithEmailAndPassword`.
- `useAuth` thêm `signIn(email, password)` (trả message lỗi nếu sai) + `signOut()`.
  `lib/firebase.ts` thêm `signInWithEmail(email, password)`.
- Vai lấy từ custom claim `role` của tài khoản đăng nhập (như cũ, `roleOf`).

### 2. Cổng vào = tầng chiến lược `admin`/`pricing` (ADR-006/020)
App là công cụ điều hành cho owner (admin). Sau đăng nhập:
- `role` ∈ {admin, pricing} → vào **view CEO** (toàn bộ tab, ADR-020).
- `role` ∈ {sales, production} hoặc chưa có claim → màn "Tài khoản không có quyền
  vào bảng điều khiển quản trị" + nút Đăng xuất. (sales/production không có nav
  riêng trên view CEO — nếu sau này cần, khôi phục điều hướng theo vai đã gỡ ở ADR-020.)
- Truyền `role` THẬT xuống màn (không hard-code 'admin') → gating từng màn +
  `useScenarioData` hoạt động đúng theo vai thật.

### 3. Nút Đăng xuất trên sidebar
Footer sidebar: hiện email + vai + nút **Đăng xuất** (`signOut()`).

### 4. Tài khoản demo — chỉ lối tắt ở EMULATOR
- Màn đăng nhập hiện **nút đăng nhập nhanh demo** (admin/pricing/sales/production)
  CHỈ khi `isEmulatorMode` — tiện dev, không lộ ở production.
- Production (`isEmulatorMode=false`): chỉ có form. **Tắt tài khoản demo** ở
  production là bước vận hành (Firebase Console/`auth.updateUser({disabled:true})`)
  — ghi rõ, KHÔNG tạo demo user ở project thật ngoài mục đích test.

## Hệ quả
- Thay thế cơ chế auto-login của ADR-020 (ADR-020 §Hệ quả đã dự trù). Backend
  (rules theo vai, claim) không đổi.
- `signInAsRole` (demo theo vai) GIỮ cho lối tắt emulator + script seed; không
  còn là đường đăng nhập chính.
- Owner `tuannq6886@gmail.com` (seed role=admin, ADR trước) đăng nhập bằng form,
  vào view CEO đầy đủ.
- Còn treo: đăng nhập Google (owner dùng Gmail) — hiện email/mật khẩu; thêm nút
  Google Sign-In là bước sau nếu owner muốn (không đổi kiến trúc, chỉ thêm provider).
