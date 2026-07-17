// ADR-023 — màn đăng nhập production (email/mật khẩu). Lối tắt đăng nhập demo
// theo vai CHỈ hiện ở emulator (isEmulatorMode) — tiện dev, không lộ production.
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-[360px] overflow-hidden p-0 shadow-lg">
        <div className="bg-neutral-900 px-6 py-[22px]">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-neutral-400">BlazeMaster CPVC</div>
          <div className="text-lg font-bold text-white">Costing Engine</div>
          <div className="mt-0.5 text-[10px] text-neutral-500">Đăng nhập để vào bảng điều khiển</div>
        </div>
        <div className="p-6">
          <div className="mb-3">
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">Email</div>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="ban@congty.com" />
          </div>
          <div className="mb-4">
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">Mật khẩu</div>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="••••••••" />
          </div>
          {error && <div className="mb-3 text-[11px] text-destructive">{error}</div>}
          <Button onClick={() => void submit()} disabled={busy} className="h-auto w-full py-2.5 text-sm">
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>

          {isEmulator && (
            <div className="mt-5 border-t border-dashed border-border pt-4">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[.1em] text-faint">Lối tắt demo (chỉ emulator)</div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ROLES.map((d) => (
                  <Button
                    key={d.role}
                    variant="outline"
                    size="sm"
                    onClick={async () => { setBusy(true); setError(await onDemoLogin(d.role)); setBusy(false); }}
                    disabled={busy}
                    className="flex-[1_0_45%]"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
