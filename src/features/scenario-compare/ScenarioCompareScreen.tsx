// ADR-028 — màn "So Sánh Kịch Bản" (tab `scenario-compare`, nhóm Phân Tích & Quyết
// Định). CEO đặt 2 kịch bản (chỉnh % các driver, có preset) → xem EBIT/doanh thu/
// biên/Δ song song với Cơ sở. CHỈ đọc engine giá-bán-cố-định (calculateScenarioCompare).
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản); cột A/B
// phân biệt bằng nhãn/viền chứ không dùng màu hue riêng (accent tương tác = đen).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import SensitivityScreen from '../sensitivity/SensitivityScreen.js';
import { calculateScenarioCompare } from '../../engine/scenario-compare.js';
import type { DriverMultipliers } from '../../engine/scenario-drivers.js';
import { DRIVER_LABELS } from '../../engine/scenario-drivers.js';
import { Screen, PageHeader, Card, tk, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

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

export default function ScenarioCompareScreen({ scenario, onNavigate, initialTab }: {
  scenario: ScenarioInput | null;
  onNavigate?: (tab: string) => void;
  // ADR-050 — gộp Độ Nhạy (tornado) thành tab trong đây (trùng nền scenario-drivers).
  initialTab?: 'compare' | 'tornado';
}) {
  const [tab, setTab] = useState<'compare' | 'tornado'>(initialTab ?? 'compare');
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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản…</div></Screen>;
  }

  const cols = [
    { key: 'base', outcome: result.base, pct: null as PctChange | null, setPct: null as ((p: PctChange) => void) | null, name: 'Cơ sở', setName: null as ((s: string) => void) | null },
    { key: 'a', outcome: result.scenarios[0]!, pct: pctA, setPct: setPctA, name: nameA, setName: setNameA },
    { key: 'b', outcome: result.scenarios[1]!, pct: pctB, setPct: setPctB, name: nameB, setName: setNameB },
  ];
  const grid = '190px 1fr 1fr 1fr';

  // Kịch bản tốt nhất / xấu nhất theo EBIT (gồm cả cơ sở) để tô đậm.
  const ebits = cols.map((c) => c.outcome.ebitVnd);
  const bestEbit = Math.max(...ebits);
  const worstEbit = Math.min(...ebits);

  const applyPreset = (setPct: (p: PctChange) => void, preset: Preset) => setPct({ ...ZERO, ...preset.pct });

  return (
    <div>
      {/* ADR-050 — 2 tab: So Sánh Kịch Bản · Độ Nhạy (tornado) — chung nền scenario-drivers */}
      <div style={{ display: 'flex', gap: 4, padding: '14px 36px 0', borderBottom: `1px solid ${tk.border}` }}>
        {([['compare', 'So Sánh Kịch Bản'], ['tornado', 'Độ Nhạy (Tornado)']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '8px 14px', border: 'none', borderBottom: `2px solid ${tab === v ? tk.brand : 'transparent'}`, background: 'none', cursor: 'pointer', fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tab === v ? tk.ink : tk.inkMuted, marginBottom: -1 }}>{label}</button>
        ))}
      </div>
      {tab === 'tornado' ? (
        <SensitivityScreen scenario={scenario} onNavigate={(t) => (t === 'scenario-compare' ? setTab('compare') : onNavigate?.(t))} />
      ) : (
      <Screen maxWidth={1040}>
        <PageHeader
          eyebrow="So Sánh Kịch Bản"
          title="Nếu thế giới thành X thì tôi ở đâu?"
          subtitle="Đặt 2 kịch bản (chỉnh % các yếu tố, hoặc chọn preset) → EBIT / doanh thu / biên đặt cạnh Cơ sở. Giữ NGUYÊN giá bán hiện hành (đo rủi ro nén biên, đồng bộ màn Độ Nhạy)."
        />

      <Card pad={0} style={{ overflow: 'hidden' }}>
        {/* Header: tên kịch bản + preset */}
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '12px 16px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}`, alignItems: 'start' }}>
          <div style={{ ...eyebrowStyle, alignSelf: 'center' }}>Yếu tố</div>
          {cols.map((c) => (
            <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {c.setName ? (
                <input value={c.name} onChange={(e) => c.setName!(e.target.value)}
                  style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: '3px 6px', outline: 'none', width: '100%' }} />
              ) : (
                <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink, padding: '4px 0' }}>{c.name}</div>
              )}
              {c.setPct && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {PRESETS.map((p) => (
                    <div key={p.label} onClick={() => applyPreset(c.setPct!, p)}
                      style={{ fontSize: ft.size.eyebrow, padding: '2px 6px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, cursor: 'pointer', color: tk.inkMuted, background: tk.surface }}>
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
          <div key={dk} style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '6px 16px', borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'center' }}>
            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{DRIVER_LABELS[dk]}</div>
            {cols.map((c) => (
              <div key={c.key} style={{ textAlign: 'right' }}>
                {c.setPct ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <input type="number" value={c.pct![dk]} onChange={(e) => c.setPct!({ ...c.pct!, [dk]: Number(e.target.value) || 0 })}
                      style={{ width: 54, fontSize: ft.size.sm, textAlign: 'right', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: '2px 4px', outline: 'none', ...tnum, color: c.pct![dk] === 0 ? tk.inkFaint : c.pct![dk] > 0 ? tk.successInk : tk.dangerInk }} />
                    <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: ft.size.sm, color: tk.inkFaint }}>—</span>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Result rows */}
        <ResultRow grid={grid} label="Doanh thu (VF)" cols={cols} render={(o) => fmtTyAbs(o.revenueVnd)} />
        <ResultRow grid={grid} label="Biên EBIT" cols={cols} render={(o) => fmtPct1(o.ebitMarginPct).replace('+', '')} />
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '11px 16px', borderTop: `2px solid ${tk.border}`, background: tk.surfaceMuted, alignItems: 'center' }}>
          <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.ink }}>EBIT (lợi nhuận trước thuế)</div>
          {cols.map((c) => {
            const isBest = c.outcome.ebitVnd === bestEbit;
            const isWorst = c.outcome.ebitVnd === worstEbit && bestEbit !== worstEbit;
            return (
              <div key={c.key} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: isWorst ? tk.dangerInk : isBest ? tk.successInk : tk.ink }}>{fmtTyAbs(c.outcome.ebitVnd)}</div>
                {(isBest || isWorst) && <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: isWorst ? tk.dangerInk : tk.successInk }}>{isWorst ? '▼ THẤP NHẤT' : '▲ CAO NHẤT'}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '8px 16px', alignItems: 'center' }}>
          <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>Δ so với Cơ sở</div>
          {cols.map((c) => (
            <div key={c.key} style={{ textAlign: 'right', fontSize: ft.size.sm, ...tnum, color: c.outcome.deltaVsBaseVnd < 0 ? tk.dangerInk : c.outcome.deltaVsBaseVnd > 0 ? tk.successInk : tk.inkFaint }}>
              {c.key === 'base' ? '—' : `${fmtTySigned(c.outcome.deltaVsBaseVnd)} (${fmtPct1(c.outcome.deltaVsBasePct)})`}
            </div>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 12 }}>
        Ghi chú: EBIT giữ GIÁ BÁN cố định ở mức hiện hành (đo rủi ro nén biên). Các yếu tố áp đồng thời trong mỗi kịch bản. Preset chỉ là điểm khởi đầu — chỉnh % tuỳ ý.
      </p>
      </Screen>
      )}
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
    <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '7px 16px', borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'center' }}>
      <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{label}</div>
      {cols.map((c) => (
        <div key={c.key} style={{ textAlign: 'right', fontSize: ft.size.sm, ...tnum }}>{render(c.outcome)}</div>
      ))}
    </div>
  );
}
