// ADR-028 + ADR-033 — màn "So Sánh Kịch Bản" (tab `scenario-compare`, nhóm Phân
// Tích & Quyết Định). CEO đặt 2 kịch bản (chỉnh % các driver, có preset) → xem
// EBIT/doanh thu/biên/Δ song song với Cơ sở. CHỈ đọc engine giá-bán-cố-định
// (calculateScenarioCompare). TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button/
// Badge), KHÔNG inline-style hardcode — màu lấy từ CSS variables (src/index.css).
// Logic giữ NGUYÊN; màu CHỈ dành cho DỮ LIỆU (EBIT cao/thấp nhất, Δ, % lệch driver).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { ScenarioOutcome } from '../../schemas/scenario-compare.js';
import { calculateScenarioCompare } from '../../engine/scenario-compare.js';
import type { DriverMultipliers } from '../../engine/scenario-drivers.js';
import { DRIVER_LABELS } from '../../engine/scenario-drivers.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
const deltaCls = (v: number) => (v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : 'text-faint');

const GRID = 'grid grid-cols-[190px_1fr_1fr_1fr] items-center gap-2 px-4';

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
    return <div className="mx-auto max-w-[1040px] px-9 py-8 text-sm text-muted-foreground">Đang tải kịch bản…</div>;
  }

  const cols = [
    { key: 'base', outcome: result.base, pct: null as PctChange | null, setPct: null as ((p: PctChange) => void) | null, name: 'Cơ sở', setName: null as ((s: string) => void) | null, muted: true },
    { key: 'a', outcome: result.scenarios[0]!, pct: pctA, setPct: setPctA, name: nameA, setName: setNameA, muted: false },
    { key: 'b', outcome: result.scenarios[1]!, pct: pctB, setPct: setPctB, name: nameB, setName: setNameB, muted: false },
  ];

  // Kịch bản tốt nhất / xấu nhất theo EBIT (gồm cả cơ sở) để tô đậm.
  const ebits = cols.map((c) => c.outcome.ebitVnd);
  const bestEbit = Math.max(...ebits);
  const worstEbit = Math.min(...ebits);

  const applyPreset = (setPct: (p: PctChange) => void, preset: Preset) => setPct({ ...ZERO, ...preset.pct });

  return (
    <div className="mx-auto max-w-[1040px] px-9 py-8">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-eyebrow font-semibold uppercase tracking-[.13em] text-faint">So Sánh Kịch Bản</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Nếu thế giới thành X thì tôi ở đâu?</h1>
          <p className="mt-1.5 max-w-[720px] text-sm leading-relaxed text-muted-foreground">
            Đặt 2 kịch bản (chỉnh % các yếu tố, hoặc chọn preset) → EBIT / doanh thu / biên đặt cạnh Cơ sở. Giữ NGUYÊN giá bán hiện hành (đo rủi ro nén biên, đồng bộ màn Độ Nhạy).
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-eyebrow uppercase tracking-[.06em] text-faint">EBIT cơ sở</div>
          <div className="text-2xl font-bold tabular-nums text-foreground">{fmtTyAbs(result.base.ebitVnd)}</div>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Header: tên kịch bản + preset */}
        <div className={cn(GRID, 'items-start border-b bg-muted py-3')}>
          <div className="self-center text-eyebrow font-semibold uppercase tracking-[.05em] text-faint">Yếu tố</div>
          {cols.map((c) => (
            <div key={c.key} className="flex flex-col gap-1.5">
              {c.setName ? (
                <Input value={c.name} onChange={(e) => c.setName!(e.target.value)} className="h-7 font-bold text-foreground" />
              ) : (
                <div className="py-1 text-[13px] font-bold text-muted-foreground">{c.name}</div>
              )}
              {c.setPct && (
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <Button key={p.label} variant="outline" size="sm" className="h-auto px-1.5 py-0.5 text-eyebrow font-medium" onClick={() => applyPreset(c.setPct!, p)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Driver rows (chỉnh %) */}
        {DRIVER_KEYS.map((dk) => (
          <div key={dk} className={cn(GRID, 'border-b border-muted py-1.5')}>
            <div className="text-xs text-muted-foreground">{DRIVER_LABELS[dk]}</div>
            {cols.map((c) => (
              <div key={c.key} className="text-right">
                {c.setPct ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Input
                      type="number"
                      value={c.pct![dk]}
                      onChange={(e) => c.setPct!({ ...c.pct!, [dk]: Number(e.target.value) || 0 })}
                      className={cn('h-7 w-14 px-1.5 text-right text-sm tabular-nums', deltaCls(c.pct![dk]))}
                    />
                    <span className="text-eyebrow text-faint">%</span>
                  </span>
                ) : (
                  <span className="text-sm text-faint">—</span>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Result rows */}
        <ResultRow label="Doanh thu (VF)" cols={cols} render={(o) => fmtTyAbs(o.revenueVnd)} />
        <ResultRow label="Biên EBIT" cols={cols} render={(o) => fmtPct1(o.ebitMarginPct).replace('+', '')} />

        {/* EBIT (dòng nhấn) */}
        <div className={cn(GRID, 'border-t-2 border-input bg-muted py-3')}>
          <div className="text-sm font-bold text-foreground">EBIT (lợi nhuận trước thuế)</div>
          {cols.map((c) => {
            const isBest = c.outcome.ebitVnd === bestEbit;
            const isWorst = c.outcome.ebitVnd === worstEbit && bestEbit !== worstEbit;
            return (
              <div key={c.key} className="flex flex-col items-end gap-1 text-right">
                <div className={cn('text-base font-bold tabular-nums', isWorst ? 'text-destructive' : isBest ? 'text-success' : 'text-foreground')}>{fmtTyAbs(c.outcome.ebitVnd)}</div>
                {(isBest || isWorst) && (
                  <Badge variant={isWorst ? 'destructive' : 'success'}>{isWorst ? '▼ Thấp nhất' : '▲ Cao nhất'}</Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Δ so với cơ sở */}
        <div className={cn(GRID, 'py-2')}>
          <div className="text-xs text-muted-foreground">Δ so với Cơ sở</div>
          {cols.map((c) => (
            <div key={c.key} className={cn('text-right text-sm tabular-nums', deltaCls(c.outcome.deltaVsBaseVnd))}>
              {c.key === 'base' ? '—' : `${fmtTySigned(c.outcome.deltaVsBaseVnd)} (${fmtPct1(c.outcome.deltaVsBasePct)})`}
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        Ghi chú: EBIT giữ GIÁ BÁN cố định ở mức hiện hành (đo rủi ro nén biên). Các yếu tố áp đồng thời trong mỗi kịch bản. Preset chỉ là điểm khởi đầu — chỉnh % tuỳ ý.
      </p>
    </div>
  );
}

function ResultRow({
  label,
  cols,
  render,
}: {
  label: string;
  cols: { key: string; outcome: ScenarioOutcome }[];
  render: (o: ScenarioOutcome) => string;
}) {
  return (
    <div className={cn(GRID, 'border-b border-muted py-1.5')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      {cols.map((c) => (
        <div key={c.key} className="text-right text-sm tabular-nums text-foreground">{render(c.outcome)}</div>
      ))}
    </div>
  );
}
