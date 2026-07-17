// ADR-027 — màn "Độ Nhạy" (tab `sensitivity`, nhóm Phân Tích & Quyết Định). Trả lời
// câu if–then của CEO: "biến nào bào lợi nhuận (EBIT) mạnh NHẤT nếu lệch ±δ?".
// CHỈ đọc engine đã đóng băng qua `calculateSensitivity` (giữ giá bán cố định →
// đúng bản chất rủi ro). Biểu đồ tornado + bảng, có chọn biên độ ±δ.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { calculateSensitivity } from '../../engine/sensitivity.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtTyAbs = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmtPct1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v * 100) + '%';

const DELTAS = [0.05, 0.1, 0.2] as const;

export default function SensitivityScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [deltaPct, setDeltaPct] = useState<number>(0.1);

  const result = useMemo(() => (scenario ? calculateSensitivity(scenario, deltaPct) : null), [scenario, deltaPct]);

  if (!scenario || !result) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const base = result.baseEbitVnd;
  const maxExtent = Math.max(...result.drivers.map((d) => Math.max(Math.abs(d.downsideVnd), Math.abs(d.upsideVnd))), 1);
  const top = result.drivers[0];

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Phân Tích Độ Nhạy</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Điều gì bào lợi nhuận của tôi mạnh nhất?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Giữ NGUYÊN giá bán hiện hành, cho từng yếu tố lệch ±{fmtPct1(deltaPct)} → đo lợi nhuận trước thuế (EBIT) đổi bao nhiêu. Thanh dài nhất = rủi ro số 1 cần canh.
      </p>

      {/* Điều khiển biên độ + EBIT gốc */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>EBIT hiện tại</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(base)}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#737373' }}>Biên độ lệch:</span>
          <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden' }}>
            {DELTAS.map((d) => (
              <div key={d} onClick={() => setDeltaPct(d)}
                style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: deltaPct === d ? '#a8003b' : '#fff', color: deltaPct === d ? '#fff' : '#1a1a1a', borderRight: '1px solid #d8d8d8' }}>
                ±{fmtPct1(d)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banner rủi ro số 1 */}
      {top && (
        <div style={{ marginTop: 16, padding: '11px 16px', borderRadius: 6, border: '1px solid #b45309', background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
          ⚠ Rủi ro số 1: <b>{top.label}</b> — lệch ±{fmtPct1(deltaPct)} làm EBIT đổi tới <b>{fmtTyAbs(top.maxAbsSwingVnd)}</b> ({fmtPct1(top.maxAbsSwingVnd / Math.abs(base))} EBIT hiện tại). Đây là biến cần theo dõi/phòng hộ trước tiên.
        </div>
      )}

      {/* Biểu đồ tornado */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: '18px 20px', marginTop: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 14 }}>Biểu đồ Tornado — EBIT lệch bao nhiêu (đ) quanh mức hiện tại</div>
        {result.drivers.map((d) => {
          const leftFrac = Math.abs(d.downsideVnd) / maxExtent; // xấu (đỏ) sang trái
          const rightFrac = Math.abs(d.upsideVnd) / maxExtent; // tốt (xanh) sang phải
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 210, fontSize: 12, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
              {/* nhãn ngoài thanh — không bao giờ bị cắt dù thanh nhỏ */}
              <div style={{ width: 62, flexShrink: 0, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>{fmtTy(d.downsideVnd)}</div>
              <div style={{ flex: 1, position: 'relative', height: 24 }}>
                {/* trục giữa = EBIT gốc */}
                <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, background: '#b3b3b3' }} />
                {/* thanh xấu (đỏ, sang trái từ giữa) */}
                <div style={{ position: 'absolute', top: 2, height: 20, right: '50%', width: `${leftFrac * 50}%`, background: '#DC2626', borderRadius: '3px 0 0 3px' }} />
                {/* thanh tốt (xanh, sang phải từ giữa) */}
                <div style={{ position: 'absolute', top: 2, height: 20, left: '50%', width: `${rightFrac * 50}%`, background: '#16A34A', borderRadius: '0 3px 3px 0' }} />
              </div>
              <div style={{ width: 62, flexShrink: 0, textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>{fmtTy(d.upsideVnd)}</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#737373' }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#DC2626', borderRadius: 2, marginRight: 4 }} />Kịch bản xấu (EBIT giảm)</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#16A34A', borderRadius: 2, marginRight: 4 }} />Kịch bản tốt (EBIT tăng)</span>
        </div>
      </div>

      {/* Bảng chi tiết */}
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.8fr', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8 }}>
          {['Yếu tố', 'EBIT kịch bản xấu', 'EBIT kịch bản tốt', 'Biên độ', '% EBIT'].map((h, i) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>
        {result.drivers.map((d) => (
          <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.8fr', padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{d.label}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(base + d.downsideVnd)}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(base + d.upsideVnd)}</div>
            <div style={{ fontSize: 12, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTyAbs(d.maxAbsSwingVnd)}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{fmtPct1(d.maxAbsSwingVnd / Math.abs(base))}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10, color: '#999', marginTop: 12 }}>
        Ghi chú: EBIT ở đây giữ GIÁ BÁN cố định để đo rủi ro nén biên (khác EBIT tự-định-giá-lại theo cost-plus). Mỗi yếu tố lệch độc lập (one-at-a-time), giữ nguyên các yếu tố còn lại.
      </p>
    </div>
  );
}
