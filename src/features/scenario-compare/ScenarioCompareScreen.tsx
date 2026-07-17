// ADR-028 — màn "So Sánh Kịch Bản" (tab `scenario-compare`, nhóm Phân Tích & Quyết
// Định). CEO đặt 2 kịch bản (chỉnh % các driver, có preset) → xem EBIT/doanh thu/
// biên/Δ song song với Cơ sở. CHỈ đọc engine giá-bán-cố-định (calculateScenarioCompare).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateScenarioCompare } from '../../engine/scenario-compare.js';
import type { DriverMultipliers } from '../../engine/scenario-drivers.js';
import { DRIVER_LABELS } from '../../engine/scenario-drivers.js';

const DRIVER_KEYS: (keyof DriverMultipliers)[] = ['compound', 'fx', 'wage', 'electricity', 'overhead', 'volume'];

// Kịch bản trong UI = % thay đổi mỗi driver (0 = giữ nguyên).
type PctChange = Record<keyof DriverMultipliers, number>;
const ZERO: PctChange = { compound: 0, fx: 0, wage: 0, electricity: 0, overhead: 0, volume: 0 };

interface Preset { label: string; pct: Partial<PctChange> }
const PRESETS: Preset[] = [
  { label: 'Suy thoái', pct: { compound: 15, fx: 10, volume: -20 } },
  { label: 'Kỳ vọng', pct: { volume: 10, compound: -5 } },
  { label: 'Sốc tỷ giá', pct: { fx: 15 } },
  { label: 'Reset', pct: {} },
];

const toMultipliers = (p: PctChange): DriverMultipliers => ({
  compound: 1 + p.compound / 100,
  fx: 1 + p.fx / 100,
  wage: 1 + p.wage / 100,
  electricity: 1 + p.electricity / 100,
  overhead: 1 + p.overhead / 100,
  volume: 1 + p.volume / 100,
});

const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtTySigned = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtPct1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(v) + '%';

