// ADR-023 — màn đăng nhập production (email/mật khẩu). Lối tắt đăng nhập demo
// theo vai đã gỡ bỏ hoàn toàn — chỉ còn một đường vào duy nhất là email/mật khẩu,
// kèm "Quên mật khẩu" gửi email đặt lại qua Firebase Auth.
import { useState } from 'react';

export default function LoginScreen({
  onSignIn,
  onResetPassword,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onResetPassword: (email: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Nhập đủ email và mật khẩu.');
      return;
    }
    setInfo(null);
    setBusy(true);
    setError(await onSignIn(email, password));
    setBusy(false);
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Nhập email trước, rồi bấm "Quên mật khẩu" để nhận link đặt lại.');
      return;
    }
    setInfo(null);
    setBusy(true);
    const err = await onResetPassword(email);
    setError(err);
    if (!err) setInfo(`Đã gửi email đặt lại mật khẩu tới ${email.trim()} — kiểm tra hộp thư (kể cả mục Spam).`);
    setBusy(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ebe6d4', fontFamily: 'Roboto,Helvetica Neue,sans-serif' }}>
      <div style={{ width: 360, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        <div style={{ background: '#1a1a1a', padding: '22px 24px' }}>
          <div style={{ color: '#a8003b', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>BlazeMaster CPVC</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Costing Engine</div>
          <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>Đăng nhập để vào bảng điều khiển</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Email</div>
            <input style={inputStyle} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="ban@congty.com" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 5 }}>Mật khẩu</div>
            <input style={inputStyle} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="••••••••" />
          </div>
          {error && <div style={{ color: '#DC2626', fontSize: 11, marginBottom: 12 }}>{error}</div>}
          {info && <div style={{ color: '#15803D', fontSize: 11, marginBottom: 12 }}>{info}</div>}
          <button onClick={() => void submit()} disabled={busy} style={{ width: '100%', padding: '11px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Đang xử lý…' : 'Đăng nhập'}
          </button>
          <button
            onClick={() => void resetPassword()}
            disabled={busy}
            style={{ width: '100%', marginTop: 10, padding: 0, background: 'none', border: 'none', color: '#737373', fontSize: 11, textDecoration: 'underline', cursor: busy ? 'default' : 'pointer' }}
          >
            Quên mật khẩu? Gửi email đặt lại
          </button>
        </div>
      </div>
    </div>
  );
}
