// Pha 3 (ADR-021) — màn "Trợ Lý CEO" gắn vào view CEO (ADR-020). 3 bước: nhập →
// chạy số (engine ceo-planner client-side, KHÔNG chép công thức) → AI tư vấn
// (callable adviseScenario, fallback mock cục bộ). Dựng theo prototype đã duyệt
// Pha 1 (prototype/ceo-planner.html), số liệu THẬT từ scenario.
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản). Thang giá
// 5 bậc giữ dải màu (dữ liệu hợp lệ, ánh xạ về token success/warning/danger ở
// 2 đầu); compound A/B phân biệt bằng nhãn thay vì màu hue riêng.
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
import CeoReverseTools from './CeoReverseTools.js';
import { Screen, Card, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);
const TIER = [
  { key: 'variableCostFloor', label: '1 · Sàn biến phí — RANH ĐỎ', color: tk.danger },
  { key: 'cashBreakEven', label: '2 · Hòa vốn tiền mặt', color: tk.warning },
  { key: 'fullCost', label: '3 · Giá thành đầy đủ (giá vốn)', color: tk.warningInk },
  { key: 'enterpriseBreakEven', label: '4 · Hòa vốn toàn doanh nghiệp', color: tk.inkMuted },
  { key: 'targetVf', label: '5 · Giá mục tiêu markup chuẩn VF', color: tk.success },
] as const;

