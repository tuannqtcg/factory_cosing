// Pha 3 (ADR-021) — màn "Trợ Lý CEO" gắn vào view CEO (ADR-020). 3 bước: nhập →
// chạy số (engine ceo-planner client-side, KHÔNG chép công thức) → AI tư vấn
// (callable adviseScenario, fallback mock cục bộ). Dựng theo prototype đã duyệt
// Pha 1 (prototype/ceo-planner.html), số liệu THẬT từ scenario.
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { CeoPlannerRequest, CeoPlannerResult, CeoAdviceResult, MarginMode, CeoLineResult } from '../../schemas/ceo-planner.js';
import { calculateCeoPlanner } from '../../engine/ceo-planner.js';
import { generateCeoAdviceMock } from '../../engine/ceo-advice-mock.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);
const TIER = [
  { key: 'variableCostFloor', label: '1 · Sàn biến phí — RANH ĐỎ', color: '#DC2626' },
  { key: 'cashBreakEven', label: '2 · Hòa vốn tiền mặt', color: '#ea7317' },
  { key: 'fullCost', label: '3 · Giá thành đầy đủ (giá vốn)', color: '#ca9a04' },
  { key: 'enterpriseBreakEven', label: '4 · Hòa vốn toàn doanh nghiệp', color: '#0e7490' },
  { key: 'targetVf', label: '5 · Giá mục tiêu markup chuẩn VF', color: '#16A34A' },
] as const;

