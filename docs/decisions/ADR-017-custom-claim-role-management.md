# ADR-017: Cơ chế cấp/thu hồi custom claim `role` cho Firebase Auth user thật

Ngày: 2026-07-10 | Trạng thái: CHẤP NHẬN

## Bối cảnh
`docs/contracts/scenario.md` "Còn treo" (chốt tại M12.10, security-review)
ghi rõ: cơ chế cấp role hiện tại (`scripts/seed-emulator.ts` gọi
`auth.setCustomUserClaims()` trực tiếp bằng Admin SDK) CHỈ dùng được cho user
demo trên Emulator — không phải luồng cấp quyền cho user thật. Trước khi trỏ
vào Firebase project thật, PHẢI thiết kế 1 trong 2 hướng đã nêu:
- (a) Cloud Function `onCall` admin-only gọi `setCustomUserClaims()`, ghi
  audit log ai cấp/thu hồi role cho ai;
- (b) console/quy trình vận hành thủ công ngoài app.

User được hỏi, chọn **(a)**, và chọn **chưa cần UI riêng** (gọi qua script/
console trước, dựng UI sau nếu nhu cầu thật xuất hiện).

## Quyết định
1. **Cloud Function `setUserRole`** (`functions/src/index.ts`, HTTPS Callable
   `onCall`) — admin-only:
   - Input: `SetUserRoleRequestSchema` = `{targetUid, role}` (role ∈
     `AppRoleSchema` = admin/pricing/sales/production, `src/schemas/role-management.ts`).
   - Check: `request.auth` tồn tại (unauthenticated nếu không) VÀ
     `request.auth.token.role === 'admin'` (permission-denied nếu không).
   - Đọc user hiện tại (`auth.getUser(targetUid)`, not-found nếu không tồn
     tại) để biết `oldRole` (parse qua `AppRoleSchema.safeParse` — user chưa
     từng có role hợp lệ thì `oldRole = null`, không throw).
   - `auth.setCustomUserClaims(targetUid, {...customClaims cũ, role: role mới})`
     — GIỮ các custom claim khác nếu có (không ghi đè toàn bộ object claims).
   - Ghi audit log `roleAudit/{entryId}` (top-level, KHÔNG dưới
     `scenarios/{id}` vì role không thuộc về 1 scenario) — APPEND ONLY, cùng
     pattern `priceLockAudit` (M12.10): `{targetUid, targetEmail, oldRole,
     newRole, changedByUid, changedByEmail, at: serverTimestamp()}`.
   - Trả `SetUserRoleResultSchema` = `{targetUid, targetEmail, oldRole, newRole}`.
2. **`firestore.rules`**: `match /roleAudit/{entryId} { allow read: if isAdmin(); allow write: if false; }`
   — chỉ admin đọc lịch sử cấp quyền, chỉ Cloud Function (Admin SDK, bỏ qua
   rules) ghi được.
3. **Vấn đề con-gà-quả-trứng** (chưa có admin nào thì không ai gọi được
   `setUserRole`): `scripts/bootstrap-admin.ts` — script chạy MỘT LẦN bằng
   Admin SDK trực tiếp (bỏ qua Cloud Function/rules, dùng
   `GOOGLE_APPLICATION_CREDENTIALS` trỏ service account key thật), cấp
   `role=admin` cho 1 user cụ thể (email hoặc uid). Có guard chặn chạy nhầm
   vào Emulator (`FIREBASE_AUTH_EMULATOR_HOST` set thì thoát) — Emulator đã có
   `seed-emulator.ts` lo riêng.
4. **Chưa có UI** — cấp role hiện tại gọi qua script/console
   (`firebase functions:call`/HTTP trực tiếp), vì tần suất đổi role thấp
   (không phải thao tác hàng ngày). Nếu nhu cầu thật xuất hiện (nhiều user,
   đổi role thường xuyên), dựng UI riêng là việc CODE THÊM sau, không đổi
   contract này.

## Hệ quả
- File mới: `src/schemas/role-management.ts`, `scripts/bootstrap-admin.ts`,
  `tests/functions/set-user-role.test.ts`.
- `functions/src/index.ts`: thêm export `setUserRole`.
- `firestore.rules`: thêm collection `roleAudit`.
- `package.json`: thêm script `bootstrap-admin`.
- `docs/contracts/scenario.md` "Còn treo": đánh dấu XONG, trỏ ADR này.
- Verify: `npm test` (root, không đổi — engine không đụng),
  `npm run test:functions` (Auth+Firestore+Functions Emulator thật — tạo
  user, set claim qua callable, đọc lại claim bằng `auth.getUser()` độc lập,
  xác nhận `roleAudit` ghi đúng), typecheck root+functions.
- **Chưa verify trên project thật** (`bmcosting-ver-2`) — cần user tự deploy
  `functions` (service account đã thử KHÔNG đủ quyền deploy, xem lịch sử
  phiên) rồi tự chạy `scripts/bootstrap-admin.ts` để có admin đầu tiên, sau đó
  gọi thử `setUserRole` xác nhận claim thật đổi trên user Auth thật.
