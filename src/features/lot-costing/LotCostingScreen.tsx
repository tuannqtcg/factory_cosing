// ADR-024 — view riêng trả lời câu hỏi điều hành: "5 lô giá vật liệu khác nhau
// thì điều gì xảy ra, giá bán nào là đúng?". CHỈ ĐỌC output engine (giá vốn kép
// ADR-002 + khóa giá ADR-004) — không engine mới, không sửa dữ liệu (nhập/sửa lô
// ở màn Tồn Kho admin). Mỗi nguyên liệu 1 thẻ.
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { weightedAvgUsdPerKg, totalInventoryKg } from '../../engine/dual-costing.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e6) + ' triệu đ';

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#999', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function LotCostingScreen({
  scenario,
  internal,
  onNavigate,
}: {
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  /** ADR-034 — link chéo theo mạch làm việc (lệch ngưỡng → chốt lại ở Bảng Giá). */
  onNavigate?: (tab: string) => void;
}) {
  if (!scenario || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const cards = internal.dualCosting.byMaterial.map((dc) => {
    const mat = scenario.materials.find((m) => m.id === dc.materialId);
    const lockEntry = internal.priceLock.byMaterial.find((e) => e.materialId === dc.materialId);
    const ladderEntry = internal.priceLadder.byLineMaterial.find((e) => e.line === dc.line && e.materialId === dc.materialId);
    if (!mat || !lockEntry || !ladderEntry) return null;
    const ev = lockEntry.evaluation;
    const lots = mat.inventory.lots;
    const wAvg = weightedAvgUsdPerKg(lots); // USD/kg bình quân — null nếu chưa có lô
    const totalKg = totalInventoryKg(lots);
    const bookSalePrice = Math.round(dc.bookCostPerKg * (1 + mat.markupVf)); // đ/kg theo giá vốn sổ sách
    const officialSalePrice = ladderEntry.ladder.targetPrice; // đ/kg theo khóa giá (giá chính thức)
    return { dc, mat, ev, lots, wAvg, totalKg, bookSalePrice, officialSalePrice, line: dc.line };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Giá Vốn Theo Lô</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>5 lô khác giá → giá bán nào là đúng?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Giá vốn bình quân (hàng đang có) vs giá tái tạo (mua mới) → lãi/lỗ giữ kho → giá bán theo sổ sách vs giá chính thức, và có cần chốt lại giá không (khóa giá ±ngưỡng, ADR-004).
      </p>

      {cards.map((c) => {
        // Ưu tiên: LỖ giữ kho (cần dự phòng VAS-02) > vượt ngưỡng (chốt lại) > ổn.
        // Trigger dự phòng theo DẤU holdingGainLoss < 0 (engine luôn trả string
        // mô tả kể cả khi OK — không dùng truthiness).
        const loss = c.dc.holdingGainLossVnd < 0;
        const reprice = !c.ev.isLocked;
        const bannerColor = loss ? '#DC2626' : reprice ? '#b45309' : '#16A34A';
        const bannerBg = loss ? '#fef2f2' : reprice ? '#fffbeb' : '#f0fdf4';
        const bannerText = loss
          ? `⚠ LỖ giữ kho — hàng tồn đắt hơn giá thị trường hiện tại, cần dự phòng giảm giá tồn kho (VAS-02).${c.dc.provisionWarning ? ' ' + c.dc.provisionWarning : ''}`
          : reprice
            ? `⚠ Giá tái tạo lệch ${fmtPct(Math.abs(c.ev.deviationPct))} (vượt ngưỡng ${fmtPct(c.mat.inventory.priceLock.thresholdPct)}) → NÊN CHỐT LẠI giá bán theo giá tái tạo (giá chính thức bên phải đã dùng giá tái tạo).`
            : `✅ Giá tái tạo còn trong ngưỡng ±${fmtPct(c.mat.inventory.priceLock.thresholdPct)} — giữ nguyên giá bán hiện hành.`;
        return (
          <div key={`${c.mat.id}-${c.line}`} style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 18, marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {c.mat.name} <span style={{ fontSize: 11, color: '#737373' }}>· {c.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'}</span>
            </div>

            {/* Bảng lô */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 6 }}>Các lô đang tồn (tối đa 5)</div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ textAlign: 'left', color: '#999', fontSize: 10 }}><th>Lô</th><th style={{ textAlign: 'right' }}>Tồn (tấn)</th><th style={{ textAlign: 'right' }}>Giá (USD/kg)</th></tr></thead>
                  <tbody>
                    {c.lots.map((l, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f0ece0' }}>
                        <td>Lô {i + 1}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(l.tons)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(l.priceUsdPerKg)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e0d0', fontWeight: 700 }}>
                      <td>Bình quân</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(c.totalKg)} kg</td>
                      <td style={{ textAlign: 'right', color: '#a8003b' }}>{c.wAvg !== null ? fmtUsd(c.wAvg) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
                <Stat label="Giá tái tạo (mua mới)" value={`${fmtUsd(c.ev.replacement)} USD/kg`} sub={`Baseline khóa ${fmtUsd(c.mat.inventory.priceLock.baseline)} · lệch ${fmtPct(c.ev.deviationPct)}`} />
                <Stat label="Trạng thái khóa giá" value={c.ev.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} color={c.ev.isLocked ? '#16A34A' : '#DC2626'} sub={c.ev.stalenessWarning ?? undefined} />
                <Stat label="Lãi/lỗ giữ kho" value={fmtTy(c.dc.holdingGainLossVnd)} color={c.dc.holdingGainLossVnd >= 0 ? '#16A34A' : '#DC2626'} sub={c.dc.holdingGainLossVnd >= 0 ? 'Giữ hàng rẻ hơn thị trường' : 'Hàng đắt hơn thị trường'} />
                <Stat label="Giá thành sổ sách" value={`${fmtVnd(c.dc.bookCostPerKg)} đ/kg`} sub="Theo bình quân lô đang có" />
              </div>
            </div>

            {/* 2 giá bán */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>Giá bán theo giá vốn kho (sổ sách)</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(c.bookSalePrice)} <span style={{ fontSize: 11, color: '#999' }}>đ/kg</span></div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>= giá thành sổ sách × (1 + markup {fmtPct(c.mat.markupVf)})</div>
              </div>
              <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 10, color: '#ff9db8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Giá bán chính thức (theo khóa giá)</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(c.officialSalePrice)} <span style={{ fontSize: 11, color: '#999' }}>đ/kg</span></div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                  {c.ev.isLocked ? 'Dùng giá vốn baseline (còn trong ngưỡng)' : 'Dùng giá vốn tái tạo (đã vượt ngưỡng)'} · chênh {fmtVnd(c.officialSalePrice - c.bookSalePrice)} đ/kg vs sổ sách
                </div>
              </div>
            </div>

            {/* Khuyến nghị */}
            <div style={{ marginTop: 12, padding: '9px 14px', borderRadius: 6, border: `1px solid ${bannerColor}`, background: bannerBg, color: bannerColor, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{bannerText}</span>
              {reprice && onNavigate && (
                <button
                  onClick={() => onNavigate('pricing')}
                  style={{ flexShrink: 0, padding: '6px 12px', background: bannerColor, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  → Chốt lại ở Bảng Giá
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
