// ADR-040 — Trợ Lý Ảo toàn app: nút 💬 nổi góc phải dưới, mở panel chat gọi
// callable `askAssistant` (Claude phía server, kiến thức ngành CPVC + nghiệp vụ
// app + số liệu kịch bản). Màn nào giải thích chưa đủ thì hỏi ở đây.
// ADR-033 roll-out: thuần đổi nguồn màu sang tokens — gu đen-trắng vốn đã đúng.
import { useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase.js';
import type { AssistantAnswer } from '../../schemas/assistant.js';
import { color, font, radius, shadow } from '../../design/tokens.js';

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Giá bán hiện tại được đề xuất dựa trên gì?',
  'Ngưỡng khóa giá bao nhiêu là hợp lý cho nhà máy tôi?',
  'Vì sao nhận đơn tính theo giá nguyên liệu mới?',
];

export default function AssistantChat({ scenarioId, screenId }: { scenarioId: string; screenId: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setTimeout(() => listRef.current?.scrollTo({ top: 1e9 }), 50);
    try {
      const call = httpsCallable(functions, 'askAssistant');
      const res = await call({
        scenarioId,
        screenId,
        question: q,
        history: msgs.slice(-8),
      });
      const data = res.data as AssistantAnswer;
      setMsgs((m) => [...m, { role: 'assistant', text: data.answer }]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: 'Không kết nối được trợ lý — kiểm tra mạng rồi thử lại. Trong lúc chờ, nút ⓘ "Giải thích màn này" cũng trả lời được nhiều câu hỏi.' },
      ]);
    }
    setBusy(false);
    setTimeout(() => listRef.current?.scrollTo({ top: 1e9 }), 50);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Trợ lý ảo — hỏi bất cứ điều gì về giá, chi phí, ngành CPVC"
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 45, width: 52, height: 52, borderRadius: '50%', background: color.brand, color: color.inkInverse, border: 'none', fontSize: 22, cursor: 'pointer', boxShadow: shadow.lg }}
      >
        💬
      </button>
      {open && (
        <div style={{ position: 'fixed', bottom: 84, right: 20, zIndex: 46, width: 400, maxWidth: 'calc(100vw - 40px)', height: 520, maxHeight: 'calc(100vh - 120px)', background: color.surface, border: `1px solid ${color.borderStrong}`, borderRadius: radius.lg, boxShadow: shadow.lg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: color.sidebar, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: color.inkInverse, fontSize: font.size.sm, fontWeight: font.weight.bold }}>Trợ lý ảo</div>
              <div style={{ color: color.sidebarText, fontSize: font.size.xs }}>Hiểu ngành CPVC và mọi con số trong app</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: color.sidebarText, fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {msgs.length === 0 && (
              <div>
                <div style={{ fontSize: font.size.sm, color: color.inkMuted, lineHeight: 1.5, marginBottom: 12 }}>
                  Màn hình nào giải thích chưa đủ thì hỏi tôi — về giá, chi phí, khuôn, kho, hay ngành ống nhựa CPVC nói chung. Tôi thấy số liệu kịch bản anh đang mở.
                </div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: 6, background: color.surfaceMuted, border: `1px solid ${color.border}`, borderRadius: radius.md, fontSize: font.size.sm, color: color.inkMuted, cursor: 'pointer' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: radius.md, fontSize: font.size.sm, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: m.role === 'user' ? color.brand : color.surfaceMuted, color: m.role === 'user' ? color.inkInverse : color.ink }}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div style={{ fontSize: font.size.xs, color: color.inkFaint, padding: '4px 2px' }}>Trợ lý đang suy nghĩ…</div>}
          </div>
          <div style={{ borderTop: `1px solid ${color.border}`, padding: 10, display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void ask(input)}
              placeholder="Hỏi về giá, chi phí, ngành CPVC…"
              style={{ flex: 1, padding: '9px 12px', border: `1px solid ${color.borderStrong}`, borderRadius: radius.md, fontSize: font.size.sm, outline: 'none', color: color.ink }}
            />
            <button
              onClick={() => void ask(input)}
              disabled={busy || !input.trim()}
              style={{ padding: '9px 16px', background: color.brand, color: color.inkInverse, border: 'none', borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, cursor: busy ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              Gửi
            </button>
          </div>
          <div style={{ padding: '0 12px 8px', fontSize: font.size.eyebrow, color: color.inkFaint }}>
            Nhận định tham khảo — quyết định cuối cùng của CEO.
          </div>
        </div>
      )}
    </>
  );
}
