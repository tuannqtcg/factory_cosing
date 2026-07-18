// ADR-023 — màn đăng nhập production. Hai đường vào: Google (khuyến nghị, popup)
// và email/mật khẩu (dự phòng, kèm "Quên mật khẩu" gửi email đặt lại). Lối tắt
// đăng nhập demo theo vai đã gỡ bỏ hoàn toàn. Phân quyền vẫn qua custom claim
// `role` — đăng nhập kiểu nào cũng không tự có quyền.
import { useState } from 'react';

export default function LoginScreen({
  onSignIn,
  onSignInGoogle,
  onResetPassword,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignInGoogle: () => Promise<string | null>;
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

  const googleSignIn = async () => {
    setInfo(null);
    setBusy(true);
    setError(await onSignInGoogle());
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
          <button
            onClick={() => void googleSignIn()}
            disabled={busy}
            style={{ width: '100%', padding: '11px', background: '#fff', color: '#1a1a1a', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {busy ? 'Đang xử lý…' : 'Đăng nhập bằng Google'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#e5e0d0' }} />
            <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '.08em' }}>hoặc email</span>
            <div style={{ flex: 1, height: 1, background: '#e5e0d0' }} />
          </div>
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
