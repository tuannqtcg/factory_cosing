// ADR-030/031/032 — màn "Tối Ưu Product-mix". Progressive disclosure (ADR-032): màn
// CHÍNH giữ ĐƠN GIẢN — nhìn nhanh dòng nào hiệu quả hơn (biên/kg, /máy-giờ) + mô
// phỏng mix. VỐN/ROIC + GIÁ THỊ TRƯỜNG nhập tay dời sang chế độ "Phân tích sâu" —
// CEO chỉ mở khi thực sự muốn đào sâu (lựa chọn của CEO, không nhồi vào flow chính).
// Đọc engine đã đóng băng (calculateProductMixProfile + calculateMixEbit).
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Button/Badge/Input/Segmented),
// KHÔNG inline-style hardcode; màu CHỈ dành cho DỮ LIỆU (winner, Δ, trạng thái).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateProductMixProfile, calculateMixEbit } from '../../engine/product-mix.js';
import type { LineMixMetrics, MarketPriceOverride } from '../../schemas/product-mix.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const fmtTr = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e6) + ' tr';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtTySigned = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTons = (kg: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(kg / 1000) + ' tấn';
const fmtH = (h: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(h) + 'h';

type Constraint = 'machineHour' | 'fixedCapital' | 'volumeKg';
const CONSTRAINTS: { id: Constraint; label: string; hint: string }[] = [
  { id: 'machineHour', label: 'Máy-giờ', hint: 'khi giới hạn là thời gian máy' },
  { id: 'fixedCapital', label: 'Đồng vốn', hint: 'khi giới hạn là vốn đầu tư' },
  { id: 'volumeKg', label: 'Sản lượng (kg)', hint: 'khi giới hạn là thị trường/đơn hàng' },
];

export default function ProductMixScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [pipePct, setPipePct] = useState(100);
  const [fittingPct, setFittingPct] = useState(100);
  const [constraint, setConstraint] = useState<Constraint>('volumeKg');
  const [marketPipe, setMarketPipe] = useState<number | ''>('');
  const [marketFitting, setMarketFitting] = useState<number | ''>('');

  // Override chỉ áp ở chế độ sâu; nhìn nhanh luôn dùng giá VF.
  const override: MarketPriceOverride = useMemo(
    () => (mode === 'deep' ? { ...(marketPipe !== '' ? { pipe: marketPipe } : {}), ...(marketFitting !== '' ? { fitting: marketFitting } : {}) } : {}),
    [mode, marketPipe, marketFitting],
  );

  const profile = useMemo(() => (scenario ? calculateProductMixProfile(scenario, override) : null), [scenario, override]);
  const baseMix = useMemo(() => (scenario ? calculateMixEbit(scenario, 1, 1, override) : null), [scenario, override]);
  const mix = useMemo(() => (scenario ? calculateMixEbit(scenario, pipePct / 100, fittingPct / 100, override) : null), [scenario, pipePct, fittingPct, override]);

  if (!scenario || !profile || !baseMix || !mix) {
    return <div className="mx-auto max-w-[1000px] px-9 py-8 text-xs text-muted-foreground">Đang tải kịch bản…</div>;
  }

  const pipe = profile.lines.find((l) => l.line === 'pipe')!;
  const fitting = profile.lines.find((l) => l.line === 'fitting')!;
  const kgWinner = fitting.marginPerKgVnd > pipe.marginPerKgVnd ? fitting : pipe;
  const hourWinner = fitting.contributionPerMachineHourVnd > pipe.contributionPerMachineHourVnd ? fitting : pipe;
  const mixDelta = mix.ebitVnd - baseMix.ebitVnd;

  const simulator = (
    <Card className="mt-4 p-[18px]">
      <div className="mb-3.5 text-eyebrow font-bold uppercase text-faint">Mô phỏng — chạy mỗi dòng bao nhiêu % công suất bình thường</div>
      {[
        { label: 'Ống CPVC', pct: pipePct, set: setPipePct },
        { label: 'Phụ kiện', pct: fittingPct, set: setFittingPct },
      ].map((s) => (
        <div key={s.label} className="mb-3 flex items-center gap-3">
          <span className="w-[90px] text-xs font-semibold text-foreground">{s.label}</span>
          <Slider value={s.pct} onValueChange={(v) => s.set(v)} min={0} max={150} step={5} className="flex-1 accent-foreground" />
          <span className="w-[52px] text-right text-[13px] font-bold tabular-nums text-foreground">{s.pct}%</span>
        </div>
      ))}
      <div className="mt-2 grid grid-cols-3 gap-3 border-t border-border pt-3.5">
        <div><div className="text-eyebrow uppercase text-faint">Doanh thu</div><div className="text-base font-bold tabular-nums text-foreground">{fmtTyAbs(mix.revenueVnd)}</div></div>
        <div><div className="text-eyebrow uppercase text-faint">EBIT</div><div className="text-base font-bold tabular-nums text-foreground">{fmtTyAbs(mix.ebitVnd)}</div></div>
        <div><div className="text-eyebrow uppercase text-faint">Δ so với 100/100</div><div className={cn('text-base font-bold tabular-nums', mixDelta < 0 ? 'text-destructive' : mixDelta > 0 ? 'text-success' : 'text-faint')}>{Math.abs(mixDelta) < 1e6 ? '—' : fmtTySigned(mixDelta)}</div></div>
      </div>
    </Card>
  );

  // ── Chế độ NHÌN NHANH (mặc định, đơn giản) ─────────────────────────────────
  if (mode === 'quick') {
    const quickCard = (l: LineMixMetrics) => (
      <Card className="p-4">
        <div className="text-[15px] font-bold text-foreground">{l.label} <span className="text-[10px] text-faint">· {l.materialName}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><div className="text-eyebrow uppercase text-faint">Biên VF</div><div className="text-[17px] font-bold tabular-nums text-foreground">{fmtPct(l.marginPct)}</div></div>
          <div><div className="text-eyebrow uppercase text-faint">Đóng góp / kg</div><div className={cn('text-[17px] font-bold tabular-nums', l === kgWinner ? 'text-success' : 'text-foreground')}>{fmtVnd(l.marginPerKgVnd)} đ</div></div>
          <div className="col-span-2 border-t border-dashed border-border pt-2.5">
            <div className="text-eyebrow uppercase text-faint">Đóng góp / máy-giờ</div>
            <div className={cn('text-xl font-extrabold tabular-nums', l === hourWinner ? 'text-success' : 'text-foreground')}>{fmtTr(l.contributionPerMachineHourVnd)} đ</div>
          </div>
          <div className="col-span-2 flex justify-between text-[10px] text-muted-foreground">
            <span>Sản lượng: <b>{fmtTons(l.annualVolumeKg)}</b></span>
            <span>Giờ máy: <b>{fmtH(l.annualMachineHours)}</b></span>
          </div>
        </div>
      </Card>
    );
    return (
      <div className="mx-auto max-w-[1000px] px-9 py-8">
        <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Tối Ưu Product-mix</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Dồn công suất vào dòng nào lãi hơn?</h1>
        <p className="mt-1 text-xs text-muted-foreground">Nhìn nhanh hiệu quả 2 dòng theo mỗi kg và mỗi máy-giờ. Biên % cao chưa chắc lãi hơn theo giờ máy.</p>

        <div className="mt-4 rounded-lg border border-warning/25 bg-warning-tint px-4 py-3 text-xs font-semibold text-warning">
          ⚖ <b>{kgWinner.label}</b> lãi hơn trên mỗi <b>kg</b> ({fmtVnd(kgWinner.marginPerKgVnd)} vs {fmtVnd((kgWinner.line === pipe.line ? fitting : pipe).marginPerKgVnd)} đ),
          nhưng <b>{hourWinner.label}</b> lãi hơn trên mỗi <b>máy-giờ</b> ({fmtTr(hourWinner.contributionPerMachineHourVnd)} vs {fmtTr((hourWinner.line === pipe.line ? fitting : pipe).contributionPerMachineHourVnd)} đ).
          Kết luận tuỳ <b>ràng buộc thật</b> của anh.
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {quickCard(pipe)}
          {quickCard(fitting)}
        </div>

        {simulator}

        <Button onClick={() => setMode('deep')} className="mt-4">
          Phân tích sâu: vốn đầu tư & giá thị trường →
        </Button>
        <div className="mt-1.5 text-[10px] text-faint">Để trả lời "đầu tư vào dòng nào" theo vốn/ROIC và giá thị trường thật — mở khi cần, không bắt buộc.</div>
      </div>
    );
  }

  // ── Chế độ PHÂN TÍCH SÂU (tuỳ chọn: vốn/ROIC + giá thị trường + ràng buộc) ──
  const winner = profile.priorityByConstraint[constraint];
  const prio = profile.lines.find((l) => l.line === winner)!;
  const other = profile.lines.find((l) => l.line !== winner)!;
  const fmtByConstraint = (l: LineMixMetrics) =>
    constraint === 'machineHour' ? `${fmtTr(l.contributionPerMachineHourVnd)} đ/máy-giờ` : constraint === 'fixedCapital' ? `${fmtPct(l.contributionPerCapital)}/năm (ROIC)` : `${fmtVnd(l.marginPerKgVnd)} đ/kg`;
  const priceInput = (val: number | '', set: (v: number | '') => void, vf: number) => (
    <Input type="number" value={val} placeholder={String(Math.round(vf))} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value) || 0)}
      className="h-7 w-[100px] px-1.5 text-right text-xs tabular-nums" />
  );
  const deepCard = (l: LineMixMetrics, isPrio: boolean, priceVal: number | '', setPrice: (v: number | '') => void) => (
    <Card className={cn('relative p-4', isPrio && 'border-success')}>
      {isPrio && <Badge variant="success" className="absolute right-3 top-3">ƯU TIÊN</Badge>}
      <div className="text-[15px] font-bold text-foreground">{l.label} <span className="text-[10px] text-faint">· {l.materialName}</span></div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        Giá thị trường: {priceInput(priceVal, setPrice, l.vfPriceVndPerKg)} đ/kg
        {priceVal === '' && <span className="text-[10px] text-faint">(mặc định VF {fmtVnd(l.vfPriceVndPerKg)})</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div><div className="text-eyebrow uppercase text-faint">Biên</div><div className="text-[15px] font-bold tabular-nums text-foreground">{fmtPct(l.marginPct)}</div></div>
        <div><div className="text-eyebrow uppercase text-faint">Đóng góp/kg</div><div className="text-[15px] font-bold tabular-nums text-foreground">{fmtVnd(l.marginPerKgVnd)} đ</div></div>
        <div className={cn('rounded', constraint === 'machineHour' && 'bg-success-tint px-1 py-0.5')}><div className="text-eyebrow uppercase text-faint">/ Máy-giờ</div><div className="text-[15px] font-bold tabular-nums text-foreground">{fmtTr(l.contributionPerMachineHourVnd)} đ</div></div>
        <div className={cn('rounded', constraint === 'fixedCapital' && 'bg-success-tint px-1 py-0.5')}><div className="text-eyebrow uppercase text-faint">/ Đồng vốn (ROIC)</div><div className="text-[15px] font-bold tabular-nums text-foreground">{fmtPct(l.contributionPerCapital)}</div></div>
        <div className="col-span-2 flex justify-between border-t border-dashed border-border pt-2 text-[10px] text-muted-foreground">
          <span>Vốn cố định: <b>{fmtTyAbs(l.fixedCapitalVnd)}</b></span>
          <span>Sản lượng: <b>{fmtTons(l.annualVolumeKg)}</b></span>
          <span>Giờ máy: <b>{fmtH(l.annualMachineHours)}</b></span>
        </div>
      </div>
    </Card>
  );
  return (
    <div className="mx-auto max-w-[1000px] px-9 py-8">
      <Button variant="outline" size="sm" onClick={() => setMode('quick')} className="mb-3">← Về nhìn nhanh</Button>
      <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Product-mix · Phân Tích Sâu</div>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">Đầu tư vào dòng nào — theo vốn & giá thị trường thật</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Chọn <b>ràng buộc thật</b> của anh và nhập <b>giá thị trường thật</b> (mặc định = giá VF cost+markup, thường cao hơn giá ống commodity thực tế). Ống là commodity nên nhập giá thật mới ra kết luận đúng.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] text-muted-foreground">Ràng buộc lớn nhất:</span>
        <Segmented value={constraint} onChange={setConstraint} options={CONSTRAINTS.map((c) => ({ id: c.id, label: c.label, title: c.hint }))} />
        <span className="text-[10px] text-faint">{CONSTRAINTS.find((c) => c.id === constraint)!.hint}</span>
      </div>

      <div className="mt-3 rounded-lg border border-success/25 bg-success-tint px-4 py-3 text-xs font-semibold text-success">
        ✅ Theo ràng buộc <b>{CONSTRAINTS.find((c) => c.id === constraint)!.label}</b>: ưu tiên <b>{prio.label}</b> — {fmtByConstraint(prio)} so với {other.label} {fmtByConstraint(other)}.
        {constraint === 'volumeKg' && ' (Khi thị trường quyết định — thường đúng với ngành ống/phụ kiện — phụ kiện/van biên cao thắng.)'}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {deepCard(pipe, winner === 'pipe', marketPipe, setMarketPipe)}
        {deepCard(fitting, winner === 'fitting', marketFitting, setMarketFitting)}
      </div>

      {simulator}

      <p className="mt-3 text-[10px] text-faint">
        ROIC = đóng góp năm ÷ vốn cố định dòng (đùn+khuôn kéo/cắt vs máy ép+khuôn; chưa gồm vốn dùng chung/lưu động — bổ sung khi cần). EBIT mô phỏng giữ giá (thị trường nếu nhập, mặc định VF) cố định.
      </p>
    </div>
  );
}
