// ADR-040 — Trợ Lý Ảo toàn app: nút 💬 nổi góc phải dưới, mở panel chat gọi
// callable `askAssistant` (Claude phía server, kiến thức ngành CPVC + nghiệp vụ
// app + số liệu kịch bản). Màn nào giải thích chưa đủ thì hỏi ở đây.
import { useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase.js';
import type { AssistantAnswer } from '../../schemas/assistant.js';

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
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 45, width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
      >
        💬
      </button>
      {open && (
        <div style={{ position: 'fixed', bottom: 84, right: 20, zIndex: 46, width: 400, maxWidth: 'calc(100vw - 40px)', height: 520, maxHeight: 'calc(100vh - 120px)', background: '#fff', border: '1px solid #d8d8d8', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#0a0a0a', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Trợ lý ảo</div>
              <div style={{ color: '#a3a3a3', fontSize: 10 }}>Hiểu ngành CPVC và mọi con số trong app</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#a3a3a3', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {msgs.length === 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#737373', lineHeight: 1.5, marginBottom: 12 }}>
                  Màn hình nào giải thích chưa đủ thì hỏi tôi — về giá, chi phí, khuôn, kho, hay ngành ống nhựa CPVC nói chung. Tôi thấy số liệu kịch bản anh đang mở.
                </div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: 6, background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 12, color: '#404040', cursor: 'pointer' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: m.role === 'user' ? '#0a0a0a' : '#f2f2f2', color: m.role === 'user' ? '#fff' : '#1a1a1a' }}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div style={{ fontSize: 11, color: '#999', padding: '4px 2px' }}>Trợ lý đang suy nghĩ…</div>}
          </div>
          <div style={{ borderTop: '1px solid #ececec', padding: 10, display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void ask(input)}
              placeholder="Hỏi về giá, chi phí, ngành CPVC…"
              style={{ flex: 1, padding: '9px 12px', border: '1px solid #d8d8d8', borderRadius: 8, fontSize: 12.5, outline: 'none' }}
            />
            <button
              onClick={() => void ask(input)}
              disabled={busy || !input.trim()}
              style={{ padding: '9px 16px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              Gửi
            </button>
          </div>
          <div style={{ padding: '0 12px 8px', fontSize: 9, color: '#b3b3b3' }}>
            Nhận định tham khảo — quyết định cuối cùng của CEO.
          </div>
        </div>
      )}
    </>
  );
}
