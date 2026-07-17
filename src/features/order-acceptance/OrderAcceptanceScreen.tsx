// ADR-029 + ADR-033 — màn "Quyết Định Nhận Đơn" (tab `order-acceptance`, nhóm Phân
// Tích & Quyết Định). CEO nhập đơn (dòng SP, sản lượng, giá chào) → verdict NHẬN/CÂN
// NHẮC/KHÔNG + biên đóng góp, so 2 sàn (giá thị trường vs giá vốn khóa) + panel khóa
// giá what-if (chỉnh ngưỡng TẠM, không lưu — đổi chính thức ở tab Tham Số). Đọc engine
// đã đóng băng qua `decideOrder`. TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button/
// Segmented), KHÔNG inline-style hardcode — màu lấy từ CSS variables (src/index.css).
// Logic giữ NGUYÊN; màu CHỈ dành cho DỮ LIỆU (verdict, độ lệch, trạng thái khóa).
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { decideOrder } from '../../engine/order-acceptance.js';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';

// Màu verdict = DỮ LIỆU trạng thái đơn (không trang trí): text + viền + nền tint semantic.
const VERDICT: Record<string, { label: string; cls: string; note: string }> = {
  accept: { label: '✅ NÊN NHẬN', cls: 'border-success/40 bg-success-tint text-success', note: 'Giá chào bù đủ giá thành đầy đủ (cả định phí) — có lãi.' },
  consider: { label: '⚠ CÂN NHẮC', cls: 'border-warning/40 bg-warning-tint text-warning', note: 'Trên sàn tiền tươi nhưng dưới giá thành đầy đủ — CHỈ nhận nếu còn công suất trống (đóng góp bù định phí), đừng để lấn đơn giá tốt.' },
  reject: { label: '⛔ KHÔNG NÊN NHẬN', cls: 'border-destructive/40 bg-destructive-tint text-destructive', note: 'Giá chào dưới sàn tiền tươi tại giá thị trường — làm là lỗ ngay tiền mặt (mua NL mới còn không đủ).' },
};

function Num({ label, value, unit, colorCls, strong }: { label: string; value: string; unit?: string; colorCls?: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-eyebrow uppercase tracking-[.05em] text-faint">{label}</div>
      <div className={cn('font-bold tabular-nums', strong ? 'text-lg' : 'text-[15px]', colorCls ?? 'text-foreground')}>
        {value}
        {unit && <span className="text-[10px] font-normal text-faint"> {unit}</span>}
      </div>
    </div>
  );
}

