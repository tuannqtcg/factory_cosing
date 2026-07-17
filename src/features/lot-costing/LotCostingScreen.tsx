// ADR-024 — view riêng trả lời câu hỏi điều hành: "5 lô giá vật liệu khác nhau
// thì điều gì xảy ra, giá bán nào là đúng?". CHỈ ĐỌC output engine (giá vốn kép
// ADR-002 + khóa giá ADR-004) — không engine mới, không sửa dữ liệu (nhập/sửa lô
// ở màn Tồn Kho admin). Mỗi nguyên liệu 1 thẻ.
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card), KHÔNG inline-style hardcode —
// màu lấy từ CSS variables (src/index.css). Logic giữ NGUYÊN; màu CHỈ dành cho DỮ
// LIỆU/trạng thái (lãi/lỗ giữ kho, cảnh báo VAS-02, khóa/mở giá).
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { weightedAvgUsdPerKg, totalInventoryKg } from '../../engine/dual-costing.js';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e6) + ' triệu đ';

function Stat({ label, value, sub, valueCls }: { label: string; value: string; sub?: string; valueCls?: string }) {
  return (
    <div>
      <div className="text-eyebrow font-semibold uppercase tracking-[.06em] text-faint">{label}</div>
      <div className={cn('text-base font-bold tabular-nums text-foreground', valueCls)}>{value}</div>
      {sub && <div className="mt-px text-eyebrow text-faint">{sub}</div>}
    </div>
  );
}

