# ADR-040 — Trợ Lý Ảo toàn app (Claude API, kiến thức ngành CPVC + nghiệp vụ app)

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user yêu cầu trực tiếp trong phiên 2026-07-18)
- **Kế thừa**: ADR-022 (adviseScenario — hạ tầng Claude phía server), ADR-035
  (giải thích tại chỗ — trợ lý là tầng thứ 3: ⓘ tĩnh → truy nguyên số → hỏi tự do)

## Bối cảnh

Nguyên tắc ADR-035 "cần đến đâu show đến đó, giải thích đến đó". User muốn thêm
một trợ lý ảo riêng của ứng dụng, hiểu sâu ngành sản xuất ống/phụ kiện nhựa
CPVC và toàn bộ nghiệp vụ app — những gì UI giải thích chưa đủ thì trợ lý nói nốt.

## Quyết định

1. **Callable `askAssistant`** (functions): auth admin/pricing; Zod parse 2 đầu
   (`AssistantAskRequestSchema`/`AssistantAnswerSchema`); đọc scenario +
   outputs/internal bằng Admin SDK và gửi NGỮ CẢNH GỌN (nguyên liệu, markup,
   thang giá đ/kg, trạng thái khóa giá — toàn số ĐÃ TÍNH, không tính lại);
   gọi Claude (model dùng chung `ADVISE_MODEL_DEFAULT` = claude-opus-4-8,
   adaptive thinking, max 1500 token) với system prompt là bộ kiến thức
   `ASSISTANT_SYSTEM_PROMPT`; giữ mạch bằng history tối đa 12 lượt do client gửi.
2. **Bộ kiến thức** (`src/engine/assistant-knowledge.ts`): ngành CPVC (đùn kg /
   ép phun MHR, compound USD, khuôn) + nghiệp vụ app đúc từ các ADR (giá tái
   tạo, khóa giá, chuỗi VF→TCG→NPP, thang giá 5 bậc, sàn nhận đơn, hoàn vốn,
   phân quyền) + luật trả lời (tiếng Việt kinh doanh, không bịa số, chỉ tới
   đúng màn, ngắn gọn, tham khảo).
3. **Fallback không chết**: chưa set `ANTHROPIC_API_KEY` / Claude lỗi → câu trả
   lời hướng dẫn (nút ⓘ, truy nguyên giá, cách kích hoạt). Cùng triết lý ADR-022.
4. **Audit**: dùng chung `adviceAudit` với `kind: 'assistant'` — ai/khi nào/màn
   nào/model gì; KHÔNG lưu nội dung câu hỏi (giảm bề mặt rò rỉ dữ liệu giá).
5. **UI**: nút 💬 nổi góc phải dưới mọi màn (`AssistantChat.tsx`) — panel chat,
   gợi ý 3 câu mở đầu, gửi kèm `screenId` màn đang đứng để trả lời đúng ngữ cảnh.

## Kiểm chứng

+2 test tích hợp emulator (`ask-assistant.test.ts`): fallback hợp lệ + audit
đúng vết; ranh giới quyền (sales 403, anon 401, schema sai 400). Suite
functions 18/18; engine 373/373; typecheck app + functions xanh.

## Hệ quả / còn treo

- Trợ lý chỉ trả lời THẬT khi production đã `firebase functions:secrets:set
  ANTHROPIC_API_KEY` + deploy functions (cùng bước với Trợ Lý CEO — roadmap).
- Chi phí API theo lượt hỏi — audit đếm được tần suất; nếu cần hạn mức, mở
  ADR sau (rate limit theo uid).