function Seg<T extends string | number>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #d8d8d8', borderRadius: 6, overflow: 'hidden' }}>
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: o.v === value ? '#1a1a1a' : '#fff', color: o.v === value ? '#fff' : '#555' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 9, color: '#737373', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function LadderRows({ line }: { line: CeoLineResult }) {
  const rows = [
    ...TIER.map((t) => ({ label: t.label, v: line.ladder[t.key], color: t.color, you: false })),
    { label: 'GIÁ CỦA BẠN', v: line.sellingPriceVndPerKg, color: '#1a1a1a', you: true },
  ].sort((a, b) => b.v - a.v);
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 3, background: r.you ? '#1a1a1a' : 'transparent', color: r.you ? '#fff' : '#1a1a1a', fontSize: 11, fontWeight: r.you ? 700 : 400 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
            {r.label}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(r.v)} đ/kg</span>
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
    <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {line.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'} · <span style={{ color: '#a8003b' }}>{line.materialName}</span> — giá bán VF đề xuất
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>
        {fmtVnd(line.sellingPriceVndPerKg)} <span style={{ fontSize: 13, color: '#737373' }}>đ/{line.line === 'pipe' ? 'kg' : 'kg (tham chiếu)'}</span>
      </div>
      <div style={{ fontSize: 11, color: '#555' }}>
        Giá thành <b>{fmtVnd(line.fullCostVndPerKg)}</b> = nguyên liệu <b>{fmtVnd(line.materialCostVndPerKg)}</b> + gia công <b>{fmtVnd(line.processingCostVndPerKg)}</b> + bao bì <b>{fmtVnd(line.packagingCostVndPerKg)}</b> · lãi gộp <b>{fmt1(line.marginOnPricePct)}%</b>
        {line.machineHourCostVnd !== undefined ? ` · chi phí 1 giờ máy ép ${fmtVnd(line.machineHourCostVnd)} đ` : ''}
      </div>
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: below1 ? '#fef2f2' : ok ? '#f0fdf4' : '#fffbeb', color: below1 ? '#DC2626' : ok ? '#16A34A' : '#b45309' }}>
        {below1 ? '⛔ Dưới sàn biến phí — lỗ tiền tươi từng kg' : ok ? '✅ Trên hòa vốn toàn doanh nghiệp — vùng an toàn đàm phán' : '⚠️ Chưa gánh hết chi phí toàn doanh nghiệp'}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginTop: 12 }}>Sàn đàm phán (thang giá 5 bậc)</div>
      <LadderRows line={line} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
        {[
          ['Sản lượng cả năm', `${fmtVnd(line.annualProductionKg)} kg`],
          ['Giờ máy cả năm', `${fmtVnd(line.annualMachineHours)} giờ`],
          ['Hòa vốn tại giá này', Number.isFinite(line.breakEvenPctOfCapacity) ? `${fmt1(line.breakEvenPctOfCapacity)}% CS` : '—'],
          ['Lãi gộp cả năm', fmtTy(line.annualGrossProfitVnd)],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 9, color: '#737373' }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
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

  if (!scenario) return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  if (!pipeMat || !fitMat || !defaults) return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Scenario chưa đủ nguyên liệu 2 dòng.</div>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Trợ Lý CEO</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Giá Bán & Hiệu Quả Cả Năm</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>Nhập giá nguyên liệu + markup mong muốn → giá bán, sàn đàm phán, hiệu quả khi chạy tối đa công suất.</p>

      {/* ── BƯỚC 1 ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: 18, marginTop: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#a8003b', textTransform: 'uppercase', marginBottom: 14 }}>Bước 1 — Câu hỏi của bạn</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {pipeMaterials.length > 1 && (
            <Field label="Dòng sản phẩm">
              <Seg options={pipeMaterials.map((m, i) => ({ v: i, label: m.name.replace(/\s*\(.*\)/, '') }))} value={brandIdx} onChange={(i) => { setBrandIdx(i); setPipeUsd(''); setFitUsd(''); }} />
            </Field>
          )}
          <Field label="Cách tính margin">
            <Seg options={[{ v: 'markup_on_cost' as MarginMode, label: 'Markup trên giá vốn' }, { v: 'margin_on_price' as MarginMode, label: 'Lãi trên giá bán' }]} value={marginMode} onChange={setMarginMode} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {[
            { title: 'Ống CPVC (đùn liên tục)', usd: pipeUsd, setUsd: setPipeUsd, dUsd: defaults.pipeUsd, margin: pipeMargin, setMargin: setPipeMargin, dMargin: defaults.pipeMargin, shifts: pipeShifts, setShifts: setPipeShifts, isFit: false },
            { title: 'Phụ kiện (ép phun)', usd: fitUsd, setUsd: setFitUsd, dUsd: defaults.fitUsd, margin: fitMargin, setMargin: setFitMargin, dMargin: defaults.fitMargin, shifts: fitShifts, setShifts: setFitShifts, isFit: true },
          ].map((c) => (
            <div key={c.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{c.title}</div>
              <Field label="Giá compound (USD/kg, CIF trước thuế NK)"><input style={inputStyle} value={c.usd} placeholder={fmtUsd(c.dUsd)} onChange={(e) => c.setUsd(e.target.value)} /></Field>
              <Field label="Markup mong muốn (%)"><input style={inputStyle} value={c.margin} placeholder={fmt1(c.dMargin)} onChange={(e) => c.setMargin(e.target.value)} /></Field>
              <Field label="Số ca chạy / ngày"><Seg options={[1, 2, 3].map((v) => ({ v: v as 1 | 2 | 3, label: `${v} ca` }))} value={c.shifts} onChange={c.setShifts} /></Field>
              {c.isFit && <Field label="Huy động giờ máy ép"><Seg options={[{ v: 0.6, label: '60%' }, { v: 0.85, label: '85%' }]} value={fitUtil} onChange={setFitUtil} /></Field>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
          <Field label="Tỷ giá USD/VND"><input style={{ ...inputStyle, width: 140 }} value={fxRate} placeholder={fmtVnd(defaults.fx)} onChange={(e) => setFxRate(e.target.value)} /></Field>
          <Field label="Thuê mặt bằng (triệu đ/năm)" hint="Mô hình đi thuê, đổi được từng năm (ADR-021)"><input style={{ ...inputStyle, width: 140 }} value={lease} placeholder={fmt1(defaults.lease)} onChange={(e) => setLease(e.target.value)} /></Field>
        </div>
        <button onClick={run} style={{ marginTop: 18, width: '100%', padding: '12px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>▶ Chạy số liệu</button>
        {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 11 }}>Lỗi tính: {err}</div>}
      </div>

      {/* ── BƯỚC 2 ── */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <LineCard line={result.pipe} />
            <LineCard line={result.fitting} />
          </div>
          <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: 18, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff5c8a', marginBottom: 12 }}>Hiệu quả toàn nhà máy cả năm với giá bán này</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
              {[
                ['Doanh thu VF', fmtTy(result.summary.revenueVfVnd)],
                ['Lãi gộp', fmtTy(result.summary.grossProfitVnd)],
                ['Lợi nhuận trước thuế', fmtTy(result.summary.preTaxProfitVnd)],
                ['Lợi nhuận sau thuế', fmtTy(result.summary.netProfitVnd)],
                ['Tỷ suất lợi nhuận', `${fmt1(result.summary.preTaxProfitMarginPct)}%`],
                ['Thu hồi vốn', result.summary.paybackYears === null ? '—' : `${fmt1(result.summary.paybackYears)} năm`],
              ].map(([k, v], i) => (
                <div key={k} style={{ background: '#262626', borderRadius: 4, padding: 12 }}>
                  <div style={{ fontSize: 9, color: '#999' }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: i >= 2 && i <= 4 && (result.summary.preTaxProfitVnd < 0) ? '#f87171' : '#fff', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 10 }}>Nhu cầu compound cả năm: ống {fmtVnd(result.pipe.compoundNeedKgPerYear)} kg · phụ kiện {fmtVnd(result.fitting.compoundNeedKgPerYear)} kg (hao hụt). Thuế TNDN 20% (ước tính). Vốn đầu tư {fmtTy(result.summary.totalInvestedVnd)}.</div>
          </div>

          {/* Bảng giá DN + SKU */}
          <details style={{ marginTop: 14, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Bảng giá bán VF — ống {result.pipe.materialName} theo DN (đ/m) · mang đi đàm phán</summary>
            <table style={{ width: '100%', marginTop: 10, fontSize: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#737373', fontSize: 10 }}><th>DN</th><th>Khối lượng</th><th style={{ textAlign: 'right' }}>Giá thành /m</th><th style={{ textAlign: 'right' }}>Giá bán VF /m</th></tr></thead>
              <tbody>{result.pipeDnPrices.map((r) => <tr key={r.dn} style={{ borderTop: '1px solid #f0ece0' }}><td>{r.dn}</td><td>{fmt1(r.unitWeightKgPerM)} kg/m</td><td style={{ textAlign: 'right' }}>{fmtVnd(r.fullCostVndPerM)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtVnd(r.sellingPriceVndPerM)}</td></tr>)}</tbody>
            </table>
          </details>
          <details style={{ marginTop: 10, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Bảng giá bán VF — {result.fittingSkuPrices.length} phụ kiện {result.fitting.materialName} theo cái</summary>
            <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: '#737373', fontSize: 10 }}><th>Tên</th><th>Size</th><th>SCH</th><th style={{ textAlign: 'right' }}>Kg/cái</th><th style={{ textAlign: 'right' }}>Giá thành /cái</th><th style={{ textAlign: 'right' }}>Giá bán VF /cái</th></tr></thead>
                <tbody>{result.fittingSkuPrices.map((r, i) => <tr key={i} style={{ borderTop: '1px solid #f0ece0' }}><td>{r.productName}</td><td>{r.sizeLabel}</td><td>{r.schedule}</td><td style={{ textAlign: 'right' }}>{fmt1(r.unitWeightKg)}</td><td style={{ textAlign: 'right' }}>{fmtVnd(r.fullCostVndPerPiece)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtVnd(r.sellingPriceVndPerPiece)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>

          {/* ── BƯỚC 3 — AI ── */}
          <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: 18, marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#a8003b', textTransform: 'uppercase', marginBottom: 10 }}>Bước 3 — Hỏi ý kiến AI</div>
            <button onClick={() => void askAi()} disabled={aiLoading} style={{ padding: '10px 18px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? '🤖 AI đang đọc số liệu…' : advice ? '🤖 AI tư vấn lại' : '🤖 AI tư vấn ngay'}
            </button>
            {advice && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🤖 Nhận định của trợ lý AI {advice.generatedByModel === 'mock' ? '(mock)' : `(${advice.generatedByModel})`}</div>
                <ul style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>{advice.items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it.message}</li>)}</ul>
                {advice.disclaimer && <div style={{ fontSize: 10, color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: 4 }}>⚠ {advice.disclaimer}</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
