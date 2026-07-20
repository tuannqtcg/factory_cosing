// ADR-040 — hợp đồng dữ liệu Trợ Lý Ảo toàn app (callable `askAssistant`).
// CEO hỏi tự do ở bất kỳ màn nào; server gọi Claude với kiến thức ngành CPVC +
// nghiệp vụ app (assistant-knowledge.ts) + số liệu ĐÃ TÍNH của kịch bản.
// Chưa có API key / lỗi → câu trả lời fallback hướng dẫn (nút không bao giờ chết).
import { z } from 'zod';

export const AssistantAskRequestSchema = z.object({
  scenarioId: z.string(),
  /** Màn CEO đang đứng (id tab, vd 'pricing', 'order-acceptance') — để trả lời đúng ngữ cảnh. */
  screenId: z.string().max(64),
  question: z.string().min(1).max(2000),
  /** Vài lượt hội thoại gần nhất để giữ mạch (client tự cắt, tối đa 12 lượt). */
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(12)
    .default([]),
});
export type AssistantAskRequest = z.infer<typeof AssistantAskRequestSchema>;

export const AssistantAnswerSchema = z.object({
  generatedByModel: z.string(),
  answer: z.string(),
  disclaimer: z.string(),
});
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;