export default function OrderAcceptanceScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [line, setLine] = useState<'pipe' | 'fitting'>('pipe');
  const [quantityTons, setQuantityTons] = useState(50);
  const [offeredPrice, setOfferedPrice] = useState(130000);
  const [thresholdOverride, setThresholdOverride] = useState<number | null>(null);

  const result = useMemo(
    () =>
      scenario
        ? decideOrder(scenario, {
            line,
            quantityTons,
            offeredPriceVndPerKg: offeredPrice,
            ...(thresholdOverride != null ? { thresholdPctWhatIf: thresholdOverride } : {}),
          })
        : null,
    [scenario, line, quantityTons, offeredPrice, thresholdOverride],
  );

  if (!scenario || !result) {
    return <div className="px-9 py-8 text-xs text-muted-foreground">Đang tải kịch bản…</div>;
  }

  const v = VERDICT[result.verdict]!;
  const thr = result.lock.thresholdPct;
  const setLineReset = (l: 'pipe' | 'fitting') => { setLine(l); setThresholdOverride(null); };

  return (
    <div className="mx-auto max-w-[1000px] px-9 py-8">
      <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Quyết Định Nhận Đơn</div>
      <h1 className="mb-0.5 mt-1 text-2xl font-bold text-foreground">Đơn này có nên nhận không?</h1>
      <p className="text-xs leading-relaxed text-muted-foreground">
        So giá chào với sàn tiền tươi + giá thành đầy đủ. <b>Đơn mới phải mua nguyên liệu mới</b> → sàn chuẩn tính theo <b>giá thị trường (tái tạo)</b>, không phải giá vốn cũ đã khóa.
      </p>

      {/* Nhập đơn */}
      <Card className="mt-4 flex flex-wrap items-end gap-5 p-4">
        <div>
          <div className="mb-1 text-eyebrow uppercase text-faint">Dòng sản phẩm</div>
          <Segmented
            options={[
              { id: 'pipe' as const, label: 'Ống CPVC' },
              { id: 'fitting' as const, label: 'Phụ kiện' },
            ]}
            value={line}
            onChange={setLineReset}
          />
        </div>
        <div>
          <div className="mb-1 text-eyebrow uppercase text-faint">Sản lượng đơn (tấn)</div>
          <Input type="number" value={quantityTons} onChange={(e) => setQuantityTons(Number(e.target.value) || 0)} className="w-[110px] text-right font-bold tabular-nums" />
        </div>
        <div>
          <div className="mb-1 text-eyebrow uppercase text-faint">Giá chào (đ/kg)</div>
          <Input type="number" value={offeredPrice} onChange={(e) => setOfferedPrice(Number(e.target.value) || 0)} className="w-[130px] text-right font-bold tabular-nums" />
        </div>
      </Card>

      {/* Verdict */}
      <div className={cn('mt-4 rounded-lg border px-[18px] py-4', v.cls)}>
        <div className="flex flex-wrap items-baseline gap-3.5">
          <div className="text-xl font-extrabold">{v.label}</div>
          <div className="text-[13px] font-semibold">
            Đóng góp {fmtVnd(result.contributionPerKgVnd)} đ/kg · cả đơn {fmtTy(result.contributionTotalVnd)} đ
            {result.verdict === 'accept' && ` · lãi so giá thành đầy đủ ${fmtTy(result.profitVsFullCostTotalVnd)} đ`}
          </div>
        </div>
        <div className="mt-1.5 text-[11px]">{v.note}</div>
      </div>

      {/* So sánh sàn */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-primary p-4 text-primary-foreground">
          <div className="text-eyebrow uppercase tracking-[.05em] text-primary-foreground/60">Sàn tiền tươi — giá THỊ TRƯỜNG</div>
          <div className="text-xl font-bold tabular-nums">{fmtVnd(result.marketVariableFloorVndPerKg)} <span className="text-[10px] text-primary-foreground/50">đ/kg</span></div>
          <div className="mt-[3px] text-[10px] text-primary-foreground/70">Biến phí khi mua NL mới. Bán dưới mức này = lỗ tiền tươi. <b>Sàn chuẩn cho đơn mới.</b></div>
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <div className="text-eyebrow uppercase tracking-[.05em] text-faint">Giá thành đầy đủ — thị trường</div>
          <div className="text-xl font-bold tabular-nums text-foreground">{fmtVnd(result.marketFullCostVndPerKg)} <span className="text-[10px] text-faint">đ/kg</span></div>
          <div className="mt-[3px] text-[10px] text-muted-foreground">Bù cả định phí. Trên mức này là lãi thực sự.</div>
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <div className="text-eyebrow uppercase tracking-[.05em] text-faint">Sàn tiền tươi — giá vốn KHÓA</div>
          <div className="text-xl font-bold tabular-nums text-foreground">{fmtVnd(result.lockedVariableFloorVndPerKg)} <span className="text-[10px] text-faint">đ/kg</span></div>
          <div className="mt-[3px] text-[10px] text-muted-foreground">Chỉ đúng nếu làm đơn bằng <b>hàng tồn đã có</b> (không mua bù).</div>
        </div>
      </div>

      {/* Panel khóa giá what-if */}
      <Card className="mt-4 p-4">
        <div className="mb-3 text-[11px] font-bold uppercase text-muted-foreground">
          Khóa giá — {result.materialName} <span className="font-normal normal-case">(thử ngưỡng, không lưu cấu hình)</span>
        </div>
        <div className="mb-3.5 grid grid-cols-4 gap-3.5">
          <Num label="Giá vốn khóa (baseline)" value={fmtUsd(result.lock.baselineUsdPerKg)} unit="USD/kg" />
          <Num label="Giá thị trường (tái tạo)" value={fmtUsd(result.lock.replacementUsdPerKg)} unit="USD/kg" />
          <Num label="Độ lệch" value={fmtPct(result.lock.deviationPct)} colorCls={Math.abs(result.lock.deviationPct) > thr ? 'text-destructive' : 'text-success'} />
          <Num label={`Trạng thái tại ngưỡng ${fmtPct(thr)}`} value={result.lock.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} colorCls={result.lock.isLocked ? 'text-success' : 'text-destructive'} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-[130px] text-[11px] text-muted-foreground">Ngưỡng khóa giá (thử):</span>
          <Slider value={Math.round(thr * 100)} onValueChange={(v) => setThresholdOverride(v / 100)} min={0} max={30} step={1} className="min-w-[180px] flex-1 accent-primary" />
          <span className="w-12 text-right text-[13px] font-bold tabular-nums text-foreground">{fmtPct(thr)}</span>
          {thresholdOverride != null && (
            <Button variant="outline" size="sm" onClick={() => setThresholdOverride(null)}>Về ngưỡng cấu hình</Button>
          )}
        </div>
        <div className="mt-2.5 rounded-md bg-muted px-3 py-2.5 text-[11px] text-foreground">
          Ở ngưỡng {fmtPct(thr)}: giá niêm yết áp dụng ={' '}
          <b>{fmtUsd(result.lock.appliedPricingUsdPerKg)} USD/kg</b>{' '}
          ({result.lock.isLocked ? 'giữ giá vốn khóa cũ' : 'chuyển sang giá thị trường'}).{' '}
          <b>Dù bảng giá niêm yết còn khóa hay không, đơn MỚI vẫn phải mua NL ở giá thị trường</b> — nên verdict trên đây luôn tính theo sàn thị trường. Đổi ngưỡng chính thức (ảnh hưởng toàn bảng giá): vào tab <b>Tham Số</b>.
        </div>
      </Card>
    </div>
  );
}
