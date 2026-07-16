// ADR-023 — màn đăng nhập production (email/mật khẩu). Lối tắt đăng nhập demo
// theo vai CHỈ hiện ở emulator (isEmulatorMode) — tiện dev, không lộ production.
import { useState } from 'react';
import type { AppRole } from '../../lib/firebase.js';

const DEMO_ROLES: Array<{ role: AppRole; label: string }> = [
  { role: 'admin', label: 'Admin' },
  { role: 'pricing', label: 'Pricing' },
  { role: 'sales', label: 'Sales' },
  { role: 'production', label: 'Production' },
];

export default function LoginScreen({
  onSignIn,
  onDemoLogin,
  isEmulator,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onDemoLogin: (role: AppRole) => Promise<string | null>;
  isEmulator: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Nhập đủ email và mật khẩu.');
      return;
    }
    setBusy(true);
    setError(await onSignIn(email, password));
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
          <button onClick={() => void submit()} disabled={busy} style={{ width: '100%', padding: '11px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          {isEmulator && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #e0dcc8' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#999', fontWeight: 700, marginBottom: 8 }}>Lối tắt demo (chỉ emulator)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DEMO_ROLES.map((d) => (
                  <button
                    key={d.role}
                    onClick={async () => { setBusy(true); setError(await onDemoLogin(d.role)); setBusy(false); }}
                    disabled={busy}
                    style={{ flex: '1 0 45%', padding: '7px 10px', background: '#fff', color: '#555', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
