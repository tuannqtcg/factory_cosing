# ADR-022: HTTPS Callable `adviseScenario` — AI tư vấn CEO gọi Claude API phía server

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN (đóng băng hợp đồng Pha 2)

## Bối cảnh
Brief CEO Planner (mục "Bước 3") có nút 🤖 AI Tư Vấn: sau khi chạy số liệu, AI đọc
kết quả và nhận định trước bàn đàm phán (sàn giá lùi tới đâu, rủi ro giá nguyên
liệu/tồn kho, độ tin cậy thu hồi vốn, bức tranh năm). Prototype Pha 1 làm MOCK
rule-based trong trình duyệt; brief đã hẹn "Pha 2 ra ADR riêng cho callable
`adviseScenario` gọi Claude API phía server". Đây là ADR đó.

Ràng buộc bất biến chạm tới (AGENTS.md #3): **không secret/API key trong code
client**. Anthropic API key là secret → không được lộ ra bundle Vite.

## Quyết định

### 1. HTTPS Callable `adviseScenario` (onCall), KHÔNG Firestore trigger
Tư vấn là hành động RỜI RẠC theo yêu cầu người dùng (bấm nút) — đúng bản chất
request/response, chọn `onCall` (cùng lý lẽ ADR-010 mục 3 cho `computeTargetCosting`).

### 2. Quyền: custom claim `role` ∈ {`pricing`, `admin`} (tầng chiến lược ADR-006)
Kiểm ngay đầu callable từ `request.auth.token.role`. Chưa đăng nhập →
`unauthenticated`; sai vai → `permission-denied`; request sai schema →
`invalid-argument`; scenario không tồn tại → `not-found`. (Đối xứng ADR-013 mục 5.)

### 3. Hợp đồng dữ liệu (đóng băng `src/schemas/ceo-planner.ts`)
- Request `CeoAdviceRequestSchema` = `{ scenarioId, plannerResult }`. **CHỈ gửi
  số liệu OUTPUT đã tính** (`CeoPlannerResult`), KHÔNG gửi `ScenarioInput` thô —
  giữ ranh giới dữ liệu (security-review). Server tự đọc scenario bằng Admin SDK
  nếu cần bối cảnh, không nhận từ client.
- Response `CeoAdviceResultSchema` = `{ generatedByModel, items[], disclaimer? }`.
  `items[]` = danh sách nhận định `{ topic, message }`.

### 4. Gọi Claude API phía server, key qua Firebase Secret
- API key nạp qua `defineSecret('ANTHROPIC_API_KEY')` (Cloud Functions v2 secret),
  set bằng `firebase functions:secrets:set` — KHÔNG commit, KHÔNG ở client.
- Model Claude cấu hình qua tham số (`defineString('ADVISE_MODEL', …)`), mặc định
  chốt ở Pha 3 (một dòng Claude mới nhất phù hợp — ưu tiên độ chính xác suy luận
  trên chi phí, vì tần suất gọi thấp/thủ công). `generatedByModel` trả về id thật
  đã dùng để audit.
- Prompt gửi Claude: số liệu `plannerResult` + khung nhiệm vụ "tư vấn đàm phán
  giá theo thang giá 5 bậc"; nhiệt độ thấp; giới hạn token đầu ra. Bản thật đọc
  hướng dẫn API tại skill `claude-api` khi code Pha 3.

### 5. Fallback mock rule-based — GIỮ
Bản mock trong prototype (`adviceFor()`) chuyển thành `src/engine/ceo-advice-mock.ts`
(pure, không network) làm (a) fallback khi callable lỗi/hết quota, (b) test được
bằng `npm test` không cần API thật. Callable thật bọc quanh, lỗi → trả mock +
`generatedByModel:'mock'`.

### 6. Audit log
Mỗi lần gọi ghi 1 entry `scenarios/{id}/adviceAudit/{autoId}`:
`{ uid, email, role, model, at, scenarioId }` (KHÔNG lưu nội dung tư vấn/số liệu
nhạy cảm — chỉ dấu vết ai gọi, khi nào, model gì). Đối xứng `priceLockAudit`
(M12.10). `firestore.rules`: `adviceAudit/*` client `allow read` theo vai
admin/pricing, `allow write: if false` (chỉ Admin SDK ghi).

## Hệ quả
- Pha 3: viết `functions/src/index.ts::adviseScenario` (auth + parse Zod + đọc
  scenario + gọi Claude + fallback mock + audit) + `src/engine/ceo-advice-mock.ts`.
- Thêm dependency `@anthropic-ai/sdk` vào `functions/package.json` (server-only,
  KHÔNG vào `package.json` client).
- `firestore.rules`: thêm rule collection `adviceAudit` (đối xứng `priceLockAudit`).
- Chi phí API: gọi thủ công theo phiên đàm phán (thấp) — không vòng lặp tự động.
- Rủi ro: phụ thuộc mạng/quota → đã có fallback mock (mục 5) nên nút không bao
  giờ "chết".