export default function ScenarioCompareScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [nameA, setNameA] = useState('Suy thoái');
  const [nameB, setNameB] = useState('Kỳ vọng');
  const [pctA, setPctA] = useState<PctChange>({ ...ZERO, compound: 15, fx: 10, volume: -20 });
  const [pctB, setPctB] = useState<PctChange>({ ...ZERO, volume: 10, compound: -5 });

  const result = useMemo(
    () =>
      scenario
        ? calculateScenarioCompare(scenario, [
            { name: nameA, multipliers: toMultipliers(pctA) },
            { name: nameB, multipliers: toMultipliers(pctB) },
          ])
        : null,
    [scenario, nameA, nameB, pctA, pctB],
  );

  if (!scenario || !result) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const cols = [
    { key: 'base', outcome: result.base, pct: null as PctChange | null, setPct: null as ((p: PctChange) => void) | null, name: 'Cơ sở', setName: null as ((s: string) => void) | null, accent: '#737373' },
    { key: 'a', outcome: result.scenarios[0]!, pct: pctA, setPct: setPctA, name: nameA, setName: setNameA, accent: '#a8003b' },
    { key: 'b', outcome: result.scenarios[1]!, pct: pctB, setPct: setPctB, name: nameB, setName: setNameB, accent: '#2563eb' },
  ];
  const grid = '190px 1fr 1fr 1fr';

  // Kịch bản tốt nhất / xấu nhất theo EBIT (gồm cả cơ sở) để tô đậm.
  const ebits = cols.map((c) => c.outcome.ebitVnd);
  const bestEbit = Math.max(...ebits);
  const worstEbit = Math.min(...ebits);

  const applyPreset = (setPct: (p: PctChange) => void, preset: Preset) => setPct({ ...ZERO, ...preset.pct });

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>So Sánh Kịch Bản</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Nếu thế giới thành X thì tôi ở đâu?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Đặt 2 kịch bản (chỉnh % các yếu tố, hoặc chọn preset) → EBIT / doanh thu / biên đặt cạnh Cơ sở. Giữ NGUYÊN giá bán hiện hành (đo rủi ro nén biên, đồng bộ màn Độ Nhạy).
      </p>

      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 6, overflow: 'hidden', marginTop: 16 }}>
        {/* Header: tên kịch bản + preset */}
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '12px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', alignItems: 'start' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', alignSelf: 'center' }}>Yếu tố</div>
          {cols.map((c) => (
            <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {c.setName ? (
                <input value={c.name} onChange={(e) => c.setName!(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: c.accent, border: '1px solid #d8d8d8', borderRadius: 3, padding: '3px 6px', outline: 'none', width: '100%' }} />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, padding: '4px 0' }}>{c.name}</div>
              )}
              {c.setPct && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {PRESETS.map((p) => (
                    <div key={p.label} onClick={() => applyPreset(c.setPct!, p)}
                      style={{ fontSize: 9, padding: '2px 6px', border: '1px solid #d8d8d8', borderRadius: 3, cursor: 'pointer', color: '#555', background: '#fff' }}>
                      {p.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Driver rows (chỉnh %) */}
        {DRIVER_KEYS.map((dk) => (
          <div key={dk} style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '6px 16px', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#404040' }}>{DRIVER_LABELS[dk]}</div>
            {cols.map((c) => (
              <div key={c.key} style={{ textAlign: 'right' }}>
                {c.setPct ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <input type="number" value={c.pct![dk]} onChange={(e) => c.setPct!({ ...c.pct!, [dk]: Number(e.target.value) || 0 })}
                      style={{ width: 54, fontSize: 12, textAlign: 'right', border: '1px solid #d8d8d8', borderRadius: 3, padding: '2px 4px', outline: 'none', fontVariantNumeric: 'tabular-nums', color: c.pct![dk] === 0 ? '#999' : c.pct![dk] > 0 ? '#16A34A' : '#DC2626' }} />
                    <span style={{ fontSize: 10, color: '#999' }}>%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#ccc' }}>—</span>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Result rows */}
        <ResultRow grid={grid} label="Doanh thu (VF)" cols={cols} render={(o) => fmtTyAbs(o.revenueVnd)} />
        <ResultRow grid={grid} label="Biên EBIT" cols={cols} render={(o) => fmtPct1(o.ebitMarginPct).replace('+', '')} />
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '11px 16px', borderTop: '2px solid #e5e0d0', background: '#faf8f2', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>EBIT (lợi nhuận trước thuế)</div>
          {cols.map((c) => {
            const isBest = c.outcome.ebitVnd === bestEbit;
            const isWorst = c.outcome.ebitVnd === worstEbit && bestEbit !== worstEbit;
            return (
              <div key={c.key} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isWorst ? '#DC2626' : isBest ? '#16A34A' : '#1a1a1a' }}>{fmtTyAbs(c.outcome.ebitVnd)}</div>
                {(isBest || isWorst) && <div style={{ fontSize: 9, fontWeight: 700, color: isWorst ? '#DC2626' : '#16A34A' }}>{isWorst ? '▼ THẤP NHẤT' : '▲ CAO NHẤT'}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '8px 16px', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#737373' }}>Δ so với Cơ sở</div>
          {cols.map((c) => (
            <div key={c.key} style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: c.outcome.deltaVsBaseVnd < 0 ? '#DC2626' : c.outcome.deltaVsBaseVnd > 0 ? '#16A34A' : '#999' }}>
              {c.key === 'base' ? '—' : `${fmtTySigned(c.outcome.deltaVsBaseVnd)} (${fmtPct1(c.outcome.deltaVsBasePct)})`}
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 10, color: '#999', marginTop: 12 }}>
        Ghi chú: EBIT giữ GIÁ BÁN cố định ở mức hiện hành (đo rủi ro nén biên). Các yếu tố áp đồng thời trong mỗi kịch bản. Preset chỉ là điểm khởi đầu — chỉnh % tuỳ ý.
      </p>
    </div>
  );
}

function ResultRow({
  grid,
  label,
  cols,
  render,
}: {
  grid: string;
  label: string;
  cols: { key: string; outcome: import('../../schemas/scenario-compare.js').ScenarioOutcome }[];
  render: (o: import('../../schemas/scenario-compare.js').ScenarioOutcome) => string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '7px 16px', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
      <div style={{ fontSize: 11, color: '#404040' }}>{label}</div>
      {cols.map((c) => (
        <div key={c.key} style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{render(c.outcome)}</div>
      ))}
    </div>
  );
}
