// ADR-030 — màn "Tối Ưu Product-mix" (tab `product-mix`, nhóm Phân Tích & Quyết
// Định). Chống bẫy "dồn sang dòng biên cao": so 2 dòng theo đóng góp/MÁY-GIỜ (nguồn
// lực ràng buộc thật), không chỉ theo %. Kèm mô phỏng mix sản lượng → EBIT live.
// Đọc engine đã đóng băng (calculateProductMixProfile + calculateMixEbit).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateProductMixProfile, calculateMixEbit } from '../../engine/product-mix.js';
import type { LineMixMetrics } from '../../schemas/product-mix.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';

const fmtTr = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e6) + ' tr';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtTySigned = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTons = (kg: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(kg / 1000) + ' tấn';

export default function ProductMixScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [pipePct, setPipePct] = useState(100);
  const [fittingPct, setFittingPct] = useState(100);

  const profile = useMemo(() => (scenario ? calculateProductMixProfile(scenario) : null), [scenario]);
  const baseMix = useMemo(() => (scenario ? calculateMixEbit(scenario, 1, 1) : null), [scenario]);
  const mix = useMemo(() => (scenario ? calculateMixEbit(scenario, pipePct / 100, fittingPct / 100) : null), [scenario, pipePct, fittingPct]);

  if (!scenario || !profile || !baseMix || !mix) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const pipe = profile.lines.find((l) => l.line === 'pipe')!;
  const fitting = profile.lines.find((l) => l.line === 'fitting')!;
  const prio = profile.lines.find((l) => l.line === profile.priorityLine)!;
  const other = profile.lines.find((l) => l.line !== profile.priorityLine)!;
  const marginWinner = pipe.marginPct >= fitting.marginPct ? pipe : fitting;
  const mixDelta = mix.ebitVnd - baseMix.ebitVnd;

  const card = (l: LineMixMetrics, isPrio: boolean) => (
    <div style={{ background: '#fff', border: `1px solid ${isPrio ? '#16A34A' : '#e5e0d0'}`, borderRadius: 8, padding: 16, position: 'relative' }}>
      {isPrio && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, color: '#fff', background: '#16A34A', padding: '2px 7px', borderRadius: 3 }}>ƯU TIÊN MỞ RỘNG</div>}
      <div style={{ fontSize: 15, fontWeight: 700 }}>{l.label} <span style={{ fontSize: 10, color: '#999' }}>· {l.materialName}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Biên VF</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(l.marginPct)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Đóng góp / kg</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(l.marginPerKgVnd)} đ</div>
        </div>
        <div style={{ gridColumn: '1 / 3', borderTop: '1px dashed #e5e0d0', paddingTop: 10 }}>
          <div style={{ fontSize: 9, color: isPrio ? '#16A34A' : '#a8003b', textTransform: 'uppercase', fontWeight: 700 }}>◆ Đóng góp / máy-giờ (thước đo quyết định)</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: isPrio ? '#16A34A' : '#1a1a1a' }}>{fmtTr(l.contributionPerMachineHourVnd)} đ</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Sản lượng/năm</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtTons(l.annualVolumeKg)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Giờ máy/năm</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(l.annualMachineHours)} h</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Tối Ưu Product-mix</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Dồn công suất vào dòng nào lãi hơn?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Biên % cao CHƯA chắc lãi hơn: phải xét đóng góp trên <b>một máy-giờ</b> (nguồn lực ràng buộc thật). Ống & Phụ kiện chạy máy KHÁC nhau — không chuyển đổi được, nên đây là bài toán "đầu tư/thêm ca vào dòng nào".
      </p>

      {/* Banner chống bẫy */}
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, border: '1px solid #16A34A', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
        ✅ Ưu tiên mở rộng: <b>{prio.label}</b> — dù biên {marginWinner.label} cao hơn ({fmtPct(marginWinner.marginPct)} vs {fmtPct((marginWinner.line === pipe.line ? fitting : pipe).marginPct)}),
        mỗi máy-giờ {prio.label} đóng góp <b>{fmtTr(prio.contributionPerMachineHourVnd)} đ</b> so với {other.label} chỉ {fmtTr(other.contributionPerMachineHourVnd)} đ.
        Thêm ca/đầu tư vào {prio.label} sinh lời nhanh hơn.
      </div>

      {/* 2 thẻ dòng */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        {card(pipe, profile.priorityLine === 'pipe')}
        {card(fitting, profile.priorityLine === 'fitting')}
      </div>

      {/* Mô phỏng mix */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 18, marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 14 }}>Mô phỏng — chạy mỗi dòng bao nhiêu % công suất bình thường</div>
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
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Doanh thu</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(mix.revenueVnd)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>EBIT</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(mix.ebitVnd)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Δ so với hiện tại (100/100)</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: mixDelta < 0 ? '#DC2626' : mixDelta > 0 ? '#16A34A' : '#999' }}>{Math.abs(mixDelta) < 1e6 ? '—' : fmtTySigned(mixDelta)}</div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 10, color: '#999', marginTop: 12 }}>
        Ghi chú: EBIT giữ GIÁ BÁN cố định. Định phí mỗi dòng (khấu hao máy/khuôn, lương) KHÔNG đổi theo sản lượng → chạy dưới công suất vẫn "gánh" định phí (đòn bẩy vận hành). {'>'}100% = tăng ca/đầu tư thêm (minh hoạ).
      </p>
    </div>
  );
}
