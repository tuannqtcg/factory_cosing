// Thác chi phí đ/kg — trình bày 4 tầng (tiền mặt → +chung → +khấu hao → +nguyên
// liệu) để giải thích "tiền đi đâu" giữa cảm nhận vận hành và giá thành đầy đủ.
// THUẦN TRÌNH BÀY: đọc CostLayersPerKg (engine cost-breakdown.ts), không tính lại.
// ADR-033 roll-out: khung/chữ dùng design tokens; 4 màu tầng là MÀU BIỂU ĐỒ hợp
// lệ (dữ liệu, không phải trang trí UI) nên giữ hue riêng cho từng tầng.
import type { CostLayersPerKg } from '../../engine/cost-breakdown.js';
import { fmtVnd } from '../../lib/format.js';
import { color, font, radius, tnum } from '../../design/tokens.js';

type LayerKey = 'cashDirect' | 'sharedOverhead' | 'depreciation' | 'material';
const LAYER_META: Array<{ key: LayerKey; label: string; color: string; note: string }> = [
  { key: 'cashDirect', label: 'Gia công trực tiếp', color: color.success, note: 'nhân công · điện · nước · bảo trì · bao bì — chi phí gia công trực tiếp, khớp cảm nhận quản đốc (KHÔNG gánh chung/khấu hao)' },
  { key: 'sharedOverhead', label: 'Chi phí chung phân bổ', color: color.warningInk, note: 'kiểm định · thuê đất · khấu hao tài sản chung' },
  { key: 'depreciation', label: 'Khấu hao máy + khuôn', color: color.warning, note: 'không chi bằng tiền mặt → dễ bỏ quên; GIẢM mạnh khi tăng ca / lấp công suất' },
  { key: 'material', label: 'Nguyên liệu (nhập USD)', color: color.inkFaint, note: 'sàn giá cứng — bán dưới mức này là lỗ ngay từ hạt nhựa' },
];

export default function CostWaterfall({
  layers,
  title,
  subtitle,
  cashHint,
}: {
  layers: CostLayersPerKg;
  title?: string;
  subtitle?: string;
  /** Ghi chú đối chiếu cảm nhận vận hành, vd "giám đốc nhà máy: ~10.000 đ/kg". */
  cashHint?: string;
}) {
  const total = layers.total || 1;
  const pct = (v: number) => (v / total) * 100;
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: 16 }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 12 }}>
          {title && <div style={{ fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink }}>{title}</div>}
          {subtitle && <div style={{ fontSize: font.size.xs, color: color.inkMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}

      {/* Thanh xếp chồng 4 tầng */}
      <div style={{ display: 'flex', width: '100%', height: 30, borderRadius: radius.sm, overflow: 'hidden', border: `1px solid ${color.border}` }}>
        {LAYER_META.map((m) => {
          const p = pct(layers[m.key]);
          if (p <= 0) return null;
          return (
            <div key={m.key} title={`${m.label}: ${fmtVnd(layers[m.key])} đ/kg (${p.toFixed(1)}%)`} style={{ width: `${p}%`, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {p >= 8 && <span style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.inkInverse, whiteSpace: 'nowrap' }}>{p.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>

      {/* Chú giải từng tầng */}
      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
        {LAYER_META.map((m) => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: m.color, flexShrink: 0, marginTop: 3 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink }}>{m.label}</span>
                <span style={{ fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.bold, whiteSpace: 'nowrap', color: color.ink, ...tnum }}>{fmtVnd(layers[m.key])} <span style={{ color: color.inkFaint, fontWeight: font.weight.medium }}>đ/kg · {pct(layers[m.key]).toFixed(0)}%</span></span>
              </div>
              <div style={{ fontSize: font.size.xs, color: color.inkFaint, marginTop: 1 }}>{m.note}{m.key === 'cashDirect' && cashHint ? ` · ${cashHint}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tổng */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `2px solid ${color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: color.ink }}>Giá thành đầy đủ / kg</span>
        <span style={{ fontFamily: font.mono, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink, ...tnum }}>{fmtVnd(layers.total)} <span style={{ fontSize: font.size.xs, color: color.inkFaint }}>đ/kg</span></span>
      </div>
    </div>
  );
}
