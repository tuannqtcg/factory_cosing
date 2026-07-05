# CLAUDE.md — Costing App

Đọc `AGENTS.md` trước (luật chung mọi agent). File này chỉ chứa đặc thù Claude Code.

## Đặc thù Claude Code
- Skills trong `.claude/skills/` — tự nạp theo pha làm việc, đừng nạp thủ công cả bộ.
- Trước khi code: xác định đang ở PHA nào (xem AGENTS.md). Nếu chưa có prototype
  được duyệt hoặc schema đóng băng → từ chối viết code production, đề nghị quay về pha đúng.
- Test: `npm test` phải xanh trước mọi commit. Parity test với Excel là bắt buộc,
  xem skill `excel-parity-testing`.
- Khi user yêu cầu mơ hồ → hỏi lại 1 câu chốt phạm vi, không tự suy diễn phạm vi rộng.

## Lệnh thường dùng
- `npm run dev` / `npm test` / `npm run typecheck`
- Xuất fixture mới từ Excel: `npm run extract-fixtures` (đọc BlazeMaster_Model_v3_4.xlsx)
