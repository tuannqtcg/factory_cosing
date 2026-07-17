// ADR-027 + ADR-033 — màn "Độ Nhạy" (tornado). Bản DEMO hệ design mới (tokens +
// primitives): analytics/fintech cao cấp. Logic giữ nguyên (calculateSensitivity,
// EBIT giá-bán-cố-định). Trình bày qua src/design/primitives.tsx.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateSensitivity } from '../../engine/sensitivity.js';
import { Screen, PageHeader, Card, Banner, Segmented, tk, sp, ft, tnum, rd } from '../../design/primitives.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtPct1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v * 100) + '%';

const DELTAS = [0.05, 0.1, 0.2] as const;

export default function SensitivityScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [deltaPct, setDeltaPct] = useState<number>(0.1);
  const result = useMemo(() => (scenario ? calculateSensitivity(scenario, deltaPct) : null), [scenario, deltaPct]);

  if (!scenario || !result) {
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản…</div></Screen>;
  }

  const base = result.baseEbitVnd;
  const maxExtent = Math.max(...result.drivers.map((d) => Math.max(Math.abs(d.downsideVnd), Math.abs(d.upsideVnd))), 1);
  const top = result.drivers[0];
  const colGrid = '196px 64px 1fr 64px';

  return (
    <Screen>
      <PageHeader
        eyebrow="Phân tích độ nhạy"
        title="Điều gì bào lợi nhuận của tôi mạnh nhất?"
        subtitle={`Giữ nguyên giá bán hiện hành, cho từng yếu tố lệch ±${fmtPct1(deltaPct)} → đo lợi nhuận trước thuế (EBIT) đổi bao nhiêu. Thanh dài nhất = rủi ro số 1 cần canh.`}
        right={
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: ft.size.eyebrow, letterSpacing: '.06em', textTransform: 'uppercase', color: tk.inkFaint }}>EBIT hiện tại</div>
            <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtTyAbs(base)}</div>
          </div>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3], flexWrap: 'wrap', marginBottom: sp[4] }}>
        {top && (
          <Banner tone="warning">
            <b>Rủi ro số 1: {top.label}</b> — lệch ±{fmtPct1(deltaPct)} làm EBIT đổi tới <b>{fmtTyAbs(top.maxAbsSwingVnd)}</b> ({fmtPct1(top.maxAbsSwingVnd / Math.abs(base))} EBIT). Cần theo dõi / phòng hộ trước tiên.
          </Banner>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
          <span style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>Biên độ lệch</span>
          <Segmented options={DELTAS.map((d) => ({ id: String(d), label: `±${fmtPct1(d)}` }))} value={String(deltaPct)} onChange={(v) => setDeltaPct(Number(v))} />
        </div>
      </div>

      {/* Tornado */}
      <Card>
        <div style={{ ...({ fontSize: ft.size.eyebrow, letterSpacing: '.06em', textTransform: 'uppercase' as const }), color: tk.inkMuted, fontWeight: ft.weight.semibold, marginBottom: sp[4] }}>
          Biểu đồ tornado — EBIT lệch bao nhiêu quanh mức hiện tại
        </div>
        {result.drivers.map((d, i) => {
          const leftFrac = Math.abs(d.downsideVnd) / maxExtent;
          const rightFrac = Math.abs(d.upsideVnd) / maxExtent;
          return (
            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: colGrid, gap: sp[2], alignItems: 'center', marginBottom: i === result.drivers.length - 1 ? 0 : sp[2] }}>
              <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.semibold, textAlign: 'right', color: tk.ink }}>{d.label}</div>
              <div style={{ textAlign: 'right', fontSize: ft.size.xs, fontWeight: ft.weight.bold, color: tk.danger, ...tnum }}>{fmtTy(d.downsideVnd)}</div>
              <div style={{ position: 'relative', height: 22 }}>
                <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: tk.borderStrong }} />
                <div style={{ position: 'absolute', top: 1, height: 20, right: '50%', width: `${leftFrac * 50}%`, background: tk.danger, borderRadius: '4px 0 0 4px', opacity: 0.9 }} />
                <div style={{ position: 'absolute', top: 1, height: 20, left: '50%', width: `${rightFrac * 50}%`, background: tk.success, borderRadius: '0 4px 4px 0', opacity: 0.9 }} />
              </div>
              <div style={{ textAlign: 'left', fontSize: ft.size.xs, fontWeight: ft.weight.bold, color: tk.success, ...tnum }}>{fmtTy(d.upsideVnd)}</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: sp[4], marginTop: sp[3], fontSize: ft.size.xs, color: tk.inkFaint }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: tk.danger, borderRadius: 2, marginRight: 5, verticalAlign: 'middle' }} />Kịch bản xấu (EBIT giảm)</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: tk.success, borderRadius: 2, marginRight: 5, verticalAlign: 'middle' }} />Kịch bản tốt (EBIT tăng)</span>
        </div>
      </Card>

      {/* Bảng chi tiết */}
      <Card style={{ marginTop: sp[4], padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.8fr', gap: sp[2], padding: `10px ${sp[4]}px`, background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}` }}>
          {['Yếu tố', 'EBIT xấu', 'EBIT tốt', 'Biên độ', '% EBIT'].map((h, i) => (
            <div key={h} style={{ fontSize: ft.size.eyebrow, letterSpacing: '.05em', textTransform: 'uppercase', color: tk.inkFaint, fontWeight: ft.weight.semibold, textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>
        {result.drivers.map((d) => (
          <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.8fr', gap: sp[2], padding: `9px ${sp[4]}px`, borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'center' }}>
            <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.medium, color: tk.ink }}>{d.label}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.danger, ...tnum }}>{fmtTyAbs(base + d.downsideVnd)}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.success, ...tnum }}>{fmtTyAbs(base + d.upsideVnd)}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', fontWeight: ft.weight.bold, color: tk.ink, ...tnum }}>{fmtTyAbs(d.maxAbsSwingVnd)}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.inkMuted, ...tnum }}>{fmtPct1(d.maxAbsSwingVnd / Math.abs(base))}</div>
          </div>
        ))}
      </Card>

      <p style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: sp[3], lineHeight: 1.5 }}>
        EBIT ở đây giữ giá bán cố định để đo rủi ro nén biên (khác EBIT tự-định-giá-lại theo cost-plus). Mỗi yếu tố lệch độc lập, giữ nguyên các yếu tố còn lại.
      </p>
      <div style={{ marginTop: sp[2], display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: ft.size.eyebrow, letterSpacing: '.06em', textTransform: 'uppercase', color: tk.brand, fontWeight: ft.weight.bold, background: tk.brandTint, padding: '3px 9px', borderRadius: rd.pill }}>
        ✦ Bản xem thử hệ giao diện mới
      </div>
    </Screen>
  );
}
