// ADR-030/031 — màn "Tối Ưu Product-mix". Chống bẫy "dồn sang dòng biên cao": so 2
// dòng theo NHIỀU mẫu số (kg · máy-giờ · đồng vốn), CEO CHỌN ràng buộc thật. ADR-031
// (độ mở): nhập GIÁ THỊ TRƯỜNG thật/dòng (mặc định = giá VF) — commodity ống mỏng
// biên hơn cost+markup, nhập giá thật mới ra kết luận đúng. Đọc engine đã đóng băng.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateProductMixProfile, calculateMixEbit } from '../../engine/product-mix.js';
import type { LineMixMetrics, MarketPriceOverride } from '../../schemas/product-mix.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';

const fmtTr = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e6) + ' tr';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtTySigned = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTons = (kg: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(kg / 1000) + ' tấn';

type Constraint = 'machineHour' | 'fixedCapital' | 'volumeKg';
const CONSTRAINTS: { id: Constraint; label: string; hint: string }[] = [
  { id: 'machineHour', label: 'Máy-giờ', hint: 'khi giới hạn là thời gian máy' },
  { id: 'fixedCapital', label: 'Đồng vốn', hint: 'khi giới hạn là vốn đầu tư' },
  { id: 'volumeKg', label: 'Sản lượng (kg)', hint: 'khi giới hạn là thị trường/đơn hàng' },
];

export default function ProductMixScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [pipePct, setPipePct] = useState(100);
  const [fittingPct, setFittingPct] = useState(100);
  const [constraint, setConstraint] = useState<Constraint>('volumeKg');
  const [marketPipe, setMarketPipe] = useState<number | ''>('');
  const [marketFitting, setMarketFitting] = useState<number | ''>('');

  const override: MarketPriceOverride = useMemo(
    () => ({ ...(marketPipe !== '' ? { pipe: marketPipe } : {}), ...(marketFitting !== '' ? { fitting: marketFitting } : {}) }),
    [marketPipe, marketFitting],
  );

  const profile = useMemo(() => (scenario ? calculateProductMixProfile(scenario, override) : null), [scenario, override]);
  const baseMix = useMemo(() => (scenario ? calculateMixEbit(scenario, 1, 1, override) : null), [scenario, override]);
  const mix = useMemo(() => (scenario ? calculateMixEbit(scenario, pipePct / 100, fittingPct / 100, override) : null), [scenario, pipePct, fittingPct, override]);

  if (!scenario || !profile || !baseMix || !mix) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const pipe = profile.lines.find((l) => l.line === 'pipe')!;
  const fitting = profile.lines.find((l) => l.line === 'fitting')!;
  const winner = profile.priorityByConstraint[constraint];
  const prio = profile.lines.find((l) => l.line === winner)!;
  const other = profile.lines.find((l) => l.line !== winner)!;
  const mixDelta = mix.ebitVnd - baseMix.ebitVnd;

  const metricByConstraint = (l: LineMixMetrics) =>
    constraint === 'machineHour' ? l.contributionPerMachineHourVnd : constraint === 'fixedCapital' ? l.contributionPerCapital : l.marginPerKgVnd;
  const fmtByConstraint = (l: LineMixMetrics) =>
    constraint === 'machineHour' ? `${fmtTr(l.contributionPerMachineHourVnd)} đ/máy-giờ` : constraint === 'fixedCapital' ? `${fmtPct(l.contributionPerCapital)} /năm (ROIC)` : `${fmtVnd(l.marginPerKgVnd)} đ/kg`;

  const priceInput = (val: number | '', set: (v: number | '') => void, vf: number) => (
    <input type="number" value={val} placeholder={String(Math.round(vf))} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value) || 0)}
      style={{ width: 100, padding: '4px 7px', fontSize: 12, textAlign: 'right', border: '1px solid #d8d8d8', borderRadius: 3, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
  );

  const card = (l: LineMixMetrics, isPrio: boolean, priceVal: number | '', setPrice: (v: number | '') => void) => (
    <div style={{ background: '#fff', border: `1px solid ${isPrio ? '#16A34A' : '#e5e0d0'}`, borderRadius: 8, padding: 16, position: 'relative' }}>
      {isPrio && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, color: '#fff', background: '#16A34A', padding: '2px 7px', borderRadius: 3 }}>ƯU TIÊN</div>}
      <div style={{ fontSize: 15, fontWeight: 700 }}>{l.label} <span style={{ fontSize: 10, color: '#999' }}>· {l.materialName}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: '#737373' }}>
        Giá thị trường: {priceInput(priceVal, setPrice, l.vfPriceVndPerKg)} đ/kg
        {priceVal === '' && <span style={{ fontSize: 10, color: '#bbb' }}>(mặc định = VF {fmtVnd(l.vfPriceVndPerKg)})</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Biên</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(l.marginPct)}</div></div>
        <div><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Đóng góp/kg</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(l.marginPerKgVnd)} đ</div></div>
        <div style={{ background: constraint === 'machineHour' ? '#f0fdf4' : 'transparent', borderRadius: 4, padding: constraint === 'machineHour' ? '2px 4px' : 0 }}><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>/ Máy-giờ</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTr(l.contributionPerMachineHourVnd)} đ</div></div>
        <div style={{ background: constraint === 'fixedCapital' ? '#f0fdf4' : 'transparent', borderRadius: 4, padding: constraint === 'fixedCapital' ? '2px 4px' : 0 }}><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>/ Đồng vốn (ROIC)</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(l.contributionPerCapital)}</div></div>
        <div style={{ gridColumn: '1 / 3', borderTop: '1px dashed #e5e0d0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#737373' }}>
          <span>Vốn cố định: <b>{fmtTyAbs(l.fixedCapitalVnd)}</b></span>
          <span>Sản lượng: <b>{fmtTons(l.annualVolumeKg)}</b></span>
          <span>Giờ máy: <b>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(l.annualMachineHours)}h</b></span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Tối Ưu Product-mix</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Dồn công suất vào dòng nào lãi hơn?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Biên % cao CHƯA chắc lãi hơn — tuỳ <b>ràng buộc thật</b> của anh (máy-giờ / vốn / thị trường). Ống là commodity nên hãy nhập <b>giá thị trường thật</b> (mặc định đang lấy giá VF cost+markup, thường cao hơn giá bán ống thực tế).
      </p>

      {/* Chọn ràng buộc */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#737373' }}>Ràng buộc lớn nhất của tôi là:</span>
        <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden' }}>
          {CONSTRAINTS.map((c) => (
            <div key={c.id} onClick={() => setConstraint(c.id)} title={c.hint} style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: constraint === c.id ? '#a8003b' : '#fff', color: constraint === c.id ? '#fff' : '#1a1a1a', borderRight: '1px solid #d8d8d8' }}>{c.label}</div>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#999' }}>{CONSTRAINTS.find((c) => c.id === constraint)!.hint}</span>
      </div>

      {/* Banner ưu tiên theo ràng buộc đã chọn */}
      <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, border: '1px solid #16A34A', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
        ✅ Theo ràng buộc <b>{CONSTRAINTS.find((c) => c.id === constraint)!.label}</b>: ưu tiên <b>{prio.label}</b> — {fmtByConstraint(prio)} so với {other.label} {fmtByConstraint(other)}.
        {constraint === 'volumeKg' && ' (Khi thị trường quyết định — thường đúng với ngành ống/phụ kiện — phụ kiện/van biên cao thắng.)'}
      </div>

      {/* 2 thẻ dòng */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        {card(pipe, winner === 'pipe', marketPipe, setMarketPipe)}
        {card(fitting, winner === 'fitting', marketFitting, setMarketFitting)}
      </div>

      {/* Mô phỏng mix */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 18, marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 14 }}>Mô phỏng — chạy mỗi dòng bao nhiêu % công suất bình thường (theo giá đang nhập)</div>
        {[
          { label: 'Ống CPVC', pct: pipePct, set: setPipePct, accent: '#a8003b' },
          { label: 'Phụ kiện', pct: fittingPct, set: setFittingPct, accent: '#2563eb' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, width: 90 }}>{s.label}</span>
            <input type="range" min={0} max={150} step={5} value={s.pct} onChange={(e) => s.set(Number(e.target.value))} style={{ flex: 1, accentColor: s.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 8, paddingTop: 14, borderTop: '1px solid #e5e0d0' }}>
          <div><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Doanh thu</div><div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(mix.revenueVnd)}</div></div>
          <div><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>EBIT</div><div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(mix.ebitVnd)}</div></div>
          <div><div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Δ so với 100/100</div><div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: mixDelta < 0 ? '#DC2626' : mixDelta > 0 ? '#16A34A' : '#999' }}>{Math.abs(mixDelta) < 1e6 ? '—' : fmtTySigned(mixDelta)}</div></div>
        </div>
      </div>

      <p style={{ fontSize: 10, color: '#999', marginTop: 12 }}>
        Ghi chú: EBIT giữ giá (thị trường nếu nhập, mặc định VF) cố định. Vốn cố định tách theo dòng (đùn+khuôn kéo/cắt vs máy ép+khuôn). ROIC = đóng góp năm ÷ vốn cố định dòng (chưa gồm vốn dùng chung/lưu động — sẽ bổ sung khi cần). Ống & Phụ kiện chạy máy khác nhau, không chuyển đổi.
      </p>
    </div>
  );
}