export default function LotCostingScreen({ scenario, internal }: { scenario: ScenarioInput | null; internal: ScenarioOutput | null }) {
  if (!scenario || !internal) {
    return <div className="mx-auto max-w-[1100px] px-9 py-8 text-sm text-muted-foreground">Đang tải kịch bản + kết quả tính…</div>;
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
    <div className="mx-auto max-w-[1100px] px-9 py-8">
      <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Giá Vốn Theo Lô</div>
      <h1 className="mb-0.5 mt-1 text-2xl font-bold tracking-tight text-foreground">5 lô khác giá → giá bán nào là đúng?</h1>
      <p className="mt-1.5 max-w-[760px] text-sm leading-relaxed text-muted-foreground">
        Giá vốn bình quân (hàng đang có) vs giá tái tạo (mua mới) → lãi/lỗ giữ kho → giá bán theo sổ sách vs giá chính thức, và có cần chốt lại giá không (khóa giá ±ngưỡng, ADR-004).
      </p>

      {cards.map((c) => {
        // Ưu tiên: LỖ giữ kho (cần dự phòng VAS-02) > vượt ngưỡng (chốt lại) > ổn.
        // Trigger dự phòng theo DẤU holdingGainLoss < 0 (engine luôn trả string
        // mô tả kể cả khi OK — không dùng truthiness).
        const loss = c.dc.holdingGainLossVnd < 0;
        const reprice = !c.ev.isLocked;
        const bannerCls = loss
          ? 'border-destructive/30 bg-destructive-tint text-destructive'
          : reprice
            ? 'border-warning/30 bg-warning-tint text-warning'
            : 'border-success/30 bg-success-tint text-success';
        const bannerText = loss
          ? `⚠ LỖ giữ kho — hàng tồn đắt hơn giá thị trường hiện tại, cần dự phòng giảm giá tồn kho (VAS-02).${c.dc.provisionWarning ? ' ' + c.dc.provisionWarning : ''}`
          : reprice
            ? `⚠ Giá tái tạo lệch ${fmtPct(Math.abs(c.ev.deviationPct))} (vượt ngưỡng ${fmtPct(c.mat.inventory.priceLock.thresholdPct)}) → NÊN CHỐT LẠI giá bán theo giá tái tạo (giá chính thức bên phải đã dùng giá tái tạo).`
            : `✅ Giá tái tạo còn trong ngưỡng ±${fmtPct(c.mat.inventory.priceLock.thresholdPct)} — giữ nguyên giá bán hiện hành.`;
        return (
          <Card key={`${c.mat.id}-${c.line}`} className="mt-4 p-[18px]">
            <div className="text-sm font-bold text-foreground">
              {c.mat.name} <span className="text-[11px] font-normal text-muted-foreground">· {c.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'}</span>
            </div>

            {/* Bảng lô */}
            <div className="mt-3 grid grid-cols-2 gap-5">
              <div>
                <div className="mb-1.5 text-eyebrow font-bold uppercase text-muted-foreground">Các lô đang tồn (tối đa 5)</div>
                <Table className="text-xs">
                  <TableHeader><TableRow><TableHead>Lô</TableHead><TableHead className="text-right">Tồn (tấn)</TableHead><TableHead className="text-right">Giá (USD/kg)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {c.lots.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>Lô {i + 1}</TableCell>
                        <TableCell className="text-right tabular-nums">{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(l.tons)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtUsd(l.priceUsdPerKg)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-input font-bold">
                      <TableCell>Bình quân</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtVnd(c.totalKg)} kg</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{c.wAvg !== null ? fmtUsd(c.wAvg) : '—'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-2 content-start gap-3.5">
                <Stat label="Giá tái tạo (mua mới)" value={`${fmtUsd(c.ev.replacement)} USD/kg`} sub={`Baseline khóa ${fmtUsd(c.mat.inventory.priceLock.baseline)} · lệch ${fmtPct(c.ev.deviationPct)}`} />
                <Stat label="Trạng thái khóa giá" value={c.ev.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} valueCls={c.ev.isLocked ? 'text-success' : 'text-destructive'} sub={c.ev.stalenessWarning ?? undefined} />
                <Stat label="Lãi/lỗ giữ kho" value={fmtTy(c.dc.holdingGainLossVnd)} valueCls={c.dc.holdingGainLossVnd >= 0 ? 'text-success' : 'text-destructive'} sub={c.dc.holdingGainLossVnd >= 0 ? 'Giữ hàng rẻ hơn thị trường' : 'Hàng đắt hơn thị trường'} />
                <Stat label="Giá thành sổ sách" value={`${fmtVnd(c.dc.bookCostPerKg)} đ/kg`} sub="Theo bình quân lô đang có" />
              </div>
            </div>

            {/* 2 giá bán */}
            <div className="mt-3.5 grid grid-cols-2 gap-3.5">
              <div className="rounded-md border bg-muted p-3.5">
                <div className="text-eyebrow uppercase tracking-[.06em] text-muted-foreground">Giá bán theo giá vốn kho (sổ sách)</div>
                <div className="text-xl font-bold tabular-nums text-foreground">{fmtVnd(c.bookSalePrice)} <span className="text-[11px] font-normal text-faint">đ/kg</span></div>
                <div className="mt-0.5 text-eyebrow text-faint">= giá thành sổ sách × (1 + markup {fmtPct(c.mat.markupVf)})</div>
              </div>
              <div className="rounded-md bg-primary p-3.5 text-primary-foreground">
                <div className="text-eyebrow uppercase tracking-[.06em] text-primary-foreground/60">Giá bán chính thức (theo khóa giá)</div>
                <div className="text-xl font-bold tabular-nums">{fmtVnd(c.officialSalePrice)} <span className="text-[11px] font-normal text-primary-foreground/50">đ/kg</span></div>
                <div className="mt-0.5 text-eyebrow text-primary-foreground/60">
                  {c.ev.isLocked ? 'Dùng giá vốn baseline (còn trong ngưỡng)' : 'Dùng giá vốn tái tạo (đã vượt ngưỡng)'} · chênh {fmtVnd(c.officialSalePrice - c.bookSalePrice)} đ/kg vs sổ sách
                </div>
              </div>
            </div>

            {/* Khuyến nghị */}
            <div className={cn('mt-3 rounded-md border px-3.5 py-2 text-[11px] font-semibold', bannerCls)}>
              {bannerText}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
