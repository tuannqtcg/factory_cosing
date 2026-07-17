// ADR-028 + ADR-033 — màn "So Sánh Kịch Bản" (tab `scenario-compare`, nhóm Phân
// Tích & Quyết Định). CEO đặt 2 kịch bản (chỉnh % các driver, có preset) → xem
// EBIT/doanh thu/biên/Δ song song với Cơ sở. CHỈ đọc engine giá-bán-cố-định
// (calculateScenarioCompare). Di trú hệ design ĐEN–TRẮNG (tokens + primitives):
// logic giữ NGUYÊN, chỉ đổi trình bày — bỏ màu trang trí (magenta/xanh/kem),
// màu CHỈ còn cho DỮ LIỆU (EBIT cao/thấp nhất, Δ, % lệch từng driver).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { ScenarioOutcome } from '../../schemas/scenario-compare.js';
import { calculateScenarioCompare } from '../../engine/scenario-compare.js';
import type { DriverMultipliers } from '../../engine/scenario-drivers.js';
import { DRIVER_LABELS } from '../../engine/scenario-drivers.js';
import { Screen, PageHeader, Card, tk, sp, ft, tnum, rd } from '../../design/primitives.js';

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

// Màu DỮ LIỆU cho số lệch: âm = nguy, dương = tốt, 0 = mờ (không phải trang trí UI).
const deltaColor = (v: number) => (v < 0 ? tk.danger : v > 0 ? tk.success : tk.inkFaint);

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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản…</div></Screen>;
  }

  const cols = [
    { key: 'base', outcome: result.base, pct: null as PctChange | null, setPct: null as ((p: PctChange) => void) | null, name: 'Cơ sở', setName: null as ((s: string) => void) | null, muted: true },
    { key: 'a', outcome: result.scenarios[0]!, pct: pctA, setPct: setPctA, name: nameA, setName: setNameA, muted: false },
    { key: 'b', outcome: result.scenarios[1]!, pct: pctB, setPct: setPctB, name: nameB, setName: setNameB, muted: false },
  ];
  const grid = '190px 1fr 1fr 1fr';

  // Kịch bản tốt nhất / xấu nhất theo EBIT (gồm cả cơ sở) để tô đậm.
  const ebits = cols.map((c) => c.outcome.ebitVnd);
  const bestEbit = Math.max(...ebits);
  const worstEbit = Math.min(...ebits);

  const applyPreset = (setPct: (p: PctChange) => void, preset: Preset) => setPct({ ...ZERO, ...preset.pct });

  return (
    <Screen>
      <PageHeader
        eyebrow="So Sánh Kịch Bản"
        title="Nếu thế giới thành X thì tôi ở đâu?"
        subtitle="Đặt 2 kịch bản (chỉnh % các yếu tố, hoặc chọn preset) → EBIT / doanh thu / biên đặt cạnh Cơ sở. Giữ NGUYÊN giá bán hiện hành (đo rủi ro nén biên, đồng bộ màn Độ Nhạy)."
        right={
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: ft.size.eyebrow, letterSpacing: '.06em', textTransform: 'uppercase', color: tk.inkFaint }}>EBIT cơ sở</div>
            <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtTyAbs(result.base.ebitVnd)}</div>
          </div>
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header: tên kịch bản + preset */}
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: sp[2], padding: `${sp[3]}px ${sp[4]}px`, background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}`, alignItems: 'start' }}>
          <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.semibold, color: tk.inkFaint, letterSpacing: '.05em', textTransform: 'uppercase', alignSelf: 'center' }}>Yếu tố</div>
          {cols.map((c) => (
            <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {c.setName ? (
                <input value={c.name} onChange={(e) => c.setName!(e.target.value)}
                  style={{ fontSize: ft.size.base, fontWeight: ft.weight.bold, color: tk.ink, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: '3px 6px', outline: 'none', width: '100%' }} />
              ) : (
                <div style={{ fontSize: ft.size.base, fontWeight: ft.weight.bold, color: tk.inkMuted, padding: '4px 0' }}>{c.name}</div>
              )}
              {c.setPct && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {PRESETS.map((p) => (
                    <div key={p.label} onClick={() => applyPreset(c.setPct!, p)}
                      style={{ fontSize: ft.size.eyebrow, padding: '2px 6px', border: `1px solid ${tk.border}`, borderRadius: rd.sm, cursor: 'pointer', color: tk.inkMuted, background: tk.surface }}>
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
          <div key={dk} style={{ display: 'grid', gridTemplateColumns: grid, gap: sp[2], padding: `6px ${sp[4]}px`, borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'center' }}>
            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{DRIVER_LABELS[dk]}</div>
            {cols.map((c) => (
              <div key={c.key} style={{ textAlign: 'right' }}>
                {c.setPct ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <input type="number" value={c.pct![dk]} onChange={(e) => c.setPct!({ ...c.pct!, [dk]: Number(e.target.value) || 0 })}
                      style={{ width: 54, fontSize: ft.size.sm, textAlign: 'right', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: '2px 4px', outline: 'none', ...tnum, color: deltaColor(c.pct![dk]) }} />
                    <span style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>%</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: sp[2], padding: `11px ${sp[4]}px`, borderTop: `2px solid ${tk.borderStrong}`, background: tk.surfaceMuted, alignItems: 'center' }}>
          <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.ink }}>EBIT (lợi nhuận trước thuế)</div>
          {cols.map((c) => {
            const isBest = c.outcome.ebitVnd === bestEbit;
            const isWorst = c.outcome.ebitVnd === worstEbit && bestEbit !== worstEbit;
            return (
              <div key={c.key} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: isWorst ? tk.danger : isBest ? tk.success : tk.ink }}>{fmtTyAbs(c.outcome.ebitVnd)}</div>
                {(isBest || isWorst) && <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: isWorst ? tk.danger : tk.success }}>{isWorst ? '▼ THẤP NHẤT' : '▲ CAO NHẤT'}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: sp[2], padding: `8px ${sp[4]}px`, alignItems: 'center' }}>
          <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>Δ so với Cơ sở</div>
          {cols.map((c) => (
            <div key={c.key} style={{ textAlign: 'right', fontSize: ft.size.sm, ...tnum, color: deltaColor(c.outcome.deltaVsBaseVnd) }}>
              {c.key === 'base' ? '—' : `${fmtTySigned(c.outcome.deltaVsBaseVnd)} (${fmtPct1(c.outcome.deltaVsBasePct)})`}
            </div>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: sp[3], lineHeight: 1.5 }}>
        Ghi chú: EBIT giữ GIÁ BÁN cố định ở mức hiện hành (đo rủi ro nén biên). Các yếu tố áp đồng thời trong mỗi kịch bản. Preset chỉ là điểm khởi đầu — chỉnh % tuỳ ý.
      </p>
    </Screen>
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
  cols: { key: string; outcome: ScenarioOutcome }[];
  render: (o: ScenarioOutcome) => string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: grid, gap: sp[2], padding: `7px ${sp[4]}px`, borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'center' }}>
      <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{label}</div>
      {cols.map((c) => (
        <div key={c.key} style={{ textAlign: 'right', fontSize: ft.size.sm, ...tnum, color: tk.ink }}>{render(c.outcome)}</div>
      ))}
    </div>
  );
}
