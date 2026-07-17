// Pha 3 (ADR-021) — màn "Trợ Lý CEO" gắn vào view CEO (ADR-020). 3 bước: nhập →
// chạy số (engine ceo-planner client-side, KHÔNG chép công thức) → AI tư vấn
// (callable adviseScenario, fallback mock cục bộ). Dựng theo prototype đã duyệt
// Pha 1 (prototype/ceo-planner.html), số liệu THẬT từ scenario.
// TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button) — ADR-033 TỐI GIẢN ĐEN–TRẮNG.
// Logic/props/format giữ NGUYÊN; màu CHỈ cho DỮ LIỆU/trạng thái (sàn giá, lãi/lỗ).
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { CeoPlannerRequest, CeoPlannerResult, CeoAdviceResult, MarginMode, CeoLineResult } from '../../schemas/ceo-planner.js';
import { calculateCeoPlanner } from '../../engine/ceo-planner.js';
import { generateCeoAdviceMock } from '../../engine/ceo-advice-mock.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);
// Chấm màu thang giá 5 bậc = màu DỮ LIỆU (ranh sàn → mục tiêu), không trang trí UI.
const TIER = [
  { key: 'variableCostFloor', label: '1 · Sàn biến phí — RANH ĐỎ', dot: 'bg-destructive' },
  { key: 'cashBreakEven', label: '2 · Hòa vốn tiền mặt', dot: 'bg-warning' },
  { key: 'fullCost', label: '3 · Giá thành đầy đủ (giá vốn)', dot: 'bg-muted-foreground' },
  { key: 'enterpriseBreakEven', label: '4 · Hòa vốn toàn doanh nghiệp', dot: 'bg-foreground' },
  { key: 'targetVf', label: '5 · Giá mục tiêu markup chuẩn VF', dot: 'bg-success' },
] as const;

function Seg<T extends string | number>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-input bg-card">
      {options.map((o, i) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold transition-colors',
            i > 0 && 'border-l border-border',
            o.v === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-foreground">{label}</div>
      {children}
      {hint && <div className="mt-0.5 text-[10px] text-faint">{hint}</div>}
    </div>
  );
}

function LadderRows({ line }: { line: CeoLineResult }) {
  const rows = [
    ...TIER.map((t) => ({ label: t.label, v: line.ladder[t.key], dot: t.dot, you: false })),
    { label: 'GIÁ CỦA BẠN', v: line.sellingPriceVndPerKg, dot: 'bg-primary-foreground', you: true },
  ].sort((a, b) => b.v - a.v);
  return (
    <div className="mt-2">
      {rows.map((r, i) => (
        <div key={i} className={cn('flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]', r.you ? 'bg-primary font-bold text-primary-foreground' : 'text-foreground')}>
          <span className="flex items-center gap-1.5">
            <span className={cn('inline-block h-2 w-2 rounded-full', r.dot)} />
            {r.label}
          </span>
          <span className="tabular-nums">{fmtVnd(r.v)} đ/kg</span>
        </div>
      ))}
    </div>
  );
}