function Seg<T extends string | number | boolean>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, overflow: 'hidden' }}>
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: ft.size.sm, fontWeight: ft.weight.semibold, background: o.v === value ? tk.brand : tk.surface, color: o.v === value ? tk.inkInverse : tk.inkMuted }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: ft.size.xs, fontWeight: ft.weight.semibold, marginBottom: 4, color: tk.ink }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function LadderRows({ line }: { line: CeoLineResult }) {
  const rows = [
    ...TIER.map((t) => ({ label: t.label, v: line.ladder[t.key], color: t.color, you: false })),
    { label: 'GIÁ CỦA BẠN', v: line.sellingPriceVndPerKg, color: tk.brand, you: true },
  ].sort((a, b) => b.v - a.v);
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: rd.sm, background: r.you ? tk.brand : 'transparent', color: r.you ? tk.inkInverse : tk.ink, fontSize: ft.size.xs, fontWeight: r.you ? ft.weight.bold : ft.weight.regular }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
            {r.label}
          </span>
          <span style={{ ...tnum }}>{fmtVnd(r.v)} đ/kg</span>
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
    <Card style={{ background: tk.surfaceMuted }}>
      <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>
        {line.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'} · <span style={{ color: tk.ink }}>{line.materialName}</span> — giá bán VF đề xuất
      </div>
      <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, margin: '4px 0', color: tk.ink }}>
        {fmtVnd(line.sellingPriceVndPerKg)} <span style={{ fontSize: ft.size.md, color: tk.inkMuted }}>đ/{line.line === 'pipe' ? 'kg' : 'kg (tham chiếu)'}</span>
      </div>
      <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>
        Giá thành <b>{fmtVnd(line.fullCostVndPerKg)}</b> = nguyên liệu <b>{fmtVnd(line.materialCostVndPerKg)}</b> + gia công <b>{fmtVnd(line.processingCostVndPerKg)}</b> + bao bì <b>{fmtVnd(line.packagingCostVndPerKg)}</b> · lãi gộp <b>{fmt1(line.marginOnPricePct)}%</b>
        {line.machineHourCostVnd !== undefined ? ` · chi phí 1 giờ máy ép ${fmtVnd(line.machineHourCostVnd)} đ` : ''}
      </div>
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: rd.sm, fontSize: ft.size.eyebrow, fontWeight: ft.weight.semibold, background: below1 ? tk.dangerTint : ok ? tk.successTint : tk.warningTint, color: below1 ? tk.dangerInk : ok ? tk.successInk : tk.warningInk }}>
        {below1 ? '⛔ Dưới sàn biến phí — lỗ tiền tươi từng kg' : ok ? '✅ Trên hòa vốn toàn doanh nghiệp — vùng an toàn đàm phán' : '⚠️ Chưa gánh hết chi phí toàn doanh nghiệp'}
      </div>
      <div style={{ ...eyebrowStyle, marginTop: 12 }}>Sàn đàm phán (thang giá 5 bậc)</div>
      <LadderRows line={line} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
        {[
          ['Sản lượng cả năm', `${fmtVnd(line.annualProductionKg)} kg`],
          ['Giờ máy cả năm', `${fmtVnd(line.annualMachineHours)} giờ`],
          ['Hòa vốn tại giá này', Number.isFinite(line.breakEvenPctOfCapacity) ? `${fmt1(line.breakEvenPctOfCapacity)}% CS` : '—'],
          ['Lãi gộp cả năm', fmtTy(line.annualGrossProfitVnd)],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted }}>{k}</div>
            <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
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
  // C (ADR-041 mở rộng) — chọn ghi thêm tỷ giá / tiền thuê vào dữ liệu thật.
  const [applyFx, setApplyFx] = useState(true);
  const [applyLease, setApplyLease] = useState(true);
  const appliedFx = result?.request.fxRateUsdVnd ?? 0;
  const appliedLeaseVnd = result?.request.annualPremiseLeaseVnd ?? 0;
  const fxChanged = !!result && !!scenario && Math.abs(scenario.costPool.currency.usdVndRate - appliedFx) > 1e-9;
  const leaseChanged = !!result && !!scenario && scenario.costPool.sharedFixedCosts.annualLandRent !== appliedLeaseVnd;
  const willWriteFx = fxChanged && applyFx;
  const willWriteLease = leaseChanged && applyLease;
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
      .map((c) => `• ${c.mat!.name}: giá ${fmtUsd(c.mat!.inventory.replacementPriceUsdPerKg)} → ${fmtUsd(c.newPrice)}/kg · markup ${Math.round(c.mat!.markupVf * 100)}% → ${Math.round(c.newMarkup * 100)}%`);
    if (willWriteFx) lines.push(`• Tỷ giá USD/VND: ${fmtVnd(scenario.costPool.currency.usdVndRate)} → ${fmtVnd(appliedFx)}  (⚠ ảnh hưởng MỌI chi phí quy đổi USD)`);
    if (willWriteLease) lines.push(`• Thuê mặt bằng/năm: ${fmtVnd(scenario.costPool.sharedFixedCosts.annualLandRent)} → ${fmtVnd(appliedLeaseVnd)} đ`);
    if (!window.confirm(`GHI VÀO DỮ LIỆU THẬT? Mọi màn (Bảng Giá, Tổng Quan…) sẽ tính lại theo.\n\n${lines.join('\n')}\n\nSố ca & tỷ lệ dùng máy KHÔNG đổi. Bấm OK để áp dụng.`)) return;
    setApplyState('saving');
    setApplyErr(null);
    try {
      const materials = scenario.materials.map((m) => {
        const c = applyPlan.find((x) => x.id === m.id);
        if (!c) return m;
        // Ghi giá tái tạo + KHÓA baseline tại giá vừa áp (commit ở giá đã thử) + markup.
        return { ...m, markupVf: c.newMarkup, inventory: { ...m.inventory, replacementPriceUsdPerKg: c.newPrice, priceLock: { ...m.inventory.priceLock, baseline: c.newPrice } } };
      });
      // C — ghi thêm tỷ giá / tiền thuê nếu người dùng chọn (mô hình đi thuê ADR-021).
      const costPool = {
        ...scenario.costPool,
        ...(willWriteFx ? { currency: { ...scenario.costPool.currency, usdVndRate: appliedFx } } : {}),
        ...(willWriteLease ? { sharedFixedCosts: { ...scenario.costPool.sharedFixedCosts, annualLandRent: appliedLeaseVnd } } : {}),
      };
      const parsed = ScenarioInputSchema.safeParse({ ...scenario, materials, costPool });
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

  if (!scenario) return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản…</div></Screen>;
  if (!pipeA || !fitA) return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Scenario chưa đủ nguyên liệu 2 dòng.</div></Screen>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.md, textAlign: 'right', ...tnum, color: tk.ink };
  const selStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.sm, fontWeight: ft.weight.semibold, background: tk.surface, color: tk.ink };
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
    <Screen maxWidth={1200}>
      <div style={{ ...eyebrowStyle }}>Trợ Lý CEO</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: ft.size.xxl, fontWeight: ft.weight.bold, color: tk.ink }}>Giá Bán & Hiệu Quả Cả Năm</h1>
      <p style={{ fontSize: ft.size.sm, color: tk.inkMuted, margin: 0 }}>Cấu hình <b>theo MÁY</b>: số ca là của máy (dùng chung), mỗi máy chạy <b>1</b> hay <b>2 compound</b> (chia thời gian máy — không cộng dồn vượt trần). Máy đùn ống và máy ép phụ kiện chọn compound độc lập.</p>

      {/* ── BƯỚC 1 — theo MÁY (ADR-043) ── */}
      <Card style={{ marginTop: sp[5] }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...eyebrowStyle }}>Bước 1 — Câu hỏi của bạn</div>
          <Field label="Cách tính margin">
            <Seg options={[{ v: 'markup_on_cost' as MarginMode, label: 'Markup trên giá vốn' }, { v: 'margin_on_price' as MarginMode, label: 'Lãi trên giá bán' }]} value={marginMode} onChange={setMarginMode} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {machines.map((m) => (
            <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 14 }}>
              <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>🏭 {m.title} <span style={{ fontWeight: ft.weight.regular, color: tk.inkFaint, fontSize: ft.size.eyebrow }}>({m.note})</span></div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Field label="Số ca / ngày (của máy)"><Seg options={[1, 2, 3].map((v) => ({ v: v as 1 | 2 | 3, label: `${v} ca` }))} value={m.shifts} onChange={m.setShifts} /></Field>
                {m.key === 'fit' && <Field label="Huy động giờ máy (của máy)"><Seg options={[{ v: 0.6, label: '60%' }, { v: 0.85, label: '85%' }]} value={fitUtil} onChange={setFitUtil} /></Field>}
              </div>
              {m.canTwo ? (
                <Field label="Compound chạy trên máy" hint="2 compound = chia thời gian máy, tổng = 100%">
                  <Seg options={[{ v: false, label: '1 compound' }, { v: true, label: '2 compound' }]} value={m.two} onChange={m.setTwo} />
                </Field>
              ) : (
                // Danh mục chỉ có 1 compound cho máy này ⇒ không thể chạy 2 thương
                // hiệu chung máy ⇒ nút "2 compound" + slider phân bổ tỷ lệ KHÔNG
                // hiện. Nói rõ vì sao + chỉ đường thêm compound thứ hai, để CEO
                // không tưởng mất tính năng (slider "biến mất").
                <div style={{ fontSize: ft.size.xs, lineHeight: 1.5, color: tk.warningInk, background: tk.warningTint, border: `1px dashed ${tk.warning}`, borderRadius: rd.md, padding: '9px 11px' }}>
                  <b>Chỉ 1 compound {m.key === 'pipe' ? 'ống' : 'phụ kiện'} trong danh mục</b> → chạy 1 loại, chưa phân bổ tỷ lệ được.
                  {m.key === 'pipe'
                    ? ' Muốn chạy BlazeMaster + Corzan chung máy đùn và kéo slider chia tỷ lệ sản lượng: vào '
                    : ' Muốn chạy 2 compound chung máy ép và chia tỷ lệ: vào '}
                  <b>Danh Mục Sản Phẩm</b> thêm compound thứ hai
                  {m.key === 'pipe' ? ' (nút “♻ Chuẩn hóa Corzan”)' : ''} rồi bấm Lưu — nút “2 compound” và slider sẽ hiện lại ở đây.
                </div>
              )}

              {/* Compound A (chính) */}
              <div style={{ border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, padding: 10 }}>
                <div style={{ ...eyebrowStyle, marginBottom: 6 }}>{m.two && m.canTwo ? 'Compound A' : 'Compound chạy'}</div>
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
                  <div style={{ border: `1px dashed ${tk.borderStrong}`, borderRadius: rd.md, padding: 10, background: tk.surfaceMuted }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>Compound B</div>
                    <select style={selStyle} value={m.bId} onChange={(e) => m.setB(e.target.value)}>
                      {m.mats.filter((x) => x.id !== m.aId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <Field label="Giá USD/kg"><input style={inputStyle} value={m.usdB} placeholder={fmtUsd(m.bMat.inventory.replacementPriceUsdPerKg)} onChange={(e) => m.setUsdB(e.target.value)} /></Field>
                      <Field label="Markup %"><input style={inputStyle} value={m.marginB} placeholder={fmt1(m.bMat.markupVf * 100)} onChange={(e) => m.setMarginB(e.target.value)} /></Field>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: ft.size.xs, marginBottom: 4 }}>
                      <span style={{ fontWeight: ft.weight.semibold, color: tk.ink }}>Chia thời gian máy</span>
                      <span style={{ ...tnum }}>
                        <b style={{ color: tk.ink }}>{short(m.matA.name)} {m.alloc}%</b>{'  ·  '}<b style={{ color: tk.inkMuted }}>{short(m.bMat.name)} {100 - m.alloc}%</b>
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
              <button onClick={optimize} disabled={!result || (!result.pipeSecond && !result.fittingSecond)} title={result ? '' : 'Bấm Chạy số liệu trước để có dữ liệu so sánh biên lợi nhuận'} style={{ padding: '8px 14px', background: tk.surface, color: tk.ink, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: result ? 'pointer' : 'not-allowed', opacity: result ? 1 : 0.5 }}>
                💡 Gợi ý tối ưu (dồn về compound biên đóng góp/kg cao hơn)
              </button>
            </div>
          )}
        </div>
        <button onClick={() => run()} style={{ marginTop: 18, width: '100%', padding: '12px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, fontSize: ft.size.md, fontWeight: ft.weight.bold, cursor: 'pointer' }}>▶ Chạy số liệu</button>
        {err && <div style={{ marginTop: 10, color: tk.dangerInk, fontSize: ft.size.xs }}>Lỗi tính: {err}</div>}
      </Card>

      {/* ── CÂU HỎI NGƯỢC (A/B) — goal-seek độc lập luồng xuôi ── */}
      <CeoReverseTools scenario={scenario} />

      {/* ── BƯỚC 2 ── */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {[result.pipe, result.pipeSecond, result.fitting, result.fittingSecond]
              .filter((l): l is CeoLineResult => l !== undefined)
              .map((l, i) => <LineCard key={`${l.line}-${l.materialId}-${i}`} line={l} />)}
          </div>
          <Card inverse style={{ marginTop: 16 }}>
            <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.inkInverse, marginBottom: 12 }}>Hiệu quả toàn nhà máy cả năm với giá bán này</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
              {[
                ['Doanh thu VF', fmtTy(result.summary.revenueVfVnd)],
                ['Lãi gộp', fmtTy(result.summary.grossProfitVnd)],
                ['Lợi nhuận trước thuế', fmtTy(result.summary.preTaxProfitVnd)],
                ['Lợi nhuận sau thuế', fmtTy(result.summary.netProfitVnd)],
                ['Tỷ suất lợi nhuận', `${fmt1(result.summary.preTaxProfitMarginPct)}%`],
                ['Thu hồi vốn', result.summary.paybackYears === null ? '—' : `${fmt1(result.summary.paybackYears)} năm`],
              ].map(([k, v], i) => (
                <div key={k} style={{ background: tk.sidebarElevated, borderRadius: rd.sm, padding: 12 }}>
                  <div style={{ fontSize: ft.size.eyebrow, color: tk.sidebarText }}>{k}</div>
                  <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: i >= 2 && i <= 4 && (result.summary.preTaxProfitVnd < 0) ? tk.danger : tk.inkInverse, ...tnum }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: ft.size.eyebrow, color: tk.sidebarText, marginTop: 10 }}>Nhu cầu compound cả năm: ống {fmtVnd(result.pipe.compoundNeedKgPerYear)} kg · phụ kiện {fmtVnd(result.fitting.compoundNeedKgPerYear)} kg (hao hụt). Thuế TNDN 20% (ước tính). Vốn đầu tư {fmtTy(result.summary.totalInvestedVnd)}.</div>
          </Card>

          {/* ADR-041 — CẦU NỐI giả định → thật: đối chiếu rồi áp dụng (chỉ giá + markup). */}
          {canApply && (
            <Card style={{ border: `2px solid ${tk.brand}`, marginTop: 16 }}>
              <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Biến giả định thành thật</div>
              <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 12 }}>
                Đối chiếu bộ số bạn vừa chốt với dữ liệu thật. Bấm áp dụng để <b>ghi giá compound + markup</b> vào Dữ liệu gốc — mọi màn Theo dõi &amp; Thử tính lại theo. Số ca &amp; tỷ lệ dùng máy <b>giữ nguyên</b>.
              </div>
              <table style={{ width: '100%', fontSize: ft.size.sm, borderCollapse: 'collapse', marginBottom: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: tk.inkMuted, fontSize: ft.size.eyebrow }}>
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
                      <tr key={c.id} style={{ borderTop: `1px solid ${tk.border}` }}>
                        <td style={{ padding: '6px', fontWeight: ft.weight.semibold, color: tk.ink }}>{c.mat!.name}</td>
                        <td style={{ textAlign: 'right', padding: '6px', ...tnum, color: priceChanged ? tk.ink : tk.inkMuted, fontWeight: priceChanged ? ft.weight.bold : ft.weight.regular }}>
                          {fmtUsd(c.mat!.inventory.replacementPriceUsdPerKg)} → {fmtUsd(c.newPrice)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px', ...tnum, color: markupChanged ? tk.ink : tk.inkMuted, fontWeight: markupChanged ? ft.weight.bold : ft.weight.regular }}>
                          {Math.round(c.mat!.markupVf * 100)}% → {Math.round(c.newMarkup * 100)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(fxChanged || leaseChanged) && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '10px 12px', background: tk.warningTint, border: `1px dashed ${tk.warning}`, borderRadius: rd.md, marginBottom: 14 }}>
                  {fxChanged && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: ft.size.sm, cursor: 'pointer' }}>
                      <input type="checkbox" checked={applyFx} onChange={(e) => setApplyFx(e.target.checked)} />
                      <span>Ghi cả <b>tỷ giá</b>: {fmtVnd(scenario.costPool.currency.usdVndRate)} → <b style={{ color: tk.ink }}>{fmtVnd(appliedFx)}</b> <span style={{ color: tk.warningInk }}>(ảnh hưởng mọi chi phí USD)</span></span>
                    </label>
                  )}
                  {leaseChanged && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: ft.size.sm, cursor: 'pointer' }}>
                      <input type="checkbox" checked={applyLease} onChange={(e) => setApplyLease(e.target.checked)} />
                      <span>Ghi cả <b>tiền thuê/năm</b>: {fmtVnd(scenario.costPool.sharedFixedCosts.annualLandRent)} → <b style={{ color: tk.ink }}>{fmtVnd(appliedLeaseVnd)}</b> đ</span>
                    </label>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => void applyToReal()}
                  disabled={applyState === 'saving'}
                  style={{ padding: '10px 20px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, fontSize: ft.size.md, fontWeight: ft.weight.bold, cursor: applyState === 'saving' ? 'default' : 'pointer', opacity: applyState === 'saving' ? 0.6 : 1 }}
                >
                  {applyState === 'saving' ? 'Đang ghi…' : 'Áp dụng vào dữ liệu thật →'}
                </button>
                {applyState === 'saved' && <span style={{ fontSize: ft.size.sm, color: tk.successInk, fontWeight: ft.weight.bold }}>✓ Đã ghi — mọi màn đang tính lại</span>}
                {applyState === 'error' && <span style={{ fontSize: ft.size.sm, color: tk.dangerInk }}>{applyErr}</span>}
              </div>
            </Card>
          )}

          {/* Bảng giá DN + SKU */}
          <details style={{ marginTop: 14, background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.ink }}>Bảng giá bán VF — ống {result.pipe.materialName} theo DN (đ/m) · mang đi đàm phán</summary>
            <table style={{ width: '100%', marginTop: 10, fontSize: ft.size.sm, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: tk.inkMuted, fontSize: ft.size.eyebrow }}><th>DN</th><th>Khối lượng</th><th style={{ textAlign: 'right' }}>Giá thành /m</th><th style={{ textAlign: 'right' }}>Giá bán VF /m</th></tr></thead>
              <tbody>{result.pipeDnPrices.map((r) => <tr key={r.dn} style={{ borderTop: `1px solid ${tk.border}`, color: tk.ink }}><td>{r.dn}</td><td>{fmt1(r.unitWeightKgPerM)} kg/m</td><td style={{ textAlign: 'right' }}>{fmtVnd(r.fullCostVndPerM)}</td><td style={{ textAlign: 'right', fontWeight: ft.weight.bold }}>{fmtVnd(r.sellingPriceVndPerM)}</td></tr>)}</tbody>
            </table>
          </details>
          <details style={{ marginTop: 10, background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.ink }}>Bảng giá bán VF — {result.fittingSkuPrices.length} phụ kiện {result.fitting.materialName} theo cái</summary>
            <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', fontSize: ft.size.sm, borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: tk.inkMuted, fontSize: ft.size.eyebrow }}><th>Tên</th><th>Size</th><th>SCH</th><th style={{ textAlign: 'right' }}>Kg/cái</th><th style={{ textAlign: 'right' }}>Ren KL /cái</th><th style={{ textAlign: 'right' }}>Giá thành /cái</th><th style={{ textAlign: 'right' }}>Giá bán VF /cái</th></tr></thead>
                <tbody>{result.fittingSkuPrices.map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${tk.border}`, color: tk.ink }}><td>{r.productName}{r.metalInsertVndPerPiece > 0 ? <span style={{ color: tk.inkMuted, fontSize: ft.size.eyebrow }}> (ren)</span> : ''}</td><td>{r.sizeLabel}</td><td>{r.schedule}</td><td style={{ textAlign: 'right' }}>{fmt1(r.unitWeightKg)}</td><td style={{ textAlign: 'right' }}>{r.metalInsertVndPerPiece > 0 ? fmtVnd(r.metalInsertVndPerPiece) : '—'}</td><td style={{ textAlign: 'right' }}>{fmtVnd(r.fullCostVndPerPiece)}</td><td style={{ textAlign: 'right', fontWeight: ft.weight.bold }}>{fmtVnd(r.sellingPriceVndPerPiece)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>

          {/* ── BƯỚC 3 — AI ── */}
          <Card style={{ marginTop: 16 }}>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>Bước 3 — Hỏi ý kiến AI</div>
            <button onClick={() => void askAi()} disabled={aiLoading} style={{ padding: '10px 18px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, fontSize: ft.size.md, fontWeight: ft.weight.bold, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? '🤖 AI đang đọc số liệu…' : advice ? '🤖 AI tư vấn lại' : '🤖 AI tư vấn ngay'}
            </button>
            {advice && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>🤖 Nhận định của trợ lý AI {advice.generatedByModel === 'mock' ? '(mock)' : `(${advice.generatedByModel})`}</div>
                <ul style={{ fontSize: ft.size.sm, lineHeight: 1.5, marginTop: 8, color: tk.ink }}>{advice.items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it.message}</li>)}</ul>
                {advice.disclaimer && <div style={{ fontSize: ft.size.eyebrow, color: tk.warningInk, background: tk.warningTint, padding: '8px 12px', borderRadius: rd.sm }}>⚠ {advice.disclaimer}</div>}
              </div>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
