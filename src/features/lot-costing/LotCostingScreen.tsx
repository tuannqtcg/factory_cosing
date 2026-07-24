// ADR-024 — view riêng trả lời câu hỏi điều hành: "5 lô giá vật liệu khác nhau
// thì điều gì xảy ra, giá bán nào là đúng?". CHỈ ĐỌC output engine (giá vốn kép
// ADR-002 + khóa giá ADR-004) — không engine mới, không sửa dữ liệu (nhập/sửa lô
// ở màn Tồn Kho admin). Mỗi nguyên liệu 1 thẻ.
// ADR-033 roll-out: trình bày qua design tokens/primitives (đen–trắng tối giản).
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { weightedAvgUsdPerKg, totalInventoryKg } from '../../engine/dual-costing.js';
import { Screen, PageHeader, Card, Stat, Banner, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle, type SemanticTone } from '../../design/tokens.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e6) + ' triệu đ';

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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản + kết quả tính…</div></Screen>;
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
    <Screen maxWidth={1100}>
      <PageHeader
        eyebrow="Giá Vốn Theo Lô"
        title="5 lô khác giá → giá bán nào là đúng?"
        subtitle="Giá vốn bình quân (hàng đang có) vs giá tái tạo (mua mới) → lãi/lỗ giữ kho → giá bán theo sổ sách vs giá chính thức, và có cần chốt lại giá không (khóa giá ±ngưỡng, ADR-004)."
        right={onNavigate && (
          <button
            onClick={() => onNavigate('lot-costing:edit')}
            style={{ flexShrink: 0, padding: '8px 16px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: 'pointer' }}
          >
            ✎ Cập nhật lô hàng (nhập kho / sửa lô)
          </button>
        )}
      />

      {cards.map((c) => {
        // Ưu tiên: LỖ giữ kho (cần dự phòng VAS-02) > vượt ngưỡng (chốt lại) > ổn.
        // Trigger dự phòng theo DẤU holdingGainLoss < 0 (engine luôn trả string
        // mô tả kể cả khi OK — không dùng truthiness).
        const loss = c.dc.holdingGainLossVnd < 0;
        const reprice = !c.ev.isLocked;
        const tone: SemanticTone = loss ? 'danger' : reprice ? 'warning' : 'success';
        const bannerText = loss
          ? `⚠ LỖ giữ kho — hàng tồn đắt hơn giá thị trường hiện tại, cần dự phòng giảm giá tồn kho (VAS-02).${c.dc.provisionWarning ? ' ' + c.dc.provisionWarning : ''}`
          : reprice
            ? `⚠ Giá tái tạo lệch ${fmtPct(Math.abs(c.ev.deviationPct))} (vượt ngưỡng ${fmtPct(c.mat.inventory.priceLock.thresholdPct)}) → NÊN CHỐT LẠI giá bán theo giá tái tạo (giá chính thức bên phải đã dùng giá tái tạo).`
            : `✅ Giá tái tạo còn trong ngưỡng ±${fmtPct(c.mat.inventory.priceLock.thresholdPct)} — giữ nguyên giá bán hiện hành.`;
        return (
          <Card key={`${c.mat.id}-${c.line}`} style={{ marginTop: sp[4] }}>
            <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>
              {c.mat.name} <span style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>· {c.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'}</span>
            </div>

            {/* Bảng lô */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
              <div>
                <div style={{ ...eyebrowStyle, marginBottom: 6 }}>Các lô đang tồn (tối đa 5)</div>
                <table style={{ width: '100%', fontSize: ft.size.sm, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ textAlign: 'left', color: tk.inkFaint, fontSize: ft.size.xs }}><th>Lô</th><th style={{ textAlign: 'right' }}>Tồn (tấn)</th><th style={{ textAlign: 'right' }}>Giá (USD/kg)</th></tr></thead>
                  <tbody>
                    {c.lots.map((l, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${tk.surfaceMuted}` }}>
                        <td>Lô {i + 1}</td>
                        <td style={{ textAlign: 'right', ...tnum }}>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(l.tons)}</td>
                        <td style={{ textAlign: 'right', ...tnum }}>{fmtUsd(l.priceUsdPerKg)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${tk.border}`, fontWeight: ft.weight.bold }}>
                      <td>Bình quân</td>
                      <td style={{ textAlign: 'right', ...tnum }}>{fmtVnd(c.totalKg)} kg</td>
                      <td style={{ textAlign: 'right', color: tk.ink, ...tnum }}>{c.wAvg !== null ? fmtUsd(c.wAvg) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
                <Stat label="Giá tái tạo (mua mới)" value={`${fmtUsd(c.ev.replacement)} USD/kg`} sub={`Baseline khóa ${fmtUsd(c.mat.inventory.priceLock.baseline)} · lệch ${fmtPct(c.ev.deviationPct)}`} />
                <Stat label="Trạng thái khóa giá" value={c.ev.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} tone={c.ev.isLocked ? 'success' : 'danger'} sub={c.ev.stalenessWarning ?? undefined} />
                <Stat label="Lãi/lỗ giữ kho" value={fmtTy(c.dc.holdingGainLossVnd)} tone={c.dc.holdingGainLossVnd >= 0 ? 'success' : 'danger'} sub={c.dc.holdingGainLossVnd >= 0 ? 'Giữ hàng rẻ hơn thị trường' : 'Hàng đắt hơn thị trường'} />
                <Stat label="Giá thành sổ sách" value={`${fmtVnd(c.dc.bookCostPerKg)} đ/kg`} sub="Theo bình quân lô đang có" />
              </div>
            </div>

            {/* 2 giá bán */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <Card pad={14} style={{ background: tk.surfaceMuted }}>
                <div style={{ ...eyebrowStyle }}>Giá bán theo giá vốn kho (sổ sách)</div>
                <div style={{ fontSize: ft.size.xl, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(c.bookSalePrice)} <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>đ/kg</span></div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 2 }}>= giá thành sổ sách × (1 + markup {fmtPct(c.mat.markupVf)})</div>
              </Card>
              <Card pad={14} inverse>
                <div style={{ ...eyebrowStyle, color: tk.sidebarText }}>Giá bán chính thức (theo khóa giá)</div>
                <div style={{ fontSize: ft.size.xl, fontWeight: ft.weight.bold, ...tnum }}>{fmtVnd(c.officialSalePrice)} <span style={{ fontSize: ft.size.xs, color: tk.sidebarText }}>đ/kg</span></div>
                <div style={{ fontSize: ft.size.xs, color: tk.sidebarText, marginTop: 2 }}>
                  {c.ev.isLocked ? 'Dùng giá vốn baseline (còn trong ngưỡng)' : 'Dùng giá vốn tái tạo (đã vượt ngưỡng)'} · chênh {fmtVnd(c.officialSalePrice - c.bookSalePrice)} đ/kg vs sổ sách
                </div>
              </Card>
            </div>

            {/* Khuyến nghị */}
            <div style={{ marginTop: 12 }}>
              <Banner
                tone={tone}
                action={reprice && onNavigate ? (
                  <button
                    onClick={() => onNavigate('pricing')}
                    style={{ flexShrink: 0, padding: '6px 12px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: 'pointer' }}
                  >
                    → Chốt lại ở Bảng Giá
                  </button>
                ) : undefined}
              >
                {bannerText}
              </Banner>
            </div>
          </Card>
        );
      })}
    </Screen>
  );
}