function LineCard({ line }: { line: CeoLineResult }) {
  const t4 = line.ladder.enterpriseBreakEven;
  const t1 = line.ladder.variableCostFloor;
  const ok = line.sellingPriceVndPerKg >= t4;
  const below1 = line.sellingPriceVndPerKg < t1;
  return (
    <Card className="bg-muted p-4">
      <div className="text-[13px] font-bold text-foreground">
        {line.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'} · <span className="font-semibold">{line.materialName}</span> — giá bán VF đề xuất
      </div>
      <div className="my-1 text-[26px] font-bold tabular-nums text-foreground">
        {fmtVnd(line.sellingPriceVndPerKg)} <span className="text-[13px] font-normal text-muted-foreground">đ/{line.line === 'pipe' ? 'kg' : 'kg (tham chiếu)'}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Giá thành <b>{fmtVnd(line.fullCostVndPerKg)}</b> = nguyên liệu <b>{fmtVnd(line.materialCostVndPerKg)}</b> + gia công <b>{fmtVnd(line.processingCostVndPerKg)}</b> + bao bì <b>{fmtVnd(line.packagingCostVndPerKg)}</b> · lãi gộp <b>{fmt1(line.marginOnPricePct)}%</b>
        {line.machineHourCostVnd !== undefined ? ` · chi phí 1 giờ máy ép ${fmtVnd(line.machineHourCostVnd)} đ` : ''}
      </div>
      <div className={cn('mt-2 rounded-sm px-2.5 py-1.5 text-[10px] font-semibold', below1 ? 'bg-destructive-tint text-destructive' : ok ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning')}>
        {below1 ? '⛔ Dưới sàn biến phí — lỗ tiền tươi từng kg' : ok ? '✅ Trên hòa vốn toàn doanh nghiệp — vùng an toàn đàm phán' : '⚠️ Chưa gánh hết chi phí toàn doanh nghiệp'}
      </div>
      <div className="mt-3 text-eyebrow font-semibold uppercase tracking-[.06em] text-faint">Sàn đàm phán (thang giá 5 bậc)</div>
      <LadderRows line={line} />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          ['Sản lượng cả năm', `${fmtVnd(line.annualProductionKg)} kg`],
          ['Giờ máy cả năm', `${fmtVnd(line.annualMachineHours)} giờ`],
          ['Hòa vốn tại giá này', Number.isFinite(line.breakEvenPctOfCapacity) ? `${fmt1(line.breakEvenPctOfCapacity)}% CS` : '—'],
          ['Lãi gộp cả năm', fmtTy(line.annualGrossProfitVnd)],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[9px] text-faint">{k}</div>
            <div className="text-xs font-bold tabular-nums text-foreground">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function CeoPlannerScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const pipeMaterials = useMemo(() => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'pipe' && p.materialId === m.id)) : []), [scenario]);
  const fittingMaterials = useMemo(() => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'fitting' && p.materialId === m.id)) : []), [scenario]);

  const [brandIdx, setBrandIdx] = useState(0);
  const pipeMat = pipeMaterials[brandIdx] ?? pipeMaterials[0];
  const fitMat = fittingMaterials[brandIdx] ?? fittingMaterials[0];

  const [marginMode, setMarginMode] = useState<MarginMode>('markup_on_cost');
  const [pipeUsd, setPipeUsd] = useState('');
  const [fitUsd, setFitUsd] = useState('');
  const [pipeMargin, setPipeMargin] = useState('');
  const [fitMargin, setFitMargin] = useState('');
  const [pipeShifts, setPipeShifts] = useState<1 | 2 | 3>(3);
  const [fitShifts, setFitShifts] = useState<1 | 2 | 3>(1);
  const [fitUtil, setFitUtil] = useState(0.6);
  const [fxRate, setFxRate] = useState('');
  const [lease, setLease] = useState(''); // triệu đ/năm
  const [result, setResult] = useState<CeoPlannerResult | null>(null);
  const [advice, setAdvice] = useState<CeoAdviceResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Giá trị mặc định theo scenario (nạp 1 lần khi có material).
  const defaults = useMemo(() => {
    if (!scenario || !pipeMat || !fitMat) return null;
    return {
      pipeUsd: pipeMat.inventory.replacementPriceUsdPerKg,
      fitUsd: fitMat.inventory.replacementPriceUsdPerKg,
      pipeMargin: pipeMat.markupVf * 100,
      fitMargin: fitMat.markupVf * 100,
      fx: scenario.costPool.currency.usdVndRate,
      lease: scenario.costPool.sharedFixedCosts.annualLandRent / 1e6,
    };
  }, [scenario, pipeMat, fitMat]);

  const num = (s: string, dflt: number) => (s.trim() === '' ? dflt : parseFloat(s) || 0);

  const run = () => {
    if (!scenario || !pipeMat || !fitMat || !defaults) return;
    try {
      const request: CeoPlannerRequest = {
        scenarioId: scenario.id,
        marginMode,
        fxRateUsdVnd: num(fxRate, defaults.fx),
        annualPremiseLeaseVnd: Math.round(num(lease, defaults.lease) * 1e6),
        pipe: { materialId: pipeMat.id, compoundPriceUsdPerKg: num(pipeUsd, defaults.pipeUsd), desiredMargin: num(pipeMargin, defaults.pipeMargin) / 100, normalShifts: pipeShifts },
        fitting: { materialId: fitMat.id, compoundPriceUsdPerKg: num(fitUsd, defaults.fitUsd), desiredMargin: num(fitMargin, defaults.fitMargin) / 100, normalShifts: fitShifts, machineHourUtilization: fitUtil },
      };
      setResult(calculateCeoPlanner(request, scenario));
      setAdvice(null);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const askAi = async () => {
    if (!result) return;
    setAiLoading(true);
    try {
      const callable = httpsCallable<{ scenarioId: string; plannerResult: CeoPlannerResult }, CeoAdviceResult>(functions, 'adviseScenario');
      const res = await callable({ scenarioId: result.request.scenarioId, plannerResult: result });
      setAdvice(res.data);
    } catch {
      // Fallback: mock cục bộ (ADR-022 §5) — nút không bao giờ chết.
      setAdvice(generateCeoAdviceMock(result));
    } finally {
      setAiLoading(false);
    }
  };

  if (!scenario) return <div className="px-9 py-8 text-xs text-muted-foreground">Đang tải kịch bản…</div>;
  if (!pipeMat || !fitMat || !defaults) return <div className="px-9 py-8 text-xs text-muted-foreground">Scenario chưa đủ nguyên liệu 2 dòng.</div>;

  return (
    <div className="mx-auto max-w-[1200px] px-9 py-8">
      <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Trợ Lý CEO</div>
      <h1 className="mb-0.5 mt-1 text-2xl font-bold tracking-tight text-foreground">Giá Bán & Hiệu Quả Cả Năm</h1>
      <p className="text-xs text-muted-foreground">Nhập giá nguyên liệu + markup mong muốn → giá bán, sàn đàm phán, hiệu quả khi chạy tối đa công suất.</p>

      {/* ── BƯỚC 1 ── */}
      <Card className="mt-4 p-5">
        <div className="mb-3.5 text-eyebrow font-semibold uppercase tracking-[.1em] text-faint">Bước 1 — Câu hỏi của bạn</div>
        <div className="mb-4 flex flex-wrap items-center gap-6">
          {pipeMaterials.length > 1 && (
            <Field label="Dòng sản phẩm">
              <Seg options={pipeMaterials.map((m, i) => ({ v: i, label: m.name.replace(/\s*\(.*\)/, '') }))} value={brandIdx} onChange={(i) => { setBrandIdx(i); setPipeUsd(''); setFitUsd(''); }} />
            </Field>
          )}
          <Field label="Cách tính margin">
            <Seg options={[{ v: 'markup_on_cost' as MarginMode, label: 'Markup trên giá vốn' }, { v: 'margin_on_price' as MarginMode, label: 'Lãi trên giá bán' }]} value={marginMode} onChange={setMarginMode} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[
            { title: 'Ống CPVC (đùn liên tục)', usd: pipeUsd, setUsd: setPipeUsd, dUsd: defaults.pipeUsd, margin: pipeMargin, setMargin: setPipeMargin, dMargin: defaults.pipeMargin, shifts: pipeShifts, setShifts: setPipeShifts, isFit: false },
            { title: 'Phụ kiện (ép phun)', usd: fitUsd, setUsd: setFitUsd, dUsd: defaults.fitUsd, margin: fitMargin, setMargin: setFitMargin, dMargin: defaults.fitMargin, shifts: fitShifts, setShifts: setFitShifts, isFit: true },
          ].map((c) => (
            <div key={c.title} className="flex flex-col gap-3">
              <div className="text-xs font-bold text-foreground">{c.title}</div>
              <Field label="Giá compound (USD/kg, CIF trước thuế NK)"><Input className="text-right tabular-nums" value={c.usd} placeholder={fmtUsd(c.dUsd)} onChange={(e) => c.setUsd(e.target.value)} /></Field>
              <Field label="Markup mong muốn (%)"><Input className="text-right tabular-nums" value={c.margin} placeholder={fmt1(c.dMargin)} onChange={(e) => c.setMargin(e.target.value)} /></Field>
              <Field label="Số ca chạy / ngày"><Seg options={[1, 2, 3].map((v) => ({ v: v as 1 | 2 | 3, label: `${v} ca` }))} value={c.shifts} onChange={c.setShifts} /></Field>
              {c.isFit && <Field label="Huy động giờ máy ép"><Seg options={[{ v: 0.6, label: '60%' }, { v: 0.85, label: '85%' }]} value={fitUtil} onChange={setFitUtil} /></Field>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <Field label="Tỷ giá USD/VND"><Input className="w-[140px] text-right tabular-nums" value={fxRate} placeholder={fmtVnd(defaults.fx)} onChange={(e) => setFxRate(e.target.value)} /></Field>
          <Field label="Thuê mặt bằng (triệu đ/năm)" hint="Mô hình đi thuê, đổi được từng năm (ADR-021)"><Input className="w-[140px] text-right tabular-nums" value={lease} placeholder={fmt1(defaults.lease)} onChange={(e) => setLease(e.target.value)} /></Field>
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={run}>▶ Chạy số liệu</Button>
        {err && <div className="mt-2.5 text-[11px] text-destructive">Lỗi tính: {err}</div>}
      </Card>

      {/* ── BƯỚC 2 ── */}
      {result && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <LineCard line={result.pipe} />
            <LineCard line={result.fitting} />
          </div>
          <div className="mt-4 rounded-lg bg-primary p-[18px] text-primary-foreground">
            <div className="mb-3 text-[13px] font-bold">Hiệu quả toàn nhà máy cả năm với giá bán này</div>
            <div className="grid grid-cols-6 gap-3">
              {[
                ['Doanh thu VF', fmtTy(result.summary.revenueVfVnd)],
                ['Lãi gộp', fmtTy(result.summary.grossProfitVnd)],
                ['Lợi nhuận trước thuế', fmtTy(result.summary.preTaxProfitVnd)],
                ['Lợi nhuận sau thuế', fmtTy(result.summary.netProfitVnd)],
                ['Tỷ suất lợi nhuận', `${fmt1(result.summary.preTaxProfitMarginPct)}%`],
                ['Thu hồi vốn', result.summary.paybackYears === null ? '—' : `${fmt1(result.summary.paybackYears)} năm`],
              ].map(([k, v], i) => (
                <div key={k} className="rounded-md bg-primary-foreground/10 p-3">
                  <div className="text-[9px] text-primary-foreground/60">{k}</div>
                  <div className={cn('text-base font-bold tabular-nums', i >= 2 && i <= 4 && result.summary.preTaxProfitVnd < 0 ? 'text-destructive' : 'text-primary-foreground')}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 text-[10px] text-primary-foreground/60">Nhu cầu compound cả năm: ống {fmtVnd(result.pipe.compoundNeedKgPerYear)} kg · phụ kiện {fmtVnd(result.fitting.compoundNeedKgPerYear)} kg (hao hụt). Thuế TNDN 20% (ước tính). Vốn đầu tư {fmtTy(result.summary.totalInvestedVnd)}.</div>
          </div>

          {/* Bảng giá DN + SKU */}
          <details className="mt-3.5 rounded-lg border bg-card p-3.5">
            <summary className="cursor-pointer text-xs font-bold text-foreground">Bảng giá bán VF — ống {result.pipe.materialName} theo DN (đ/m) · mang đi đàm phán</summary>
            <Table className="mt-2.5 text-xs">
              <TableHeader><TableRow><TableHead>DN</TableHead><TableHead>Khối lượng</TableHead><TableHead className="text-right">Giá thành /m</TableHead><TableHead className="text-right">Giá bán VF /m</TableHead></TableRow></TableHeader>
              <TableBody>{result.pipeDnPrices.map((r) => <TableRow key={r.dn}><TableCell>{r.dn}</TableCell><TableCell>{fmt1(r.unitWeightKgPerM)} kg/m</TableCell><TableCell className="text-right tabular-nums">{fmtVnd(r.fullCostVndPerM)}</TableCell><TableCell className="text-right font-bold tabular-nums">{fmtVnd(r.sellingPriceVndPerM)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </details>
          <details className="mt-2.5 rounded-lg border bg-card p-3.5">
            <summary className="cursor-pointer text-xs font-bold text-foreground">Bảng giá bán VF — {result.fittingSkuPrices.length} phụ kiện {result.fitting.materialName} theo cái</summary>
            <div className="mt-2.5 max-h-80 overflow-auto">
              <Table className="text-xs">
                <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Size</TableHead><TableHead>SCH</TableHead><TableHead className="text-right">Kg/cái</TableHead><TableHead className="text-right">Ren KL /cái</TableHead><TableHead className="text-right">Giá thành /cái</TableHead><TableHead className="text-right">Giá bán VF /cái</TableHead></TableRow></TableHeader>
                <TableBody>{result.fittingSkuPrices.map((r, i) => <TableRow key={i}><TableCell>{r.productName}{r.metalInsertVndPerPiece > 0 ? <span className="text-[9px] text-faint"> (ren)</span> : ''}</TableCell><TableCell>{r.sizeLabel}</TableCell><TableCell>{r.schedule}</TableCell><TableCell className="text-right tabular-nums">{fmt1(r.unitWeightKg)}</TableCell><TableCell className="text-right tabular-nums">{r.metalInsertVndPerPiece > 0 ? fmtVnd(r.metalInsertVndPerPiece) : '—'}</TableCell><TableCell className="text-right tabular-nums">{fmtVnd(r.fullCostVndPerPiece)}</TableCell><TableCell className="text-right font-bold tabular-nums">{fmtVnd(r.sellingPriceVndPerPiece)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </details>

          {/* ── BƯỚC 3 — AI ── */}
          <Card className="mt-4 p-5">
            <div className="mb-2.5 text-eyebrow font-semibold uppercase tracking-[.1em] text-faint">Bước 3 — Hỏi ý kiến AI</div>
            <Button onClick={() => void askAi()} disabled={aiLoading}>
              {aiLoading ? '🤖 AI đang đọc số liệu…' : advice ? '🤖 AI tư vấn lại' : '🤖 AI tư vấn ngay'}
            </Button>
            {advice && (
              <div className="mt-3.5">
                <div className="text-[13px] font-bold text-foreground">🤖 Nhận định của trợ lý AI {advice.generatedByModel === 'mock' ? '(mock)' : `(${advice.generatedByModel})`}</div>
                <ul className="mt-2 list-disc pl-5 text-xs leading-relaxed text-foreground">{advice.items.map((it, i) => <li key={i} className="mb-1.5">{it.message}</li>)}</ul>
                {advice.disclaimer && <div className="rounded-md bg-warning-tint px-3 py-2 text-[10px] text-warning">⚠ {advice.disclaimer}</div>}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
