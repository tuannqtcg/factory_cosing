// ADR-027 + ADR-033 — màn "Độ Nhạy" (tornado). Logic giữ NGUYÊN (calculateSensitivity,
// EBIT giá-bán-cố-định). TRÌNH BÀY: Tailwind + shadcn/ui (Card/Segmented), KHÔNG inline-style
// hardcode màu — màu lấy từ CSS variables (src/index.css). Màu CHỈ dành cho DỮ LIỆU (EBIT
// xấu/tốt, biên độ tornado); phần width % của thanh tornado là DỮ LIỆU nên giữ inline style.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateSensitivity } from '../../engine/sensitivity.js';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtPct1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v * 100) + '%';

const DELTAS = [0.05, 0.1, 0.2] as const;

export default function SensitivityScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [deltaPct, setDeltaPct] = useState<number>(0.1);
  const result = useMemo(() => (scenario ? calculateSensitivity(scenario, deltaPct) : null), [scenario, deltaPct]);

  if (!scenario || !result) {
    return <div className="mx-auto max-w-[1040px] px-9 py-8 text-sm text-muted-foreground">Đang tải kịch bản…</div>;
  }

  const base = result.baseEbitVnd;
  const maxExtent = Math.max(...result.drivers.map((d) => Math.max(Math.abs(d.downsideVnd), Math.abs(d.upsideVnd))), 1);
  const top = result.drivers[0];

  return (
    <div className="mx-auto max-w-[1040px] px-9 py-8">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-eyebrow font-semibold uppercase tracking-[.13em] text-faint">Phân tích độ nhạy</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Điều gì bào lợi nhuận của tôi mạnh nhất?</h1>
          <p className="mt-1.5 max-w-[720px] text-sm leading-relaxed text-muted-foreground">
            {`Giữ nguyên giá bán hiện hành, cho từng yếu tố lệch ±${fmtPct1(deltaPct)} → đo lợi nhuận trước thuế (EBIT) đổi bao nhiêu. Thanh dài nhất = rủi ro số 1 cần canh.`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-eyebrow uppercase tracking-[.06em] text-faint">EBIT hiện tại</div>
          <div className="text-2xl font-bold tabular-nums text-foreground">{fmtTyAbs(base)}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {top && (
          <div className="flex items-center gap-4 rounded-md border border-warning/40 bg-warning-tint px-4 py-3 text-sm text-warning">
            <div>
              <b>Rủi ro số 1: {top.label}</b> — lệch ±{fmtPct1(deltaPct)} làm EBIT đổi tới <b>{fmtTyAbs(top.maxAbsSwingVnd)}</b> ({fmtPct1(top.maxAbsSwingVnd / Math.abs(base))} EBIT). Cần theo dõi / phòng hộ trước tiên.
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Biên độ lệch</span>
          <Segmented options={DELTAS.map((d) => ({ id: String(d), label: `±${fmtPct1(d)}` }))} value={String(deltaPct)} onChange={(v) => setDeltaPct(Number(v))} />
        </div>
      </div>

      {/* Tornado */}
      <Card className="p-5">
        <div className="mb-4 text-eyebrow font-semibold uppercase tracking-[.06em] text-muted-foreground">
          Biểu đồ tornado — EBIT lệch bao nhiêu quanh mức hiện tại
        </div>
        {result.drivers.map((d, i) => {
          const leftFrac = Math.abs(d.downsideVnd) / maxExtent;
          const rightFrac = Math.abs(d.upsideVnd) / maxExtent;
          const isLast = i === result.drivers.length - 1;
          return (
            <div key={d.key} className={`grid grid-cols-[196px_64px_1fr_64px] items-center gap-2 ${isLast ? '' : 'mb-2'}`}>
              <div className="text-right text-sm font-semibold text-foreground">{d.label}</div>
              <div className="text-right text-xs font-bold tabular-nums text-destructive">{fmtTy(d.downsideVnd)}</div>
              <div className="relative h-[22px]">
                <div className="absolute -top-[3px] -bottom-[3px] left-1/2 w-px bg-input" />
                <div className="absolute top-px h-5 rounded-l bg-destructive opacity-90" style={{ right: '50%', width: `${leftFrac * 50}%` }} />
                <div className="absolute top-px h-5 rounded-r bg-success opacity-90" style={{ left: '50%', width: `${rightFrac * 50}%` }} />
              </div>
              <div className="text-left text-xs font-bold tabular-nums text-success">{fmtTy(d.upsideVnd)}</div>
            </div>
          );
        })}
        <div className="mt-3 flex gap-4 text-xs text-faint">
          <span><span className="mr-[5px] inline-block h-[9px] w-[9px] rounded-[2px] bg-destructive align-middle" />Kịch bản xấu (EBIT giảm)</span>
          <span><span className="mr-[5px] inline-block h-[9px] w-[9px] rounded-[2px] bg-success align-middle" />Kịch bản tốt (EBIT tăng)</span>
        </div>
      </Card>

      {/* Bảng chi tiết */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] gap-2 border-b bg-muted px-4 py-2.5">
          {['Yếu tố', 'EBIT xấu', 'EBIT tốt', 'Biên độ', '% EBIT'].map((h, i) => (
            <div key={h} className={`text-eyebrow font-semibold uppercase tracking-[.05em] text-faint ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</div>
          ))}
        </div>
        {result.drivers.map((d) => (
          <div key={d.key} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] items-center gap-2 border-b border-muted px-4 py-2.5">
            <div className="text-sm font-medium text-foreground">{d.label}</div>
            <div className="text-right text-sm tabular-nums text-destructive">{fmtTyAbs(base + d.downsideVnd)}</div>
            <div className="text-right text-sm tabular-nums text-success">{fmtTyAbs(base + d.upsideVnd)}</div>
            <div className="text-right text-sm font-bold tabular-nums text-foreground">{fmtTyAbs(d.maxAbsSwingVnd)}</div>
            <div className="text-right text-sm tabular-nums text-muted-foreground">{fmtPct1(d.maxAbsSwingVnd / Math.abs(base))}</div>
          </div>
        ))}
      </Card>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        EBIT ở đây giữ giá bán cố định để đo rủi ro nén biên (khác EBIT tự-định-giá-lại theo cost-plus). Mỗi yếu tố lệch độc lập, giữ nguyên các yếu tố còn lại.
      </p>
    </div>
  );
}
