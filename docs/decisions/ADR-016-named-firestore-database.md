# ADR-016: Firestore project thật dùng database đặt tên `manufacture` (không phải `(default)`)

Ngày: 2026-07-10 | Trạng thái: CHẤP NHẬN

## Bối cảnh
Khi tạo Firebase project thật đầu tiên (`bmcosting-ver-2`, chuẩn bị cho cơ chế
cấp custom claim `role` — xem "Còn treo" ở `docs/contracts/scenario.md`), user
tạo Firestore database với **Database ID = `manufacture`** thay vì mặc định
`(default)`. Toàn bộ code (`src/lib/firebase.ts`, `functions/src/index.ts`,
`firebase.json`) từ M12 đều viết cứng theo giả định chỉ có 1 database
`(default)` duy nhất trên mỗi project.

2 phương án trình user:
- (a) Tạo lại 1 database khác với ID `(default)` trên cùng project, xóa
  `manufacture` — không cần sửa code, an toàn tuyệt đối với Emulator/test hiện
  có.
- (b) Giữ `manufacture`, sửa code để trỏ đúng.

**User chọn (b).**

## Rủi ro kỹ thuật đã xác nhận trước khi code
Cloud Functions Gen2 Firestore trigger (`onDocumentWritten`) mặc định lắng
nghe database `(default)`. Nếu chỉ đổi nơi ĐỌC/GHI (`getFirestore()`) mà
không đổi cấu hình TRIGGER, function sẽ tiếp tục lắng nghe `(default)` (trống
rỗng trên project `bmcosting-ver-2`) và **không bao giờ chạy** khi ghi vào
`manufacture` — lỗi âm thầm, không có exception, dễ tưởng nhầm "đã deploy
xong" mà không phát hiện ra cho tới khi user báo "sao không thấy tính lại".

Đã verify THẬT bằng Firestore Emulator (không chỉ đọc doc Firebase): viết
song song vào 2 handle `getFirestore(app)` (default) và
`getFirestore(app, 'manufacture')` cùng 1 project trên Emulator — xác nhận 2
database **cô lập hoàn toàn** (ghi vào 1 bên không thấy ở bên kia), và cả 2
đều hoạt động bình thường (Emulator cho phép bất kỳ tên database nào, dù CLI
cảnh báo "does not support multiple databases" — cảnh báo đó chỉ nói về việc
Emulator không tải được 2 bộ RULES khác nhau cho 2 database cùng lúc, không
phải cấm dùng tên khác `(default)`).

## Quyết định
1. **Tham số hóa tên database** bằng `firebase-functions/params.defineString`
   thay vì hard-code chuỗi, để 1 bộ code chạy đúng trên cả Emulator (project
   demo, default `(default)`) lẫn project thật (`manufacture`):
   ```ts
   const firestoreDatabaseId = defineString('FIRESTORE_DATABASE_ID', { default: '(default)' });
   ```
2. **Trigger + đọc/ghi đều dùng CÙNG 1 tham số này**: `onDocumentWritten({document, database: firestoreDatabaseId}, ...)` và `getFirestore(firestoreDatabaseId.value())` — cả `onScenarioWrite`, `onPlanInputWrite`, `computeTargetCosting`.
3. **`functions/.env.bmcosting-ver-2`** (Firebase Functions Gen2 tự nạp file
   `.env.<projectId>` — CHỈ áp dụng khi deploy/emulate đúng project đó, KHÔNG
   áp dụng cho project demo dùng ở test): `FIRESTORE_DATABASE_ID=manufacture`.
   Không phải secret (chỉ là tên database) — commit bình thường, thêm ngoại lệ
   trong `.gitignore` (`!functions/.env.bmcosting-ver-2`) vì rule chung
   `.env.*` sẽ chặn nhầm.
4. **Client** (`src/lib/firebase.ts`): thêm `VITE_FIREBASE_DATABASE_ID`
   (optional) — dùng `getFirestore(app, databaseId)` khi CÓ set VÀ không chạy
   Emulator; giữ nguyên `getFirestore(app)` cho Emulator.
5. **`firebase.json`**: `firestore.database = "manufacture"` — xác nhận bằng
   đọc thẳng source `firebase-tools` (`lib/firestore/fsConfig.js`): field
   `database` trên object đơn (không phải mảng) chỉ ảnh hưởng lệnh
   `firebase deploy` (chọn đúng database đích trên project thật), KHÔNG ảnh
   hưởng Emulator (Emulator không đọc field này để quyết định tên database
   phục vụ).
6. **`.firebaserc`**: thêm alias `"production": "bmcosting-ver-2"` — alias
   `"default": "demo-costing-app"` giữ nguyên (mọi script emulator/test không
   truyền `--project` nên không bị ảnh hưởng).

## Hệ quả
- `npm test` 328/328, `npm run typecheck` (root + functions) sạch — không đụng
  engine.
- `npm run test:functions` chạy lại trên Emulator (project demo, KHÔNG có file
  `.env.demo-costing-app` nên `firestoreDatabaseId` rơi về default
  `(default)` trong code) — xác nhận hành vi cũ giữ nguyên 100%, không phải
  đoán.
- **Verify trên project thật (2026-07-10) — XONG**: user tự deploy qua Google
  Cloud Shell (`firebase login` tài khoản cá nhân — service account key không
  đủ quyền như dự đoán ở mục "Rủi ro"), publish `firestore.rules` thủ công
  qua Console cho đúng database `manufacture`, rồi `npm run seed:production`
  ghi `scenarios/baseline-v3.4` — xác nhận Cloud Function `onScenarioWrite`
  tự tạo đủ 3 sub-document `outputs/internal`, `outputs/priceList`,
  `outputs/productCatalog` với dữ liệu KHÔNG rỗng, đúng trong database
  `manufacture` (không phải `(default)`, không phải database nào khác trong
  9 database của project dùng chung). Tham số hóa `database` ở trigger hoạt
  động đúng như thiết kế — không còn là rủi ro lý thuyết.
- Nếu sau này thêm database thứ 2 cho mục đích khác (vd multi-tenant), cách
  làm đúng là thêm 1 `defineString` tham số MỚI (không tái dùng biến này) —
  tránh lặp lại giả định "mỗi project chỉ 1 database" ở chỗ khác.
