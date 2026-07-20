// Pha 3 (ADR-021) — màn "Trợ Lý CEO" gắn vào view CEO (ADR-020). 3 bước: nhập →
// chạy số (engine ceo-planner client-side, KHÔNG chép công thức) → AI tư vấn
// (callable adviseScenario, fallback mock cục bộ). Dựng theo prototype đã duyệt
// Pha 1 (prototype/ceo-planner.html), số liệu THẬT từ scenario.
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc } from 'firebase/firestore';
import { functions, db, type AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import type { CeoPlannerRequest, CeoPlannerResult, CeoAdviceResult, MarginMode, CeoLineResult } from '../../schemas/ceo-planner.js';
import { calculateCeoPlanner } from '../../engine/ceo-planner.js';
import { generateCeoAdviceMock } from '../../engine/ceo-advice-mock.js';
import { writePriceLockAuditEntry } from '../../lib/priceLockAudit.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);
const TIER = [
  { key: 'variableCostFloor', label: '1 · Sàn biến phí — RANH ĐỎ', color: '#DC2626' },
  { key: 'cashBreakEven', label: '2 · Hòa vốn tiền mặt', color: '#ea7317' },
  { key: 'fullCost', label: '3 · Giá thành đầy đủ (giá vốn)', color: '#ca9a04' },
  { key: 'enterpriseBreakEven', label: '4 · Hòa vốn toàn doanh nghiệp', color: '#0e7490' },
  { key: 'targetVf', label: '5 · Giá mục tiêu markup chuẩn VF', color: '#16A34A' },
] as const;

function Seg<T extends string | number | boolean>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
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

export default function CeoPlannerScreen({
  scenario,
  role,
  user,
}: {
  scenario: ScenarioInput | null;
  /** ADR-041 — vai để gác nút "Áp dụng vào thật" (chỉ admin/pricing được ghi). */
  role?: AppRole;
  /** ADR-041 — ai áp dụng baseline mới, ghi vào priceLockAudit. */
  user?: { uid: string; email: string | null } | null;
}) {
  const pipeMaterials = useMemo(() => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'pipe' && p.materialId === m.id)) : []), [scenario]);
  const fittingMaterials = useMemo(() => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'fitting' && p.materialId === m.id)) : []), [scenario]);

  // ADR-043 — MÔ HÌNH THEO MÁY: số ca/huy động thuộc về MÁY (một lần/dòng, dùng
  // chung cho mọi compound chạy trên nó); compound chọn ĐỘC LẬP cho máy đùn và
  // máy ép (bỏ ép thẳng hàng brandIdx cũ vốn gây lệch khi số compound 2 dòng khác
  // nhau). Mỗi máy chạy 1 hoặc 2 compound; 2 compound = CHIA thời gian máy (%).
  const [marginMode, setMarginMode] = useState<MarginMode>('markup_on_cost');
  // Compound chọn theo MÁY (A = chính, B = thứ hai). '' = mặc định phần tử đầu.
  const [pipeAId, setPipeAId] = useState('');
  const [pipeBId, setPipeBId] = useState('');
  const [fitAId, setFitAId] = useState('');
  const [fitBId, setFitBId] = useState('');
  const [pipeTwo, setPipeTwo] = useState(false); // máy đùn chạy 2 compound?
  const [fitTwo, setFitTwo] = useState(false); // máy ép chạy 2 compound?
  // Giá compound (USD/kg) + markup (%) NHẬP TAY từng compound (rỗng = mặc định của nó).
  const [pipeUsdA, setPipeUsdA] = useState(''); const [pipeMarginA, setPipeMarginA] = useState('');
  const [pipeUsdB, setPipeUsdB] = useState(''); const [pipeMarginB, setPipeMarginB] = useState('');
  const [fitUsdA, setFitUsdA] = useState(''); const [fitMarginA, setFitMarginA] = useState('');
  const [fitUsdB, setFitUsdB] = useState(''); const [fitMarginB, setFitMarginB] = useState('');
  // Thuộc tính MÁY (dùng chung cả 2 compound trên máy đó).
  const [pipeShifts, setPipeShifts] = useState<1 | 2 | 3>(3);
  const [fitShifts, setFitShifts] = useState<1 | 2 | 3>(1);
  const [fitUtil, setFitUtil] = useState(0.6);
  // % THỜI GIAN máy dành cho compound A (còn lại cho B). Chỉ dùng khi máy chạy 2 compound.
  const [allocPipe, setAllocPipe] = useState(60);
  const [allocFit, setAllocFit] = useState(60);
  const [fxRate, setFxRate] = useState('');
  const [lease, setLease] = useState(''); // triệu đ/năm
  const [result, setResult] = useState<CeoPlannerResult | null>(null);
  const [advice, setAdvice] = useState<CeoAdviceResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Compound đang chọn từng máy (fallback: phần tử đầu / phần tử khác A).
  const pipeA = pipeMaterials.find((m) => m.id === pipeAId) ?? pipeMaterials[0];
  const pipeB = pipeMaterials.find((m) => m.id === pipeBId) ?? pipeMaterials.find((m) => m.id !== pipeA?.id);
  const fitA = fittingMaterials.find((m) => m.id === fitAId) ?? fittingMaterials[0];
  const fitB = fittingMaterials.find((m) => m.id === fitBId) ?? fittingMaterials.find((m) => m.id !== fitA?.id);
  const canTwoPipe = pipeMaterials.length >= 2; // đủ ≥2 compound mới chạy 2 loại được
  const canTwoFit = fittingMaterials.length >= 2;
  const fxDefault = scenario ? scenario.costPool.currency.usdVndRate : 0;
  const leaseDefault = scenario ? scenario.costPool.sharedFixedCosts.annualLandRent / 1e6 : 0;

  const num = (s: string, dflt: number) => (s.trim() === '' ? dflt : parseFloat(s) || 0);

  const run = (ov?: { allocPipe?: number; allocFit?: number }) => {
    if (!scenario || !pipeA || !fitA) return;
    const aPipe = ov?.allocPipe ?? allocPipe;
    const aFit = ov?.allocFit ?? allocFit;
    const usePipeTwo = pipeTwo && canTwoPipe && !!pipeB && pipeB.id !== pipeA.id;
    const useFitTwo = fitTwo && canTwoFit && !!fitB && fitB.id !== fitA.id;
    try {
      const request: CeoPlannerRequest = {
        scenarioId: scenario.id,
        marginMode,
        fxRateUsdVnd: num(fxRate, fxDefault),
        annualPremiseLeaseVnd: Math.round(num(lease, leaseDefault) * 1e6),
        // Số ca/huy động = thuộc tính MÁY (chung); compound A = chính.
        pipe: { materialId: pipeA.id, compoundPriceUsdPerKg: num(pipeUsdA, pipeA.inventory.replacementPriceUsdPerKg), desiredMargin: num(pipeMarginA, pipeA.markupVf * 100) / 100, normalShifts: pipeShifts },
        fitting: { materialId: fitA.id, compoundPriceUsdPerKg: num(fitUsdA, fitA.inventory.replacementPriceUsdPerKg), desiredMargin: num(fitMarginA, fitA.markupVf * 100) / 100, normalShifts: fitShifts, machineHourUtilization: fitUtil },
        // ADR-043 — compound thứ hai TRÊN CÙNG MÁY (độc lập ống/phụ kiện), giá +
        // markup nhập tay; % = chia thời gian máy. Máy chạy 1 compound ⇒ bỏ qua.
        ...(usePipeTwo
          ? { pipeSecond: { materialId: pipeB!.id, compoundPriceUsdPerKg: num(pipeUsdB, pipeB!.inventory.replacementPriceUsdPerKg), desiredMargin: num(pipeMarginB, pipeB!.markupVf * 100) / 100 }, allocationPipePrimaryPct: aPipe }
          : {}),
        ...(useFitTwo
          ? { fittingSecond: { materialId: fitB!.id, compoundPriceUsdPerKg: num(fitUsdB, fitB!.inventory.replacementPriceUsdPerKg), desiredMargin: num(fitMarginB, fitB!.markupVf * 100) / 100 }, allocationFittingPrimaryPct: aFit }
          : {}),
      };
      setResult(calculateCeoPlanner(request, scenario));
      setAdvice(null);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // ADR-042/043 — Gợi ý tối ưu (mỗi máy độc lập): lợi nhuận cực đại khi dồn 100%
  // thời gian máy vào compound có biên đóng góp/kg (giá bán − sàn biến phí) cao
  // hơn. Đặt slider về nghiệm góc rồi chạy lại. (Thực tế còn tùy cầu thị trường.)
  const optimize = () => {
    if (!result) return;
    const cm = (l: CeoLineResult) => l.sellingPriceVndPerKg - l.ladder.variableCostFloor;
    const newPipe = result.pipeSecond ? (cm(result.pipe) >= cm(result.pipeSecond) ? 100 : 0) : allocPipe;
    const newFit = result.fittingSecond ? (cm(result.fitting) >= cm(result.fittingSecond) ? 100 : 0) : allocFit;
    setAllocPipe(newPipe);
    setAllocFit(newFit);
    run({ allocPipe: newPipe, allocFit: newFit });
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

  // ADR-041 — CẦU NỐI giả định → thật. Chỉ ghi GIÁ COMPOUND + MARKUP (theo lựa
  // chọn: số ca/tỷ lệ máy KHÔNG đổi). markup thật = markupVf (markup trên giá
  // vốn); quy đổi từ desiredMargin theo marginMode: margin_on_price → m/(1−m).
  const canApply = role === 'admin' || role === 'pricing';
  const markupVfFromReq = (m: number, mode: MarginMode) => (mode === 'markup_on_cost' ? m : m / (1 - m));
  const [applyState, setApplyState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const applyPlan = result
    ? [result.request.pipe, result.request.fitting].map((line) => ({
        id: line.materialId,
        mat: scenario?.materials.find((x) => x.id === line.materialId) ?? null,
        newPrice: line.compoundPriceUsdPerKg,
        newMarkup: markupVfFromReq(line.desiredMargin, result.request.marginMode),
      }))
    : [];
  const applyToReal = async () => {
    if (!result || !scenario || !canApply) return;
    const lines = applyPlan
      .filter((c) => c.mat)
      .map((c) => `• ${c.mat!.name}: giá ${fmtUsd(c.mat!.inventory.replacementPriceUsdPerKg)} → ${fmtUsd(c.newPrice)}/kg · markup ${Math.round(c.mat!.markupVf * 100)}% → ${Math.round(c.newMarkup * 100)}%`)
      .join('\n');
    if (!window.confirm(`GHI VÀO DỮ LIỆU THẬT? Mọi màn (Bảng Giá, Tổng Quan…) sẽ tính lại theo.\n\n${lines}\n\nSố ca & tỷ lệ dùng máy KHÔNG đổi. Bấm OK để áp dụng.`)) return;
    setApplyState('saving');
    setApplyErr(null);
    try {
      const materials = scenario.materials.map((m) => {
        const c = applyPlan.find((x) => x.id === m.id);
        if (!c) return m;
        // Ghi giá tái tạo + KHÓA baseline tại giá vừa áp (commit ở giá đã thử) + markup.
        return { ...m, markupVf: c.newMarkup, inventory: { ...m.inventory, replacementPriceUsdPerKg: c.newPrice, priceLock: { ...m.inventory.priceLock, baseline: c.newPrice } } };
      });
      const parsed = ScenarioInputSchema.safeParse({ ...scenario, materials });
      if (!parsed.success) {
        setApplyState('error');
        setApplyErr(`Dữ liệu không hợp lệ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}`);
        return;
      }
      await setDoc(doc(db, `scenarios/${scenario.id}`), parsed.data);
      if (user && (role === 'admin' || role === 'pricing')) {
        await Promise.all(
          applyPlan.flatMap((c) =>
            c.mat && c.mat.inventory.priceLock.baseline !== c.newPrice
              ? [writePriceLockAuditEntry(scenario.id, { materialId: c.id, materialName: c.mat.name, oldBaselineUsdPerKg: c.mat.inventory.priceLock.baseline, newBaselineUsdPerKg: c.newPrice, changedByUid: user.uid, changedByEmail: user.email, changedByRole: role })]
              : [],
          ),
        );
      }
      setApplyState('saved');
      setTimeout(() => setApplyState('idle'), 3500);
    } catch (e) {
      setApplyState('error');
      setApplyErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (!scenario) return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  if (!pipeA || !fitA) return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Scenario chưa đủ nguyên liệu 2 dòng.</div>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const selStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#fff' };
  const short = (n: string) => n.replace(/\s*\(.*\)/, '');

  // ADR-043 — cấu hình 2 MÁY (đùn ống · ép phụ kiện). Số ca/huy động thuộc MÁY;
  // compound A/B chọn độc lập; giá+markup nhập tay cả 2; % = chia thời gian máy.
  type MachineCfg = {
    key: 'pipe' | 'fit'; title: string; note: string; mats: typeof pipeMaterials; canTwo: boolean;
    aId: string; setA: (v: string) => void; bMat?: (typeof pipeMaterials)[number]; bId: string; setB: (v: string) => void;
    two: boolean; setTwo: (v: boolean) => void; matA: (typeof pipeMaterials)[number];
    usdA: string; setUsdA: (v: string) => void; marginA: string; setMarginA: (v: string) => void;
    usdB: string; setUsdB: (v: string) => void; marginB: string; setMarginB: (v: string) => void;
    shifts: 1 | 2 | 3; setShifts: (v: 1 | 2 | 3) => void; alloc: number; setAlloc: (v: number) => void;
  };
  const machines: MachineCfg[] = [
    { key: 'pipe', title: 'Máy đùn ống', note: '1 máy · đùn liên tục', mats: pipeMaterials, canTwo: canTwoPipe, aId: pipeA.id, setA: setPipeAId, bMat: pipeB, bId: pipeB?.id ?? '', setB: setPipeBId, two: pipeTwo, setTwo: setPipeTwo, matA: pipeA, usdA: pipeUsdA, setUsdA: setPipeUsdA, marginA: pipeMarginA, setMarginA: setPipeMarginA, usdB: pipeUsdB, setUsdB: setPipeUsdB, marginB: pipeMarginB, setMarginB: setPipeMarginB, shifts: pipeShifts, setShifts: setPipeShifts, alloc: allocPipe, setAlloc: setAllocPipe },
    { key: 'fit', title: 'Máy ép phụ kiện', note: '2 máy · ép phun', mats: fittingMaterials, canTwo: canTwoFit, aId: fitA.id, setA: setFitAId, bMat: fitB, bId: fitB?.id ?? '', setB: setFitBId, two: fitTwo, setTwo: setFitTwo, matA: fitA, usdA: fitUsdA, setUsdA: setFitUsdA, marginA: fitMarginA, setMarginA: setFitMarginA, usdB: fitUsdB, setUsdB: setFitUsdB, marginB: fitMarginB, setMarginB: setFitMarginB, shifts: fitShifts, setShifts: setFitShifts, alloc: allocFit, setAlloc: setAllocFit },
  ];
  const anyTwo = (pipeTwo && canTwoPipe) || (fitTwo && canTwoFit);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Trợ Lý CEO</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Giá Bán & Hiệu Quả Cả Năm</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>Cấu hình <b>theo MÁY</b>: số ca là của máy (dùng chung), mỗi máy chạy <b>1</b> hay <b>2 compound</b> (chia thời gian máy — không cộng dồn vượt trần). Máy đùn ống và máy ép phụ kiện chọn compound độc lập.</p>

      {/* ── BƯỚC 1 — theo MÁY (ADR-043) ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: 18, marginTop: 18 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#a8003b', textTransform: 'uppercase' }}>Bước 1 — Câu hỏi của bạn</div>
          <Field label="Cách tính margin">
            <Seg options={[{ v: 'markup_on_cost' as MarginMode, label: 'Markup trên giá vốn' }, { v: 'margin_on_price' as MarginMode, label: 'Lãi trên giá bán' }]} value={marginMode} onChange={setMarginMode} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {machines.map((m) => (
            <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #ece8dc', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>🏭 {m.title} <span style={{ fontWeight: 400, color: '#999', fontSize: 10 }}>({m.note})</span></div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Field label="Số ca / ngày (của máy)"><Seg options={[1, 2, 3].map((v) => ({ v: v as 1 | 2 | 3, label: `${v} ca` }))} value={m.shifts} onChange={m.setShifts} /></Field>
                {m.key === 'fit' && <Field label="Huy động giờ máy (của máy)"><Seg options={[{ v: 0.6, label: '60%' }, { v: 0.85, label: '85%' }]} value={fitUtil} onChange={setFitUtil} /></Field>}
              </div>
              {m.canTwo && (
                <Field label="Compound chạy trên máy" hint="2 compound = chia thời gian máy, tổng = 100%">
                  <Seg options={[{ v: false, label: '1 compound' }, { v: true, label: '2 compound' }]} value={m.two} onChange={m.setTwo} />
                </Field>
              )}

              {/* Compound A (chính) */}
              <div style={{ border: '1px solid #f0c4d3', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 9, color: '#a8003b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{m.two && m.canTwo ? 'Compound A' : 'Compound chạy'}</div>
                <select style={selStyle} value={m.aId} onChange={(e) => m.setA(e.target.value)}>
                  {m.mats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <Field label="Giá USD/kg"><input style={inputStyle} value={m.usdA} placeholder={fmtUsd(m.matA.inventory.replacementPriceUsdPerKg)} onChange={(e) => m.setUsdA(e.target.value)} /></Field>
                  <Field label="Markup %"><input style={inputStyle} value={m.marginA} placeholder={fmt1(m.matA.markupVf * 100)} onChange={(e) => m.setMarginA(e.target.value)} /></Field>
                </div>
              </div>

              {/* Compound B (thứ hai) + phân bổ thời gian máy */}
              {m.two && m.canTwo && m.bMat && (
                <>
                  <div style={{ border: '1px solid #bcd3f5', borderRadius: 6, padding: 10, background: '#f7faff' }}>
                    <div style={{ fontSize: 9, color: '#1f5fd0', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Compound B</div>
                    <select style={selStyle} value={m.bId} onChange={(e) => m.setB(e.target.value)}>
                      {m.mats.filter((x) => x.id !== m.aId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <Field label="Giá USD/kg"><input style={inputStyle} value={m.usdB} placeholder={fmtUsd(m.bMat.inventory.replacementPriceUsdPerKg)} onChange={(e) => m.setUsdB(e.target.value)} /></Field>
                      <Field label="Markup %"><input style={inputStyle} value={m.marginB} placeholder={fmt1(m.bMat.markupVf * 100)} onChange={(e) => m.setMarginB(e.target.value)} /></Field>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Chia thời gian máy</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <b style={{ color: '#a8003b' }}>{short(m.matA.name)} {m.alloc}%</b>{'  ·  '}<b style={{ color: '#1f5fd0' }}>{short(m.bMat.name)} {100 - m.alloc}%</b>
                      </span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={m.alloc} onChange={(e) => m.setAlloc(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
          <Field label="Tỷ giá USD/VND"><input style={{ ...inputStyle, width: 140 }} value={fxRate} placeholder={fmtVnd(fxDefault)} onChange={(e) => setFxRate(e.target.value)} /></Field>
          <Field label="Thuê mặt bằng (triệu đ/năm)" hint="Mô hình đi thuê, đổi được từng năm (ADR-021)"><input style={{ ...inputStyle, width: 140 }} value={lease} placeholder={fmt1(leaseDefault)} onChange={(e) => setLease(e.target.value)} /></Field>
          {anyTwo && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button onClick={optimize} disabled={!result || (!result.pipeSecond && !result.fittingSecond)} title={result ? '' : 'Bấm Chạy số liệu trước để có dữ liệu so sánh biên lợi nhuận'} style={{ padding: '8px 14px', background: '#fff', color: '#1f5fd0', border: '1px solid #1f5fd0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: result ? 'pointer' : 'not-allowed', opacity: result ? 1 : 0.5 }}>
                💡 Gợi ý tối ưu (dồn về compound biên đóng góp/kg cao hơn)
              </button>
            </div>
          )}
        </div>
        <button onClick={() => run()} style={{ marginTop: 18, width: '100%', padding: '12px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>▶ Chạy số liệu</button>
        {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 11 }}>Lỗi tính: {err}</div>}
      </div>

      {/* ── BƯỚC 2 ── */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {[result.pipe, result.pipeSecond, result.fitting, result.fittingSecond]
              .filter((l): l is CeoLineResult => l !== undefined)
              .map((l, i) => <LineCard key={`${l.line}-${l.materialId}-${i}`} line={l} />)}
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

          {/* ADR-041 — CẦU NỐI giả định → thật: đối chiếu rồi áp dụng (chỉ giá + markup). */}
          {canApply && (
            <div style={{ background: '#fff', border: '2px solid #a8003b', borderRadius: 6, padding: 18, marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#a8003b', textTransform: 'uppercase', marginBottom: 4 }}>Biến giả định thành thật</div>
              <div style={{ fontSize: 11, color: '#737373', marginBottom: 12 }}>
                Đối chiếu bộ số bạn vừa chốt với dữ liệu thật. Bấm áp dụng để <b>ghi giá compound + markup</b> vào Dữ liệu gốc — mọi màn Theo dõi &amp; Thử tính lại theo. Số ca &amp; tỷ lệ dùng máy <b>giữ nguyên</b>.
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#737373', fontSize: 10 }}>
                    <th style={{ padding: '4px 6px' }}>Nguyên liệu</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px' }}>Giá compound (thật → giả định)</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px' }}>Markup VF (thật → giả định)</th>
                  </tr>
                </thead>
                <tbody>
                  {applyPlan.filter((c) => c.mat).map((c) => {
                    const priceChanged = Math.abs(c.mat!.inventory.replacementPriceUsdPerKg - c.newPrice) > 1e-9;
                    const markupChanged = Math.abs(c.mat!.markupVf - c.newMarkup) > 1e-9;
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #f0ece0' }}>
                        <td style={{ padding: '6px', fontWeight: 600 }}>{c.mat!.name}</td>
                        <td style={{ textAlign: 'right', padding: '6px', fontVariantNumeric: 'tabular-nums', color: priceChanged ? '#a8003b' : '#737373', fontWeight: priceChanged ? 700 : 400 }}>
                          {fmtUsd(c.mat!.inventory.replacementPriceUsdPerKg)} → {fmtUsd(c.newPrice)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px', fontVariantNumeric: 'tabular-nums', color: markupChanged ? '#a8003b' : '#737373', fontWeight: markupChanged ? 700 : 400 }}>
                          {Math.round(c.mat!.markupVf * 100)}% → {Math.round(c.newMarkup * 100)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => void applyToReal()}
                  disabled={applyState === 'saving'}
                  style={{ padding: '10px 20px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: applyState === 'saving' ? 'default' : 'pointer', opacity: applyState === 'saving' ? 0.6 : 1 }}
                >
                  {applyState === 'saving' ? 'Đang ghi…' : 'Áp dụng vào dữ liệu thật →'}
                </button>
                {applyState === 'saved' && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>✓ Đã ghi — mọi màn đang tính lại</span>}
                {applyState === 'error' && <span style={{ fontSize: 12, color: '#DC2626' }}>{applyErr}</span>}
              </div>
            </div>
          )}

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
                <thead><tr style={{ textAlign: 'left', color: '#737373', fontSize: 10 }}><th>Tên</th><th>Size</th><th>SCH</th><th style={{ textAlign: 'right' }}>Kg/cái</th><th style={{ textAlign: 'right' }}>Ren KL /cái</th><th style={{ textAlign: 'right' }}>Giá thành /cái</th><th style={{ textAlign: 'right' }}>Giá bán VF /cái</th></tr></thead>
                <tbody>{result.fittingSkuPrices.map((r, i) => <tr key={i} style={{ borderTop: '1px solid #f0ece0' }}><td>{r.productName}{r.metalInsertVndPerPiece > 0 ? <span style={{ color: '#9333ea', fontSize: 9 }}> (ren)</span> : ''}</td><td>{r.sizeLabel}</td><td>{r.schedule}</td><td style={{ textAlign: 'right' }}>{fmt1(r.unitWeightKg)}</td><td style={{ textAlign: 'right' }}>{r.metalInsertVndPerPiece > 0 ? fmtVnd(r.metalInsertVndPerPiece) : '—'}</td><td style={{ textAlign: 'right' }}>{fmtVnd(r.fullCostVndPerPiece)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtVnd(r.sellingPriceVndPerPiece)}</td></tr>)}</tbody>
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
